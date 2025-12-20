// app/api/meals/stream/route.ts
// Streaming endpoint for meal generation - reduces perceived wait time
// Note: Kroger enrichment is lazy-loaded on the meal detail page, not during generation
import OpenAI from "openai";
import { randomUUID, createHash } from "crypto";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { v2 as cloudinary } from "cloudinary";
import type { PreferenceData } from "@/types/preferences";

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
const FREE_TIER_MONTHLY_LIMIT = 10;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// ---------- Types ----------

type Ingredient = {
    name: string;
    quantity: string;
    grocerySearchTerm?: string; // Clean search term for Kroger (e.g., "fresh bananas" instead of "sliced bananas")
    preparation?: string; // How to prepare (e.g., "sliced", "diced", "minced")
    category?: string;
    aisle?: string;
    price?: number;
    soldBy?: "WEIGHT" | "UNIT"; // WEIGHT = price per lb, UNIT = price per item
    stockLevel?: string; // HIGH, LOW, or TEMPORARILY_OUT_OF_STOCK
    available?: boolean; // Whether product is available in-store
    krogerProductId?: string;
    productName?: string;
    productImageUrl?: string;
    productSize?: string;
    productAisle?: string;
};

type Meal = {
    id: string;
    mealType: "breakfast" | "lunch" | "dinner" | "snack";
    name: string;
    description: string;
    servings: number;
    macros: {
        calories: number;
        protein: number;
        carbs: number;
        fiber: number;
        fat: number;
    };
    ingredients: Ingredient[];
    steps: string[];
    imageUrl?: string;
    cookTimeRange?: {
        min: number;
        max: number;
    };
};

type UserPrefs = {
    dietType?: string;
    cookingExperience?: string;
    allergiesAndSensitivities?: {
        allergies?: string[];
        sensitivities?: string[];
    };
};

type DoctorDietInstructions = {
    hasActiveNote?: boolean;
    blockedIngredients?: string[];
    blockedGroups?: string[];
    summaryText?: string;
};

type FamilyMemberData = {
    id: string;
    name: string;
    isActive: boolean;
    dietType?: string;
    allergiesAndSensitivities?: {
        allergies?: string[];
        sensitivities?: string[];
    };
    dislikedFoods?: string[];
    doctorDietInstructions?: DoctorDietInstructions;
};

type RawUserEvent = {
    type?: string;
    mealId?: string | null;
    prompt?: string | null;
    message?: string | null;
};

type HistoryEventForModel = {
    type: string;
    mealId?: string | null;
    promptSnippet?: string | null;
    messageSnippet?: string | null;
};

type DoctorContextForModel = {
    blockedIngredients: string[];
    blockedFoodGroups: string[];
    doctorSummary: string | null;
};

// Stream event types
type StreamEvent =
    | { type: "status"; message: string }
    | { type: "meal"; meal: Meal; index: number }
    | { type: "meal_updated"; meal: Meal; index: number }
    | { type: "meta"; meta: Record<string, unknown> }
    | { type: "done" }
    | { type: "error"; error: string; message: string };

// ---------- Domain guardrails ----------

const NON_FOOD_KEYWORDS = [
    "sex", "sexual", "porn", "nsfw", "onlyfans", "dating", "relationship advice",
    "breakup", "tax", "taxes", "irs", "code this", "programming", "javascript",
    "typescript", "react", "python", "rust", "c++", "politics", "election",
    "stock tip", "crypto trading",
];

function isFoodPrompt(prompt: string): boolean {
    const lower = prompt.toLowerCase();

    // Block explicitly non-food requests
    for (const blocked of NON_FOOD_KEYWORDS) {
        if (lower.includes(blocked)) return false;
    }

    // Since users are in a meal planning app, assume food intent by default.
    // Only reject if it's clearly a non-food request (handled above).
    // This allows for any cuisine, ingredient, or dish name from any culture
    // (e.g., "aloo gobi", "pad thai", "jollof rice", "bibimbap", etc.)
    return true;
}

// ---------- Helpers ----------

function normalizeNumber(n: unknown, fallback = 0): number {
    if (typeof n === "number" && Number.isFinite(n)) return n;
    if (typeof n === "string") {
        const parsed = parseFloat(n);
        if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
}

function normalizeString(value: unknown, fallback = ""): string {
    if (typeof value === "string") return value;
    if (value == null) return fallback;
    return String(value);
}

function normalizeIngredient(raw: unknown): Ingredient {
    const r = raw as Record<string, unknown>;
    const priceValue = r.price != null && Number.isFinite(Number(r.price)) ? Number(r.price) : undefined;

    return {
        name: normalizeString(r.name, "Unknown ingredient"),
        quantity: normalizeString(r.quantity, ""),
        grocerySearchTerm: typeof r.grocerySearchTerm === "string" ? r.grocerySearchTerm : undefined,
        preparation: typeof r.preparation === "string" ? r.preparation : undefined,
        category: r.category ? String(r.category) : undefined,
        aisle: r.aisle ? String(r.aisle) : undefined,
        price: priceValue,
        krogerProductId: typeof r.krogerProductId === "string" ? r.krogerProductId : undefined,
        productName: typeof r.productName === "string" ? r.productName : undefined,
        productImageUrl: typeof r.productImageUrl === "string" ? r.productImageUrl : undefined,
        productSize: typeof r.productSize === "string" ? r.productSize : undefined,
        productAisle: typeof r.productAisle === "string" ? r.productAisle : undefined,
    };
}

function normalizeMeal(raw: unknown): Meal {
    const r = raw as Record<string, unknown>;
    const mealTypeStr = normalizeString(r.mealType, "dinner").toLowerCase();
    const safeMealType: Meal["mealType"] =
        mealTypeStr === "breakfast" || mealTypeStr === "lunch" || mealTypeStr === "snack"
            ? (mealTypeStr as Meal["mealType"])
            : "dinner";

    const ingredientsArray = Array.isArray(r.ingredients) ? r.ingredients : [];
    const stepsArray = Array.isArray(r.steps) ? r.steps : [];
    const macros = (r.macros as Record<string, unknown>) || {};

    // Normalize cook time range
    const cookTimeRaw = r.cookTimeRange as Record<string, unknown> | undefined;
    const cookTimeRange = cookTimeRaw
        ? {
            min: Math.max(1, Math.round(normalizeNumber(cookTimeRaw.min, 15))),
            max: Math.max(1, Math.round(normalizeNumber(cookTimeRaw.max, 30))),
        }
        : undefined;

    return {
        id: randomUUID(), // Always generate unique ID - don't trust AI-generated IDs
        mealType: safeMealType,
        name: normalizeString(r.name, "Untitled meal"),
        description: normalizeString(r.description, ""),
        servings: Math.max(1, Math.round(normalizeNumber(r.servings, 1))),
        macros: {
            calories: normalizeNumber(macros.calories, 0),
            protein: normalizeNumber(macros.protein, 0),
            carbs: normalizeNumber(macros.carbs, 0),
            fiber: normalizeNumber(macros.fiber, 0),
            fat: normalizeNumber(macros.fat, 0),
        },
        ingredients: ingredientsArray.map((ing) => normalizeIngredient(ing)),
        steps: stepsArray.map((s) => normalizeString(s, "")).filter((s) => s.length > 0),
        imageUrl: typeof r.imageUrl === "string" && r.imageUrl.trim().length > 0 ? r.imageUrl.trim() : undefined,
        cookTimeRange,
    };
}

// ---------- Image caching ----------

const IMAGE_CACHE_COLLECTION = "mealImageCache";

function getMealImageCacheKey(meal: Meal): string {
    const topIngredients = meal.ingredients
        .slice(0, 5)
        .map((i) => i.name.toLowerCase().trim())
        .sort()
        .join(",");
    const keySource = `${meal.name.toLowerCase().trim()}|${meal.mealType}|${topIngredients}`;
    return createHash("sha256").update(keySource).digest("hex").slice(0, 32);
}

async function getCachedImage(cacheKey: string): Promise<string | null> {
    try {
        const docRef = adminDb.collection(IMAGE_CACHE_COLLECTION).doc(cacheKey);
        const snap = await docRef.get();
        if (!snap.exists) return null;

        const data = snap.data() as { imageUrl?: string } | undefined;
        if (!data?.imageUrl) return null;

        return data.imageUrl;
    } catch {
        return null;
    }
}

async function uploadImageToCloudinary(cacheKey: string, imageBuffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            {
                public_id: `meal-images/${cacheKey}`,
                folder: "cartsense",
                resource_type: "image",
            },
            (error, result) => {
                if (error) {
                    reject(error);
                } else if (result) {
                    resolve(result.secure_url);
                } else {
                    reject(new Error("No result from Cloudinary"));
                }
            }
        ).end(imageBuffer);
    });
}

async function downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to download image");
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

async function cacheImage(cacheKey: string, permanentUrl: string, mealName: string): Promise<void> {
    try {
        await adminDb.collection(IMAGE_CACHE_COLLECTION).doc(cacheKey).set({
            imageUrl: permanentUrl,
            mealName,
            createdAt: FieldValue.serverTimestamp(),
        });
    } catch {
        // Ignore cache errors
    }
}

function buildMealImagePrompt(meal: Meal): string {
    const ingredientNames = meal.ingredients.map((i) => i.name).join(", ");
    return `High-quality food photography of a single plated dish.
Meal: ${meal.name}
Type: ${meal.mealType}
Key ingredients: ${ingredientNames || "typical grocery ingredients"}
Style: bright natural lighting, top-down angle, realistic, appetizing, no text, no logos, simple background.`.trim();
}

async function getOrGenerateImage(meal: Meal): Promise<string | undefined> {
    const cacheKey = getMealImageCacheKey(meal);

    // Check cache first
    const cached = await getCachedImage(cacheKey);
    if (cached) return cached;

    try {
        // Generate with DALL-E
        const result = await openai.images.generate({
            model: "dall-e-2",
            prompt: buildMealImagePrompt(meal),
            n: 1,
            size: "256x256",
        });

        const tempUrl = result.data?.[0]?.url;
        if (tempUrl) {
            // Download from DALL-E and upload to Cloudinary for permanent URL
            const imageBuffer = await downloadImage(tempUrl);
            const permanentUrl = await uploadImageToCloudinary(cacheKey, imageBuffer);

            // Cache the permanent URL in Firestore
            cacheImage(cacheKey, permanentUrl, meal.name).catch(() => {});

            return permanentUrl;
        }
    } catch (err) {
        console.error("Image generation/upload error:", err);
    }

    return `https://placehold.co/256x256/cccccc/555555?text=${encodeURIComponent(meal.name)}`;
}

// ---------- Data loading ----------

// Log MEAL_GENERATED events for variety tracking
async function logMealGenerated(uid: string, meal: Meal): Promise<void> {
    try {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();

        const eventDoc = {
            createdAt: FieldValue.serverTimestamp(),
            type: "MEAL_GENERATED",
            mealId: meal.id,
            source: "prompt" as const,
            context: {
                mealTime: meal.mealType,
                dayType: day === 0 || day === 6 ? "weekend" : "weekday",
            },
            payload: {
                mealName: meal.name,
            },
            clientEventId: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        };

        const eventsCol = adminDb.collection("foodEvents").doc(uid).collection("events");
        await eventsCol.add(eventDoc);
    } catch (err) {
        console.error("logMealGenerated error:", err);
    }
}

async function loadUserHistoryForModel(uid?: string): Promise<HistoryEventForModel[]> {
    if (!uid) return [];
    try {
        const eventsRef = adminDb.collection("userEvents").doc(uid).collection("events");
        const snap = await eventsRef.orderBy("createdAt", "desc").limit(50).get();
        return snap.docs.map((docSnap) => {
            const d = docSnap.data() as RawUserEvent;
            return {
                type: d.type ?? "unknown",
                mealId: d.mealId ?? null,
                promptSnippet: d.prompt ?? null,
                messageSnippet: d.message ?? null,
            };
        });
    } catch {
        return [];
    }
}

async function loadDoctorInstructions(uid?: string): Promise<DoctorContextForModel | null> {
    if (!uid) return null;
    try {
        const snap = await adminDb.collection("users").doc(uid).get();
        if (!snap.exists) return null;

        const data = snap.data() as { doctorDietInstructions?: DoctorDietInstructions } | undefined;
        const docInst = data?.doctorDietInstructions;
        if (!docInst || !docInst.hasActiveNote) return null;

        const blockedIngredients = docInst.blockedIngredients?.map((s) => String(s).trim()).filter(Boolean) ?? [];
        const blockedFoodGroups = docInst.blockedGroups?.map((s) => String(s).trim()).filter(Boolean) ?? [];
        const doctorSummary = docInst.summaryText?.trim() || null;

        if (!blockedIngredients.length && !blockedFoodGroups.length && !doctorSummary) return null;

        return { blockedIngredients, blockedFoodGroups, doctorSummary };
    } catch {
        return null;
    }
}

async function loadActiveFamilyMembers(uid?: string): Promise<FamilyMemberData[]> {
    if (!uid) return [];
    try {
        const membersSnap = await adminDb
            .collection("users")
            .doc(uid)
            .collection("familyMembers")
            .where("isActive", "==", true)
            .get();

        return membersSnap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
                id: docSnap.id,
                name: d.name || "Family Member",
                isActive: true,
                dietType: d.dietType ?? undefined,
                allergiesAndSensitivities: d.allergiesAndSensitivities,
                dislikedFoods: d.dislikedFoods,
                doctorDietInstructions: d.doctorDietInstructions,
            };
        });
    } catch {
        return [];
    }
}

async function loadRecentMealNames(uid?: string): Promise<{ name: string; daysAgo: number }[]> {
    if (!uid) return [];

    try {
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const eventsRef = adminDb
            .collection("foodEvents")
            .doc(uid)
            .collection("events");

        const snapshot = await eventsRef
            .where("type", "==", "MEAL_GENERATED")
            .where("createdAt", ">=", fourteenDaysAgo)
            .orderBy("createdAt", "desc")
            .limit(50)
            .get();

        const now = new Date();
        const meals: { name: string; daysAgo: number }[] = [];
        const seenNames = new Set<string>();

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const mealName = data.payload?.mealName;
            if (mealName && !seenNames.has(mealName.toLowerCase())) {
                seenNames.add(mealName.toLowerCase());
                const createdAt = data.createdAt?.toDate?.() || new Date();
                const daysAgo = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
                meals.push({ name: mealName, daysAgo });
            }
        }

        return meals;
    } catch (err) {
        console.error("Error loading recent meal names:", err);
        return [];
    }
}

async function loadUserPreferences(uid?: string): Promise<PreferenceData | null> {
    if (!uid) return null;

    try {
        // Fetch aggregated preferences from the aggregate API
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "http://localhost:3000";

        // Directly query Firestore instead of making HTTP request to avoid self-referencing issues
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const eventsRef = adminDb
            .collection("foodEvents")
            .doc(uid)
            .collection("events");

        const snapshot = await eventsRef
            .where("createdAt", ">=", ninetyDaysAgo)
            .orderBy("createdAt", "desc")
            .limit(500)
            .get();

        if (snapshot.empty) return null;

        // Score weights
        const SCORE_WEIGHTS: Record<string, number> = {
            MEAL_ACCEPTED: 1,
            MEAL_REJECTED: -2,
            MEAL_SAVED: 2,
            MEAL_REPEATED: 3,
            INGREDIENT_ADDED: 1.5,
            INGREDIENT_REMOVED: -1.5,
            CART_ADDED: 0.5,
            CART_REMOVED: -0.5,
        };

        const ingredientScores: Record<string, number> = {};
        const tagScores: Record<string, number> = {};

        for (const doc of snapshot.docs) {
            const event = doc.data();
            const weight = SCORE_WEIGHTS[event.type] ?? 0;
            const payload = event.payload || {};

            // Score ingredients
            if (payload.ingredientKey && weight !== 0) {
                ingredientScores[payload.ingredientKey] =
                    (ingredientScores[payload.ingredientKey] || 0) + weight;
            }

            // Handle swaps
            if (event.type === "INGREDIENT_SWAPPED" || event.type === "PRODUCT_SWAPPED") {
                if (payload.fromIngredientKey) {
                    ingredientScores[payload.fromIngredientKey] =
                        (ingredientScores[payload.fromIngredientKey] || 0) - 1;
                }
                if (payload.toIngredientKey) {
                    ingredientScores[payload.toIngredientKey] =
                        (ingredientScores[payload.toIngredientKey] || 0) + 1;
                }
            }

            // Score tags
            if (payload.mealTags && Array.isArray(payload.mealTags)) {
                if (event.type === "MEAL_ACCEPTED" || event.type === "MEAL_SAVED" || event.type === "MEAL_REPEATED") {
                    for (const tag of payload.mealTags) {
                        tagScores[tag] = (tagScores[tag] || 0) + weight;
                    }
                } else if (event.type === "MEAL_REJECTED") {
                    for (const tag of payload.mealTags) {
                        tagScores[tag] = (tagScores[tag] || 0) + weight;
                    }
                }
            }
        }

        // Also check preference locks
        const locksRef = adminDb.collection("preferenceLocks").doc(uid).collection("locks");
        const locksSnapshot = await locksRef.get();

        const LOCK_BOOSTS: Record<string, number> = {
            ALWAYS_INCLUDE: 10,
            NEVER_INCLUDE: -10,
            PREFER: 5,
            AVOID: -5,
        };

        for (const lockDoc of locksSnapshot.docs) {
            const lock = lockDoc.data();
            const boost = LOCK_BOOSTS[lock.rule] ?? 0;

            if (lock.scope === "ingredient" && lock.key) {
                ingredientScores[lock.key] = (ingredientScores[lock.key] || 0) + boost;
            } else if ((lock.scope === "tag" || lock.scope === "cuisine" || lock.scope === "method") && lock.key) {
                tagScores[lock.key] = (tagScores[lock.key] || 0) + boost;
            }
        }

        // Extract preferences
        const preferredIngredients: string[] = [];
        const avoidIngredients: string[] = [];
        const transparencyNotes: string[] = [];

        for (const [key, score] of Object.entries(ingredientScores)) {
            const displayName = key.replace(/_/g, " ");
            if (score >= 2) {
                preferredIngredients.push(displayName);
                if (score >= 5) {
                    transparencyNotes.push(`You seem to enjoy ${displayName}`);
                }
            } else if (score <= -2) {
                avoidIngredients.push(displayName);
                if (score <= -5) {
                    transparencyNotes.push(`You tend to avoid ${displayName}`);
                }
            }
        }

        const preferredTags: string[] = [];
        const avoidTags: string[] = [];

        for (const [key, score] of Object.entries(tagScores)) {
            if (score >= 2) {
                preferredTags.push(key);
            } else if (score <= -2) {
                avoidTags.push(key);
            }
        }

        // Return null if no significant preferences
        if (preferredIngredients.length === 0 && avoidIngredients.length === 0 &&
            preferredTags.length === 0 && avoidTags.length === 0) {
            return null;
        }

        return {
            preferredIngredients: preferredIngredients.slice(0, 10),
            avoidIngredients: avoidIngredients.slice(0, 10),
            preferredTags: preferredTags.slice(0, 5),
            avoidTags: avoidTags.slice(0, 5),
            transparencyNotes: transparencyNotes.slice(0, 3),
        };
    } catch (err) {
        console.error("Error loading user preferences:", err);
        return null;
    }
}

// Combine all dietary restrictions from user and active family members
type CombinedDietaryRestrictions = {
    householdMembers: { name: string; dietType?: string; restrictions: string[] }[];
    combinedAllergies: string[];
    combinedSensitivities: string[];
    combinedDislikes: string[];
    combinedDoctorBlockedIngredients: string[];
    combinedDoctorBlockedGroups: string[];
    dietTypes: string[];
    cookingExperience?: string;
};

// Validation result type
type ValidationResult = {
    isValid: boolean;
    violations: string[];
};

function combineFamilyRestrictions(
    userDoc: { name?: string; dietType?: string; cookingExperience?: string; allergiesAndSensitivities?: { allergies?: string[]; sensitivities?: string[] }; dislikedFoods?: string[] } | null,
    userDoctorContext: DoctorContextForModel | null,
    familyMembers: FamilyMemberData[]
): CombinedDietaryRestrictions {
    const householdMembers: CombinedDietaryRestrictions["householdMembers"] = [];
    const allAllergies = new Set<string>();
    const allSensitivities = new Set<string>();
    const allDislikes = new Set<string>();
    const allDoctorBlockedIngredients = new Set<string>();
    const allDoctorBlockedGroups = new Set<string>();
    const dietTypes = new Set<string>();

    // Add primary user
    if (userDoc) {
        const restrictions: string[] = [];
        if (userDoc.dietType) {
            dietTypes.add(userDoc.dietType);
            restrictions.push(userDoc.dietType);
        }
        userDoc.allergiesAndSensitivities?.allergies?.forEach((a) => {
            allAllergies.add(a);
            restrictions.push(`allergic to ${a}`);
        });
        userDoc.allergiesAndSensitivities?.sensitivities?.forEach((s) => {
            allSensitivities.add(s);
        });
        userDoc.dislikedFoods?.forEach((f) => allDislikes.add(f));

        if (userDoctorContext) {
            userDoctorContext.blockedIngredients.forEach((i) => allDoctorBlockedIngredients.add(i));
            userDoctorContext.blockedFoodGroups.forEach((g) => allDoctorBlockedGroups.add(g));
        }

        householdMembers.push({
            name: userDoc.name || "You",
            dietType: userDoc.dietType,
            restrictions,
        });
    }

    // Add family members
    for (const member of familyMembers) {
        const restrictions: string[] = [];
        if (member.dietType) {
            dietTypes.add(member.dietType);
            restrictions.push(member.dietType);
        }
        member.allergiesAndSensitivities?.allergies?.forEach((a) => {
            allAllergies.add(a);
            restrictions.push(`allergic to ${a}`);
        });
        member.allergiesAndSensitivities?.sensitivities?.forEach((s) => {
            allSensitivities.add(s);
        });
        member.dislikedFoods?.forEach((f) => allDislikes.add(f));

        // Family member's doctor instructions
        if (member.doctorDietInstructions?.hasActiveNote) {
            member.doctorDietInstructions.blockedIngredients?.forEach((i) => allDoctorBlockedIngredients.add(i));
            member.doctorDietInstructions.blockedGroups?.forEach((g) => allDoctorBlockedGroups.add(g));
        }

        householdMembers.push({
            name: member.name,
            dietType: member.dietType,
            restrictions,
        });
    }

    return {
        householdMembers,
        combinedAllergies: Array.from(allAllergies),
        combinedSensitivities: Array.from(allSensitivities),
        combinedDislikes: Array.from(allDislikes),
        combinedDoctorBlockedIngredients: Array.from(allDoctorBlockedIngredients),
        combinedDoctorBlockedGroups: Array.from(allDoctorBlockedGroups),
        dietTypes: Array.from(dietTypes),
        cookingExperience: userDoc?.cookingExperience,
    };
}

// Validate a meal against dietary restrictions
function validateMealAgainstRestrictions(meal: Meal, restrictions: CombinedDietaryRestrictions): ValidationResult {
    const violations: string[] = [];

    // Create a combined list of all ingredient names and search terms (lowercase for comparison)
    const ingredientTexts = meal.ingredients.flatMap(ing => [
        ing.name.toLowerCase(),
        ing.grocerySearchTerm?.toLowerCase() || "",
        ing.preparation?.toLowerCase() || ""
    ]).filter(Boolean);

    const mealNameLower = meal.name.toLowerCase();
    const mealDescriptionLower = meal.description.toLowerCase();
    const allMealText = [mealNameLower, mealDescriptionLower, ...ingredientTexts].join(" ");

    // Check CRITICAL allergies (strictest check)
    for (const allergen of restrictions.combinedAllergies) {
        const allergenLower = allergen.toLowerCase();

        // Check for direct mentions or common derivatives
        if (allMealText.includes(allergenLower)) {
            violations.push(`Contains allergen: ${allergen}`);
        }

        // Check for common derivatives
        const derivatives: Record<string, string[]> = {
            "dairy": ["milk", "cheese", "yogurt", "butter", "cream", "whey", "casein", "lactose"],
            "eggs": ["egg", "mayonnaise"],
            "peanuts": ["peanut"],
            "tree nuts": ["almond", "walnut", "cashew", "pecan", "pistachio", "hazelnut", "macadamia"],
            "wheat": ["wheat", "flour", "bread", "pasta", "noodle"],
            "gluten": ["wheat", "barley", "rye", "flour", "bread", "pasta"],
            "soy": ["soy", "tofu", "edamame", "miso", "tempeh"],
            "shellfish": ["shrimp", "crab", "lobster", "crawfish", "prawn"],
            "fish": ["salmon", "tuna", "cod", "tilapia", "halibut", "mackerel"],
            "sesame": ["sesame", "tahini"],
        };

        const derivativeList = derivatives[allergenLower] || [];
        for (const derivative of derivativeList) {
            if (allMealText.includes(derivative)) {
                violations.push(`Contains ${allergen} derivative: ${derivative}`);
            }
        }
    }

    // Check doctor-blocked ingredients (strict)
    for (const blocked of restrictions.combinedDoctorBlockedIngredients) {
        const blockedLower = blocked.toLowerCase();
        if (allMealText.includes(blockedLower)) {
            violations.push(`Contains doctor-blocked ingredient: ${blocked}`);
        }
    }

    // Check doctor-blocked food groups (strict)
    for (const group of restrictions.combinedDoctorBlockedGroups) {
        const groupLower = group.toLowerCase();
        if (allMealText.includes(groupLower)) {
            violations.push(`Contains doctor-blocked food group: ${group}`);
        }
    }

    return {
        isValid: violations.length === 0,
        violations
    };
}

// ---------- OpenAI streaming ----------

// Detect if prompt is a broad meal plan request vs specific recipe search
function isBroadMealPlanRequest(prompt: string): boolean {
    const lower = prompt.toLowerCase().trim();

    // List of specific proteins/ingredients that indicate a focused recipe search
    const hasSpecificIngredient = /\b(ground\s*(chicken|turkey|beef|pork)|chicken|turkey|beef|pork|fish|salmon|shrimp|tofu|steak|lamb|eggs?|pasta|rice|quinoa|beans|lentils|tuna|cod|tilapia)\b/i.test(lower);

    // If they mention a specific ingredient, it's almost always a specific request
    // UNLESS they also mention broad planning keywords
    if (hasSpecificIngredient) {
        const hasBroadKeyword = /\b(meal\s*plan|for\s*the\s*week|weekly|daily\s*meals|full\s*day|breakfast.*lunch.*dinner)\b/i.test(lower);
        if (!hasBroadKeyword) {
            console.log("[STREAM] Detected specific ingredient request:", lower);
            return false; // NOT a broad request
        }
    }

    // Patterns that indicate broad meal planning (no specific ingredient)
    const broadPatterns = [
        /meal\s*plan/i,
        /week('s)?\s*(worth|of)?\s*meals?/i,
        /meals?\s*for\s*(the|this)?\s*week/i,
        /daily\s*meals?/i,
        /full\s*day/i,
        /day('s)?\s*(worth|of)?\s*meals?/i,
        /breakfast.*lunch.*dinner/i,
        /what\s*(should|can)\s*i\s*eat/i,
        /plan\s*my\s*(meals?|eating)/i,
        /give\s*me\s*(some|a\s*few|multiple)?\s*meal\s*ideas/i,
        /^meals?\s*$/i,  // just "meal" or "meals" alone
        /^healthy\s+meals?$/i,  // just "healthy meal(s)"
    ];

    for (const pattern of broadPatterns) {
        if (pattern.test(lower)) {
            console.log("[STREAM] Detected broad meal plan request:", lower);
            return true;
        }
    }

    // Check for generic "meal ideas" without specific ingredients
    if (lower.includes("meal ideas") && !hasSpecificIngredient) {
        console.log("[STREAM] Detected generic meal ideas request:", lower);
        return true;
    }

    // Default: if no broad pattern matched, treat as specific request
    console.log("[STREAM] Defaulting to specific request:", lower);
    return false;
}

function buildSystemPrompt(prompt: string, restrictions: CombinedDietaryRestrictions, isPremium: boolean, pantryMode: boolean = false, preferences: PreferenceData | null = null, recentMeals: { name: string; daysAgo: number }[] = []): string {
    // Build household section if multiple members
    const householdSection = restrictions.householdMembers.length > 1
        ? `\nHousehold (${restrictions.householdMembers.length}): ${restrictions.householdMembers.map(m => `${m.name}${m.dietType ? ` (${m.dietType})` : ""}`).join(", ")}`
        : "";

    // Build cooking experience guidance
    let cookingGuidance = "";
    if (restrictions.cookingExperience === "beginner") {
        cookingGuidance = "\nCOOKING LEVEL: Beginner - Use simple techniques (boiling, baking, pan-frying). Keep recipes to 5-7 ingredients max. Avoid complex knife work or timing multiple components. Include clear, detailed steps.";
    } else if (restrictions.cookingExperience === "intermediate") {
        cookingGuidance = "\nCOOKING LEVEL: Intermediate - Can handle most techniques including sautéing, roasting, and making sauces. Comfortable with 8-12 ingredients and multi-step recipes.";
    } else if (restrictions.cookingExperience === "advanced") {
        cookingGuidance = "\nCOOKING LEVEL: Advanced - Comfortable with complex techniques like braising, reduction sauces, and precise timing. Can handle intricate recipes with many components.";
    }

    // Build restrictions - only include non-empty sections
    const restrictionParts: string[] = [];
    if (restrictions.combinedDoctorBlockedIngredients.length) restrictionParts.push(`Doctor-blocked (STRICT): ${restrictions.combinedDoctorBlockedIngredients.join(", ")}`);
    if (restrictions.combinedDoctorBlockedGroups.length) restrictionParts.push(`Blocked groups (STRICT): ${restrictions.combinedDoctorBlockedGroups.join(", ")}`);
    if (restrictions.combinedSensitivities.length) restrictionParts.push(`Sensitivities: ${restrictions.combinedSensitivities.join(", ")}`);
    if (restrictions.combinedDislikes.length) {
        restrictionParts.push(`Dislikes (avoid whole/raw forms, cooked/processed OK): ${restrictions.combinedDislikes.join(", ")}`);
    }
    if (restrictions.dietTypes.length) restrictionParts.push(`Diets: ${restrictions.dietTypes.join(", ")}`);

    // Build allergy warning as a separate, prominent section
    const allergyWarning = restrictions.combinedAllergies.length > 0
        ? `\n⚠️ CRITICAL ALLERGIES - DO NOT USE THESE INGREDIENTS UNDER ANY CIRCUMSTANCES:\n${restrictions.combinedAllergies.map(a => `• ${a} (and all ${a}-derived ingredients)`).join("\n")}\nThese allergies are potentially life-threatening. NEVER suggest meals containing these allergens or their derivatives.\n`
        : "";

    // Build dislikes guidance for semantic understanding
    const dislikesGuidance = restrictions.combinedDislikes.length > 0
        ? `\n🔸 IMPORTANT - SEMANTIC UNDERSTANDING OF DISLIKES:\nWhen someone dislikes an ingredient, they typically mean the whole/raw form, NOT processed or cooked versions:
- "Tomatoes" disliked → AVOID whole/raw tomatoes, but tomato sauce, ketchup, marinara, and cooked tomato products are FINE
- "Mushrooms" disliked → AVOID whole mushrooms, but mushroom powder/extract in sauces is FINE
- "Onions" disliked → AVOID visible onion pieces, but onion powder and well-cooked onions in sauces are usually FINE
- "Peppers" disliked → AVOID bell peppers/chunks, but pepper powder and hot sauces may be FINE
Apply common sense: if they dislike the texture/appearance of something, the processed version is usually acceptable.\n`
        : "";

    const restrictionsText = restrictionParts.length > 0
        ? `RESTRICTIONS:${householdSection}\n${restrictionParts.map(r => `- ${r}`).join("\n")}`
        : "";

    // Ingredient quality rules - only apply when user will be shopping (not pantry mode)
    const qualityRulesText = pantryMode ? "" : `
INGREDIENT QUALITY RULES (FOR SHOPPING):
- PROTEINS: Prefer fresh, lean cuts. Avoid breaded, battered, fried, nuggets, or pre-seasoned meats. Prefer boneless/skinless chicken, lean ground turkey/beef (90%+ lean), fresh fish fillets.
- DAIRY: Prefer plain, unsweetened options. Avoid flavored yogurt, sweetened milk, or dessert cheeses. Prefer plain Greek yogurt, unflavored milk/alternatives.
- PRODUCE: Use fresh or plain frozen. Avoid fruits in syrup, candied items, or vegetables with sauce/cheese.
- GRAINS: Prefer whole grain options when available.
- FATS: Use healthy oils and natural nut butters. Avoid hydrogenated oils.
- BEANS: Prefer no-salt-added or low-sodium canned, or dried beans.
- SNACKS/NUTS: Prefer raw or dry roasted unsalted.`;

    // Pantry mode specific guidance
    const pantryModeText = pantryMode ? `
PANTRY MODE: The user is cooking with ingredients they already have at home.
- Create recipes using ONLY the ingredients they mention (plus basic pantry staples like salt, pepper, oil)
- Be flexible and practical - work with what they have
- Suggest simple recipes achievable with basic home equipment
- Do NOT suggest they buy additional ingredients` : "";

    // Build learned preferences section
    let preferencesSection = "";
    if (preferences) {
        const parts: string[] = [];

        if (preferences.preferredIngredients.length > 0) {
            parts.push(`PREFERRED INGREDIENTS (user tends to enjoy): ${preferences.preferredIngredients.join(", ")}`);
        }
        if (preferences.avoidIngredients.length > 0) {
            parts.push(`LEARNED AVOIDANCES (user tends to skip, not strict): ${preferences.avoidIngredients.join(", ")}`);
        }
        if (preferences.preferredTags.length > 0) {
            parts.push(`PREFERRED STYLES: ${preferences.preferredTags.join(", ")}`);
        }
        if (preferences.avoidTags.length > 0) {
            parts.push(`LESS PREFERRED STYLES: ${preferences.avoidTags.join(", ")}`);
        }

        if (parts.length > 0) {
            preferencesSection = `
USER PREFERENCES (learned from your meal history):
${parts.join("\n")}
${preferences.transparencyNotes.length > 0 ? `\nNote: ${preferences.transparencyNotes.join(". ")}.` : ""}
These are soft preferences - prioritize them when possible but don't force them if they conflict with the request.
`;
        }
    }

    // Build recent meals section to avoid repetitive suggestions
    let recentMealsSection = "";
    if (recentMeals.length > 0) {
        const mealList = recentMeals
            .slice(0, 20) // Limit to 20 most recent
            .map(m => `- ${m.name}${m.daysAgo === 0 ? " (today)" : m.daysAgo === 1 ? " (yesterday)" : ` (${m.daysAgo} days ago)`}`)
            .join("\n");
        recentMealsSection = `
RECENTLY SUGGESTED RECIPES (avoid repeating these exact meals):
${mealList}

VARIETY RULE: Do NOT suggest these exact recipes again. You CAN use the same ingredients - just make different dishes. For example, if "Honey Garlic Chicken" was suggested recently, you can still suggest other chicken dishes like "Lemon Herb Chicken" or "Chicken Stir Fry".
`;
    }

    // Meal count based on request type
    const isBroadRequest = isBroadMealPlanRequest(prompt);
    let mealCountInstruction: string;
    if (isBroadRequest) {
        mealCountInstruction = isPremium
            ? `EXACT OUTPUT: 2 breakfast (mealType:"breakfast"), 2 lunch (mealType:"lunch"), 2 dinner (mealType:"dinner"), 1 snack (mealType:"snack"). Total: 7 meals. You MUST include all meal types.`
            : `EXACT OUTPUT: 1 breakfast (mealType:"breakfast"), 1 lunch (mealType:"lunch"), 1 dinner (mealType:"dinner"), 1 snack (mealType:"snack"). Total: 4 meals. You MUST include all meal types.`;
    } else {
        mealCountInstruction = `Return 3-4 recipe options matching the request. All recipes should match the meal type the user requested (e.g., if they ask for dinner, return only dinner recipes). If no specific meal type is mentioned, infer the appropriate type from context.`;
    }

    return `You are CartSense, an AI meal planner. Be concise.

TOPIC VALIDATION (FIRST PRIORITY):
Before generating meals, determine if the user's request is related to food, cooking, meals, recipes, nutrition, or grocery shopping.
- If the request is NOT food-related (e.g., health advice, quitting habits, relationship questions, coding help, general life advice, medical conditions not related to diet), respond ONLY with: {"error": "off_topic", "message": "I'm a meal planning assistant. I can help you with recipes, meal ideas, and grocery planning. What would you like to eat?"}
- If the request IS food-related, proceed with meal generation.

RULES: Respect allergies/doctor restrictions (STRICT). Heart-conscious by default. U.S. grocery ingredients.
${allergyWarning}${dislikesGuidance}${cookingGuidance}
${restrictionsText}
${preferencesSection}
${recentMealsSection}
${qualityRulesText}
${pantryModeText}

JSON output:
{"meals":[{"mealType":"breakfast|lunch|dinner|snack","name":"","description":"","servings":N,"macros":{"calories":N,"protein":N,"carbs":N,"fiber":N,"fat":N},"cookTimeRange":{"min":N,"max":N},"ingredients":[{"name":"display name","quantity":"","grocerySearchTerm":"raw product","preparation":""}],"steps":[""]}]}

KEY RULES:
- macros = PER SERVING, not total
- cookTimeRange = estimated cook time in minutes as a range (min to max) accounting for skill variance
  - Simple meals: range of 10-15 min (e.g., {"min":15,"max":25})
  - Moderate meals: range of 15-20 min (e.g., {"min":30,"max":50})
  - Complex meals: range of 20-30 min (e.g., {"min":45,"max":75})
- grocerySearchTerm = raw product (no prep words). "diced onion" → "yellow onion"
- Include seasonings in ingredients
- description: 1 sentence max
- steps: 5-7 steps, written in a warm food blogger style. Be conversational and enthusiastic! Include specific seasoning tips (e.g., "season generously with salt and pepper", "add a pinch of red pepper flakes for heat"). Explain WHY certain techniques matter (e.g., "let the onions caramelize until golden - this builds amazing flavor"). Share little tips like "taste and adjust seasoning as you go!"

CRITICAL - MEAL TYPE DISTRIBUTION:
${mealCountInstruction}${isBroadRequest ? `\nDo NOT return all the same mealType. You must vary the mealType field across meals.` : ``}`;
}

// ---------- Route handler ----------

export async function POST(request: Request) {
    const encoder = new TextEncoder();

    function sendEvent(event: StreamEvent): Uint8Array {
        return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
    }

    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Start processing in the background
    (async () => {
        try {
            const body = await request.json();
            const { prompt, prefs, uid, pantryMode } = body as {
                prompt?: string;
                prefs?: UserPrefs;
                uid?: string;
                pantryMode?: boolean;
            };

            // Validation
            if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
                await writer.write(sendEvent({ type: "error", error: "INVALID_PROMPT", message: "Please describe the kind of meals you want." }));
                await writer.close();
                return;
            }

            if (!isFoodPrompt(prompt)) {
                await writer.write(sendEvent({ type: "error", error: "NOT_FOOD_REQUEST", message: "CartSense is focused on meal ideas and grocery planning." }));
                await writer.close();
                return;
            }

            await writer.write(sendEvent({ type: "status", message: "Checking content..." }));

            // Moderation
            const moderation = await openai.moderations.create({ model: "omni-moderation-latest", input: prompt });
            if (moderation.results?.[0]?.flagged) {
                await writer.write(sendEvent({ type: "error", error: "NOT_ALLOWED", message: "CartSense can't respond to this request." }));
                await writer.close();
                return;
            }

            // Check monthly limit
            let monthlyPromptCount = 0;
            let promptPeriodStart: Date | null = null;
            let needsReset = false;
            let isPremium = false;

            if (uid) {
                const userSnap = await adminDb.collection("users").doc(uid).get();
                if (userSnap.exists) {
                    const userData = userSnap.data() as { monthlyPromptCount?: number; promptPeriodStart?: any; isPremium?: boolean } | undefined;
                    if (userData) {
                        isPremium = userData.isPremium ?? false;
                        monthlyPromptCount = userData.monthlyPromptCount ?? 0;

                        if (userData.promptPeriodStart) {
                            promptPeriodStart = typeof userData.promptPeriodStart.toDate === "function"
                                ? userData.promptPeriodStart.toDate()
                                : new Date(userData.promptPeriodStart);
                        }

                        const now = new Date();
                        if (!promptPeriodStart || (now.getTime() - promptPeriodStart.getTime()) >= THIRTY_DAYS_MS) {
                            needsReset = true;
                            monthlyPromptCount = 0;
                            promptPeriodStart = now;
                        }

                        if (!isPremium && monthlyPromptCount >= FREE_TIER_MONTHLY_LIMIT) {
                            const resetDate = promptPeriodStart ? new Date(promptPeriodStart.getTime() + THIRTY_DAYS_MS) : null;
                            const daysUntilReset = resetDate ? Math.ceil((resetDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : 30;
                            await writer.write(sendEvent({
                                type: "error",
                                error: "PROMPT_LIMIT_REACHED",
                                message: `You've used all ${FREE_TIER_MONTHLY_LIMIT} free meal generations. Resets in ${daysUntilReset} day${daysUntilReset !== 1 ? "s" : ""}.`
                            }));
                            await writer.close();
                            return;
                        }
                    }
                }
            }

            await writer.write(sendEvent({ type: "status", message: "Loading your preferences..." }));

            // Load history, doctor context, family members, learned preferences, and recent meals in parallel
            const [history, doctorContext, familyMembers, userPreferences, recentMeals] = await Promise.all([
                loadUserHistoryForModel(uid),
                loadDoctorInstructions(uid),
                loadActiveFamilyMembers(uid),
                loadUserPreferences(uid),
                loadRecentMealNames(uid),
            ]);

            // Combine all family dietary restrictions
            const combinedRestrictions = combineFamilyRestrictions(prefs ?? null, doctorContext, familyMembers);

            await writer.write(sendEvent({ type: "status", message: "Generating meal ideas..." }));

            // Stream from OpenAI
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                response_format: { type: "json_object" },
                stream: true,
                messages: [
                    { role: "system", content: buildSystemPrompt(prompt, combinedRestrictions, isPremium, Boolean(pantryMode), userPreferences, recentMeals) },
                    { role: "user", content: JSON.stringify({ userPrompt: prompt, prefs: prefs || {}, history, familyRestrictions: combinedRestrictions }) },
                ],
            });

            let fullContent = "";
            for await (const chunk of completion) {
                const delta = chunk.choices[0]?.delta?.content;
                if (delta) {
                    fullContent += delta;
                }
            }

            // Parse the complete response
            let parsed: { meals?: unknown[]; error?: string; message?: string };
            try {
                parsed = JSON.parse(fullContent);
            } catch {
                await writer.write(sendEvent({ type: "error", error: "MODEL_PARSE_ERROR", message: "Failed to parse AI response." }));
                await writer.close();
                return;
            }

            // Handle off-topic queries detected by the AI
            if (parsed.error === "off_topic") {
                await writer.write(sendEvent({
                    type: "error",
                    error: "OFF_TOPIC",
                    message: parsed.message || "I'm a meal planning assistant. Please ask me about recipes, meals, or food!"
                }));
                await writer.close();
                return;
            }

            const rawMeals = Array.isArray(parsed.meals) ? parsed.meals : [];
            let meals: Meal[] = rawMeals.map((m) => normalizeMeal(m));

            // Validate meals against dietary restrictions
            const validatedMeals: Meal[] = [];
            const rejectedMeals: { meal: Meal; violations: string[] }[] = [];

            for (const meal of meals) {
                const validation = validateMealAgainstRestrictions(meal, combinedRestrictions);
                if (validation.isValid) {
                    validatedMeals.push(meal);
                } else {
                    rejectedMeals.push({ meal, violations: validation.violations });
                    console.log(`[VALIDATION] Rejected meal "${meal.name}":`, validation.violations);
                }
            }

            // Update meals to only include validated ones
            meals = validatedMeals;

            if (meals.length === 0) {
                const violationSummary = rejectedMeals.length > 0
                    ? `All generated meals contained restricted ingredients. Please try a different request or check your dietary restrictions.`
                    : "No meals were generated. Please try again.";
                await writer.write(sendEvent({ type: "error", error: "NO_MEALS", message: violationSummary }));
                await writer.close();
                return;
            }

            // Send meals immediately (without images first)
            await writer.write(sendEvent({ type: "status", message: "Preparing your meals..." }));

            for (let i = 0; i < meals.length; i++) {
                await writer.write(sendEvent({ type: "meal", meal: meals[i], index: i }));
            }

            // Log MEAL_GENERATED events for variety tracking (fire and forget)
            if (uid) {
                for (const meal of meals) {
                    void logMealGenerated(uid, meal);
                }
            }

            // Generate images in parallel for all meals, then update
            await writer.write(sendEvent({ type: "status", message: "Creating meal images..." }));

            const imagePromises = meals.map(async (meal, index) => {
                const imageUrl = await getOrGenerateImage(meal);
                const updatedMeal = { ...meal, imageUrl };
                meals[index] = updatedMeal;
                await writer.write(sendEvent({ type: "meal_updated", meal: updatedMeal, index }));
                return updatedMeal;
            });

            await Promise.all(imagePromises);

            // Note: Kroger enrichment is now lazy-loaded when viewing a meal detail page
            // This saves API calls since users may not view all generated meals

            // Update monthly prompt count
            let newMonthlyPromptCount = monthlyPromptCount;
            if (uid) {
                try {
                    const userRef = adminDb.collection("users").doc(uid);
                    if (needsReset) {
                        await userRef.update({ monthlyPromptCount: 1, promptPeriodStart: FieldValue.serverTimestamp() });
                        newMonthlyPromptCount = 1;
                    } else {
                        await userRef.update({ monthlyPromptCount: FieldValue.increment(1) });
                        newMonthlyPromptCount = monthlyPromptCount + 1;
                    }
                } catch {
                    // Ignore count update errors
                }
            }

            // Send final meta
            const now = new Date();
            const resetDate = promptPeriodStart ? new Date(promptPeriodStart.getTime() + THIRTY_DAYS_MS) : null;
            const daysUntilReset = resetDate ? Math.max(0, Math.ceil((resetDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))) : 30;

            await writer.write(sendEvent({
                type: "meta",
                meta: {
                    usedDoctorInstructions: Boolean(doctorContext),
                    blockedIngredientsFromDoctor: doctorContext?.blockedIngredients ?? [],
                    blockedGroupsFromDoctor: doctorContext?.blockedFoodGroups ?? [],
                    monthlyPromptCount: newMonthlyPromptCount,
                    monthlyPromptLimit: FREE_TIER_MONTHLY_LIMIT,
                    daysUntilReset,
                    pantryMode: Boolean(pantryMode),
                },
            }));

            await writer.write(sendEvent({ type: "done" }));
            await writer.close();
        } catch (err) {
            console.error("Stream error:", err);
            try {
                await writer.write(sendEvent({ type: "error", error: "SERVER_ERROR", message: "Something went wrong. Please try again." }));
                await writer.close();
            } catch {
                // Writer might already be closed
            }
        }
    })();

    return new Response(stream.readable, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}