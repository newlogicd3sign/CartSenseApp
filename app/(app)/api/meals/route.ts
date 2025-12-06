// app/api/meals/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { randomUUID, createHash } from "crypto";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // ✅ FIXED: process.env.OPENAI_API_KEY
});

const FREE_TIER_MONTHLY_LIMIT = 10;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// ---------- Types ----------

export type Ingredient = {
    name: string;
    quantity: string;
    category?: string;
    aisle?: string;
    price?: number;
    // Kroger enrichment
    krogerProductId?: string;
    productName?: string;
    productImageUrl?: string;
    productSize?: string;
    productAisle?: string;
};

export type Meal = {
    id: string;
    mealType: "breakfast" | "lunch" | "dinner" | "snack";
    name: string;
    description: string;
    servings: number;
    macros: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
    };
    ingredients: Ingredient[];
    steps: string[];

    // 🖼 Hero image URL for this meal (CartSense-generated)
    imageUrl?: string;
};

type UserPrefs = {
    dietType?: string;
    allergiesAndSensitivities?: {
        allergies?: string[];
        sensitivities?: string[];
    };
    dislikedFoods?: string[];
};

type DoctorInstructions = {
    blockedIngredients?: string[];
    blockedFoodGroups?: string[];
    instructionsSummary?: string;
};

type RawUserEvent = {
    type?:
        | "prompt_submitted"
        | "meal_viewed"
        | "meal_saved"
        | "added_to_shopping_list"
        | "thread_message"
        | string;
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

// ---------- Domain guardrails ----------

const NON_FOOD_KEYWORDS = [
    "sex",
    "sexual",
    "porn",
    "nsfw",
    "onlyfans",
    "dating",
    "relationship advice",
    "breakup",
    "tax",
    "taxes",
    "irs",
    "code this",
    "programming",
    "javascript",
    "typescript",
    "react",
    "python",
    "rust",
    "c++",
    "politics",
    "election",
    "stock tip",
    "crypto trading",
];

function isFoodPrompt(prompt: string): boolean {
    const lower = prompt.toLowerCase();

    for (const blocked of NON_FOOD_KEYWORDS) {
        if (lower.includes(blocked)) return false;
    }

    const foodHints = [
        "meal",
        "meals",
        "dinner",
        "lunch",
        "breakfast",
        "snack",
        "recipe",
        "recipes",
    ];
    return foodHints.some((w) => lower.includes(w));
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
    const r = raw as {
        name?: unknown;
        quantity?: unknown;
        category?: unknown;
        aisle?: unknown;
        price?: unknown;
        krogerProductId?: unknown;
        productName?: unknown;
        productImageUrl?: unknown;
        productSize?: unknown;
        productAisle?: unknown;
    };

    const priceValue =
        r.price != null && Number.isFinite(Number(r.price))
            ? Number(r.price)
            : undefined;

    return {
        name: normalizeString(r.name, "Unknown ingredient"),
        quantity: normalizeString(r.quantity, ""),
        category: r.category ? String(r.category) : undefined,
        aisle: r.aisle ? String(r.aisle) : undefined,
        price: priceValue,
        krogerProductId:
            typeof r.krogerProductId === "string" ? r.krogerProductId : undefined,
        productName:
            typeof r.productName === "string" ? r.productName : undefined,
        productImageUrl:
            typeof r.productImageUrl === "string"
                ? r.productImageUrl
                : undefined,
        productSize:
            typeof r.productSize === "string" ? r.productSize : undefined,
        productAisle:
            typeof r.productAisle === "string" ? r.productAisle : undefined,
    };
}

function normalizeMeal(raw: unknown): Meal {
    const r = raw as {
        id?: unknown;
        mealType?: unknown;
        name?: unknown;
        description?: unknown;
        servings?: unknown;
        macros?: {
            calories?: unknown;
            protein?: unknown;
            carbs?: unknown;
            fat?: unknown;
        };
        ingredients?: unknown;
        steps?: unknown;
        imageUrl?: unknown;
    };

    const mealTypeStr = normalizeString(r.mealType, "dinner").toLowerCase();
    const safeMealType: Meal["mealType"] =
        mealTypeStr === "breakfast" ||
        mealTypeStr === "lunch" ||
        mealTypeStr === "snack"
            ? (mealTypeStr as Meal["mealType"])
            : "dinner";

    const ingredientsArray = Array.isArray(r.ingredients) ? r.ingredients : [];
    const stepsArray = Array.isArray(r.steps) ? r.steps : [];

    return {
        id: normalizeString(r.id, randomUUID()),
        mealType: safeMealType,
        name: normalizeString(r.name, "Untitled meal"),
        description: normalizeString(r.description, ""),
        servings: Math.max(1, Math.round(normalizeNumber(r.servings, 1))),
        macros: {
            calories: normalizeNumber(r.macros?.calories, 0),
            protein: normalizeNumber(r.macros?.protein, 0),
            carbs: normalizeNumber(r.macros?.carbs, 0),
            fat: normalizeNumber(r.macros?.fat, 0),
        },
        ingredients: ingredientsArray.map((ing) => normalizeIngredient(ing)),
        steps: stepsArray
            .map((s) => normalizeString(s, ""))
            .filter((s) => s.length > 0),
        imageUrl:
            typeof r.imageUrl === "string" && r.imageUrl.trim().length > 0
                ? r.imageUrl.trim()
                : undefined,
    };
}

function normalizeMealsFromModel(aiMeals: unknown): Meal[] {
    if (!Array.isArray(aiMeals)) return [];
    return aiMeals.map((m) => normalizeMeal(m));
}

function messageContentToString(content: unknown): string {
    if (typeof content === "string") return content;

    if (Array.isArray(content)) {
        return content
            .map((part) => {
                if (typeof part === "string") return part;
                if (typeof part === "object" && part !== null) {
                    const maybeText = (part as { text?: unknown }).text;
                    if (typeof maybeText === "string") return maybeText;
                }
                return "";
            })
            .join("");
    }

    return "";
}

// ---------- Image generation (hero images) with Firestore caching ----------

const MAX_MEALS_WITH_IMAGES = 3;
const IMAGE_CACHE_COLLECTION = "mealImageCache";
const IMAGE_CACHE_TTL_DAYS = 30; // Cache images for 30 days

function buildMealImagePrompt(meal: Meal): string {
    const ingredientNames = meal.ingredients.map((i) => i.name).join(", ");

    return `
High-quality food photography of a single plated dish.
Meal: ${meal.name}
Type: ${meal.mealType}
Key ingredients: ${ingredientNames || "typical grocery ingredients"}

Style: bright natural lighting, top-down angle, realistic, appetizing, no text, no logos, simple background.
`.trim();
}

// Generate a stable cache key based on meal name and top ingredients
function getMealImageCacheKey(meal: Meal): string {
    const topIngredients = meal.ingredients
        .slice(0, 5)
        .map((i) => i.name.toLowerCase().trim())
        .sort()
        .join(",");
    const keySource = `${meal.name.toLowerCase().trim()}|${meal.mealType}|${topIngredients}`;
    return createHash("sha256").update(keySource).digest("hex").slice(0, 32);
}

// Check Firestore cache for existing image
async function getCachedImage(cacheKey: string): Promise<string | null> {
    try {
        const docRef = adminDb.collection(IMAGE_CACHE_COLLECTION).doc(cacheKey);
        const snap = await docRef.get();

        if (!snap.exists) {
            return null;
        }

        const data = snap.data() as { imageUrl?: string; createdAt?: any } | undefined;
        if (!data?.imageUrl) {
            return null;
        }

        // Check if cache is expired
        if (data.createdAt) {
            const createdAt = typeof data.createdAt.toDate === "function"
                ? data.createdAt.toDate()
                : new Date(data.createdAt);
            const ageMs = Date.now() - createdAt.getTime();
            const maxAgeMs = IMAGE_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

            if (ageMs > maxAgeMs) {
                console.log(`[MEALS] Cache expired for key ${cacheKey}`);
                return null;
            }
        }

        console.log(`[MEALS] Cache HIT for image key ${cacheKey}`);
        return data.imageUrl;
    } catch (err) {
        console.error("[MEALS] Error checking image cache:", err);
        return null;
    }
}

// Store generated image in Firestore cache
async function cacheImage(cacheKey: string, imageUrl: string, mealName: string): Promise<void> {
    try {
        const docRef = adminDb.collection(IMAGE_CACHE_COLLECTION).doc(cacheKey);
        await docRef.set({
            imageUrl,
            mealName,
            createdAt: FieldValue.serverTimestamp(),
        });
        console.log(`[MEALS] Cached image for "${mealName}" with key ${cacheKey}`);
    } catch (err) {
        console.error("[MEALS] Error caching image:", err);
        // Non-blocking, continue even if cache write fails
    }
}

async function generateImageForMeal(meal: Meal): Promise<string | undefined> {
    if (!process.env.OPENAI_API_KEY) {
        console.warn("⚠️ No OPENAI_API_KEY set, skipping image generation");
        return undefined;
    }

    try {
        const prompt = buildMealImagePrompt(meal);
        console.log("[MEALS] Generating thumbnail image for meal:", meal.name);

        // Using DALL-E 2 with 256x256 for much lower cost (~$0.016 vs $0.04-0.08 for DALL-E 3)
        const result = await openai.images.generate({
            model: "dall-e-2",
            prompt,
            n: 1,
            size: "256x256",
        });

        const url = result.data?.[0]?.url;
        if (!url) {
            console.warn("[MEALS] No image URL returned for meal:", meal.name);
            return undefined;
        }

        console.log("[MEALS] Got thumbnail URL for meal:", meal.name, url);
        return url;
    } catch (err: any) {
        console.error("[MEALS] Error generating image for meal:", meal.name);
        console.error("[MEALS]  Status:", err?.status || err?.response?.status);
        console.error("[MEALS]  Data:", err?.response?.data || err);
        return undefined;
    }
}

// Get or generate image for a meal (with caching)
async function getOrGenerateImage(meal: Meal): Promise<string | undefined> {
    const cacheKey = getMealImageCacheKey(meal);

    // Check cache first
    const cachedUrl = await getCachedImage(cacheKey);
    if (cachedUrl) {
        return cachedUrl;
    }

    // Generate new image
    const imageUrl = await generateImageForMeal(meal);

    // Cache the result (non-blocking)
    if (imageUrl) {
        cacheImage(cacheKey, imageUrl, meal.name).catch(() => {
            // Ignore cache write errors
        });
    }

    return imageUrl;
}

async function attachImagesToMeals(meals: Meal[]): Promise<Meal[]> {
    if (meals.length === 0) return meals;

    const count = Math.min(MAX_MEALS_WITH_IMAGES, meals.length);
    console.log(
        `[MEALS] Attaching hero images to first ${count} meal(s) in PARALLEL with caching`,
    );

    const limitedMeals = meals.slice(0, count);

    // Generate all images in parallel (with caching)
    const mealsWithImages = await Promise.all(
        limitedMeals.map(async (meal, index) => {
            if (meal.imageUrl) {
                console.log(
                    `[MEALS] Meal ${index + 1} already has imageUrl, keeping as-is:`,
                    meal.name,
                );
                return meal;
            }

            let imageUrl = await getOrGenerateImage(meal);

            if (!imageUrl) {
                imageUrl = `https://placehold.co/256x256/cccccc/555555?text=${encodeURIComponent(
                    meal.name,
                )}`;
                console.log(
                    `[MEALS] Using placeholder image for meal ${index + 1}:`,
                    meal.name,
                );
            }

            return {
                ...meal,
                imageUrl,
            };
        }),
    );

    return [...mealsWithImages, ...meals.slice(count)];
}

// ---------- Learning profile v1: load user history ----------

async function loadUserHistoryForModel(
    uid?: string,
): Promise<HistoryEventForModel[]> {
    if (!uid) return [];

    try {
        console.log("[MEALS] Loading user history for uid:", uid);
        const eventsRef = adminDb.collection("userEvents").doc(uid).collection("events");
        const snap = await eventsRef.orderBy("createdAt", "desc").limit(50).get();

        const events: HistoryEventForModel[] = snap.docs.map((docSnap) => {
            const d = docSnap.data() as RawUserEvent;

            const promptSnippet =
                d.prompt && typeof d.prompt === "string"
                    ? d.prompt
                    : null;

            const messageSnippet =
                d.message && typeof d.message === "string"
                    ? d.message
                    : null;

            return {
                type: d.type ?? "unknown",
                mealId: d.mealId ?? null,
                promptSnippet,
                messageSnippet,
            };
        });

        console.log("[MEALS] Loaded", events.length, "history events for model");
        return events;
    } catch (err) {
        console.error("[MEALS] Error loading user history:", err);
        return [];
    }
}

// ---------- Doctor instructions: load from users/{uid} ----------

async function loadDoctorInstructions(
    uid?: string,
): Promise<DoctorContextForModel | null> {
    if (!uid) return null;

    try {
        console.log("[MEALS] Loading doctor instructions for uid:", uid);
        const userRef = adminDb.collection("users").doc(uid);
        const snap = await userRef.get();
        if (!snap.exists) {
            console.log("[MEALS]  -> No user doc found for doctor instructions");
            return null;
        }

        const data = snap.data() as { doctorInstructions?: DoctorInstructions } | undefined;
        if (!data) return null;
        const docInst = data.doctorInstructions;

        if (!docInst) {
            console.log("[MEALS]  -> No doctorInstructions field on user doc");
            return null;
        }

        const blockedIngredients =
            docInst.blockedIngredients
                ?.map((s) => String(s).trim())
                .filter(Boolean) ?? [];
        const blockedFoodGroups =
            docInst.blockedFoodGroups
                ?.map((s) => String(s).trim())
                .filter(Boolean) ?? [];
        const doctorSummary =
            docInst.instructionsSummary &&
            docInst.instructionsSummary.trim().length > 0
                ? docInst.instructionsSummary.trim()
                : null;

        if (
            blockedIngredients.length === 0 &&
            blockedFoodGroups.length === 0 &&
            !doctorSummary
        ) {
            console.log(
                "[MEALS]  -> Doctor instructions present but empty; ignoring",
            );
            return null;
        }

        console.log(
            "[MEALS] Loaded doctor instructions:",
            blockedIngredients,
            blockedFoodGroups,
            doctorSummary,
        );

        return {
            blockedIngredients,
            blockedFoodGroups,
            doctorSummary,
        };
    } catch (err) {
        console.error("[MEALS] Error loading doctor instructions:", err);
        return null;
    }
}

// ---------- OpenAI calls ----------

async function runModeration(prompt: string): Promise<boolean> {
    console.log("[MEALS] Running moderation on prompt");
    const moderation = await openai.moderations.create({
        model: "omni-moderation-latest",
        input: prompt,
    });

    const firstResult = moderation.results?.[0];
    const flagged = Boolean(firstResult?.flagged);
    console.log("[MEALS] Moderation flagged:", flagged);
    return flagged;
}

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
            console.log("[MEALS] Detected specific ingredient request:", lower);
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
            console.log("[MEALS] Detected broad meal plan request:", lower);
            return true;
        }
    }

    // Check for generic "meal ideas" without specific ingredients
    if (lower.includes("meal ideas") && !hasSpecificIngredient) {
        console.log("[MEALS] Detected generic meal ideas request:", lower);
        return true;
    }

    // Default: if no broad pattern matched, treat as specific request
    console.log("[MEALS] Defaulting to specific request:", lower);
    return false;
}

async function generateMealsFromModel(
    prompt: string,
    prefs: UserPrefs,
    history: HistoryEventForModel[],
    doctorContext: DoctorContextForModel | null,
): Promise<unknown[]> {
    console.log("[MEALS] Calling model with prompt:", prompt);
    console.log("[MEALS] Prefs:", prefs);
    console.log(
        "[MEALS] History events passed to model:",
        history.length,
    );
    console.log(
        "[MEALS] Doctor context present:",
        Boolean(doctorContext),
    );

    // Detect request type
    const isBroadRequest = isBroadMealPlanRequest(prompt);
    console.log("[MEALS] Is broad meal plan request:", isBroadRequest);

    const doctorConstraintsText = doctorContext
        ? `
Doctor-imposed restrictions (hard constraints):
- Blocked ingredients (MUST NOT appear as ingredients or in dish names): ${
            doctorContext.blockedIngredients.length
                ? doctorContext.blockedIngredients.join(", ")
                : "None listed"
        }
- Blocked food groups / patterns (MUST NOT appear as ingredients or in dish names): ${
            doctorContext.blockedFoodGroups.length
                ? doctorContext.blockedFoodGroups.join(", ")
                : "None listed"
        }
- Doctor summary: ${
            doctorContext.doctorSummary ??
            "Doctor note provided but no summary string."
        }

You MUST strictly avoid all blocked ingredients and avoid dishes that clearly match blocked food groups or patterns.
`.trim()
        : `
Doctor-imposed restrictions:
- None currently on file for this user.
`.trim();

    const dislikedFoodsText = prefs.dislikedFoods?.length
        ? `
User's disliked foods (avoid using these ingredients when possible):
- ${prefs.dislikedFoods.join(", ")}
These are preferences, not allergies. Avoid these ingredients unless the user specifically requests them.
`.trim()
        : "";

    // Different instructions based on request type
    const outputInstructions = isBroadRequest
        ? `
OUTPUT QUANTITY:
This is a BROAD meal plan request. Return exactly 4 meals:
- 1 breakfast
- 1 lunch
- 1 dinner
- 1 snack
This gives the user a complete day's worth of meals.`
        : `
OUTPUT QUANTITY:
This is a SPECIFIC recipe request. The user is looking for a particular type of dish or ingredient.
Return 3-4 different recipe OPTIONS that match their request (all can be the same meal type).
For example, if they ask for "ground turkey recipes", give them 3-4 different ground turkey recipe ideas to choose from.
Do NOT force a mix of breakfast/lunch/dinner/snack - just give them multiple variations of what they asked for.`;

    const systemPrompt = `
You are CartSense, an AI meal planner that suggests realistic meals built from grocery-store ingredients.

Constraints:
- Always respect allergies and sensitivities from the user.
- Always respect doctor-imposed restrictions from the user profile (blocked ingredients and food groups).
- Avoid using ingredients the user has marked as disliked (preference, not allergy).
- Focus on heart-conscious meals (lower saturated fat, reasonable sodium) by default.
- Use ingredients that could reasonably be found at Kroger or similar U.S. grocery stores.
- Use the provided "history" of user interactions to infer preferences:
  - Which meal types they save and view
  - How they modify meals (thread messages)
  - Their past prompts
- Subtly bias toward what they seem to like (proteins, meal types, flavor patterns),
  and away from what they often remove or complain about.

${outputInstructions}

${doctorConstraintsText}

${dislikedFoodsText}

Output JSON ONLY in the shape:
{
  "meals": [
    {
      "id": "string",
      "mealType": "breakfast" | "lunch" | "dinner" | "snack",
      "name": "string",
      "description": "string",
      "servings": number,
      "macros": {
        "calories": number,
        "protein": number,
        "carbs": number,
        "fat": number
      },
      "ingredients": [
        {
          "name": "string",
          "quantity": "string"
        }
      ],
      "steps": ["string", "string"]
    }
  ]
}
IMPORTANT: The "macros" values (calories, protein, carbs, fat) MUST be for 1 single serving, NOT for the entire recipe.
No extra keys, no explanations, just JSON.
`.trim();

    const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
            {
                role: "system",
                content: systemPrompt,
            },
            {
                role: "user",
                content: JSON.stringify({
                    userPrompt: prompt,
                    prefs,
                    history,
                    doctorInstructions: doctorContext,
                }),
            },
        ],
    });

    const firstChoice = completion.choices[0];
    const content = firstChoice?.message?.content;

    const text = messageContentToString(content);

    if (!text) {
        console.error("[MEALS] MODEL_EMPTY_RESPONSE");
        throw new Error("MODEL_EMPTY_RESPONSE");
    }

    let parsed: unknown;

    try {
        parsed = JSON.parse(text);
    } catch (err) {
        console.error("[MEALS] JSON parse error from OpenAI:", err, text);
        throw new Error("MODEL_PARSE_ERROR");
    }

    const obj = parsed as { meals?: unknown };
    const aiMeals = Array.isArray(obj.meals) ? obj.meals : [];
    console.log("[MEALS] Model returned", aiMeals.length, "meal(s)");
    return aiMeals;
}

// ---------- Route handler ----------

export async function POST(request: Request) {
    console.log("========== /api/meals POST ==========");
    try {
        const body = await request.json();
        const { prompt, prefs, uid } = body as {
            prompt?: string;
            prefs?: UserPrefs;
            uid?: string;
        };

        console.log("[MEALS] Incoming body:", {
            prompt,
            prefs,
            uid,
        });

        if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
            console.warn("[MEALS] INVALID_PROMPT");
            return NextResponse.json(
                {
                    error: "INVALID_PROMPT",
                    message: "Please describe the kind of meals you want.",
                },
                { status: 400 },
            );
        }

        // Domain filter – clearly non-food prompts
        if (!isFoodPrompt(prompt)) {
            console.warn("[MEALS] NOT_FOOD_REQUEST for prompt:", prompt);
            return NextResponse.json(
                {
                    error: "NOT_FOOD_REQUEST",
                    message:
                        "CartSense is focused on meal ideas and grocery planning. Try something like “heart-healthy chicken dinners” or “high-protein lunches under 600 calories.”",
                },
                { status: 400 },
            );
        }

        // Moderation
        const flagged = await runModeration(prompt);
        if (flagged) {
            console.warn("[MEALS] Prompt blocked by moderation");
            return NextResponse.json(
                {
                    error: "NOT_ALLOWED",
                    message:
                        "CartSense can't respond to this request. Try asking for meal ideas, recipes, or grocery help instead.",
                },
                { status: 400 },
            );
        }

        // Check monthly prompt limit for free users
        let monthlyPromptCount = 0;
        let promptPeriodStart: Date | null = null;
        let needsReset = false;

        if (uid) {
            const userRef = adminDb.collection("users").doc(uid);
            const userSnap = await userRef.get();
            if (userSnap.exists) {
                const userData = userSnap.data() as {
                    monthlyPromptCount?: number;
                    promptPeriodStart?: any;
                    isPremium?: boolean;
                } | undefined;

                if (userData) {
                    const isPremium = userData.isPremium ?? false;
                    monthlyPromptCount = userData.monthlyPromptCount ?? 0;

                    // Get the period start date
                    if (userData.promptPeriodStart) {
                        if (typeof userData.promptPeriodStart.toDate === "function") {
                            promptPeriodStart = userData.promptPeriodStart.toDate();
                        } else if (userData.promptPeriodStart instanceof Date) {
                            promptPeriodStart = userData.promptPeriodStart;
                        }
                    }

                    // Check if period is older than 30 days and needs reset
                    const now = new Date();
                    if (!promptPeriodStart || (now.getTime() - promptPeriodStart.getTime()) >= THIRTY_DAYS_MS) {
                        console.log("[MEALS] Resetting monthly prompt count - period expired or not set");
                        needsReset = true;
                        monthlyPromptCount = 0;
                        promptPeriodStart = now;
                    }

                    // Check limit for non-premium users
                    if (!isPremium && monthlyPromptCount >= FREE_TIER_MONTHLY_LIMIT) {
                        console.warn("[MEALS] User has reached monthly free tier limit:", uid);

                        // Calculate days until reset
                        const resetDate = promptPeriodStart ? new Date(promptPeriodStart.getTime() + THIRTY_DAYS_MS) : null;
                        const daysUntilReset = resetDate ? Math.ceil((resetDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : 30;

                        return NextResponse.json(
                            {
                                error: "PROMPT_LIMIT_REACHED",
                                message: `You've used all ${FREE_TIER_MONTHLY_LIMIT} free meal generations for this month. Your limit resets in ${daysUntilReset} day${daysUntilReset !== 1 ? "s" : ""}.`,
                                monthlyPromptCount,
                                monthlyPromptLimit: FREE_TIER_MONTHLY_LIMIT,
                                promptPeriodStart: promptPeriodStart?.toISOString() ?? null,
                                daysUntilReset,
                            },
                            { status: 403 },
                        );
                    }
                }
            }
        }

        // 🔍 Load user history (learning profile input)
        const history = await loadUserHistoryForModel(uid);

        // 🔍 Load doctor instructions (if any)
        const doctorContext = await loadDoctorInstructions(uid);

        // Generate meals via OpenAI
        const aiMeals = await generateMealsFromModel(
            prompt,
            prefs || {},
            history,
            doctorContext,
        );
        let meals = normalizeMealsFromModel(aiMeals);
        console.log("[MEALS] After normalization:", meals.length, "meal(s)");

        // 🖼 Attach hero images (first few meals)
        if (meals.length > 0) {
            console.log("[MEALS] Attaching hero images");
            meals = await attachImagesToMeals(meals);
        } else {
            console.log("[MEALS] No meals to attach images to");
        }

        console.log("[MEALS] Final response meals:", meals.length);

        // Increment monthly prompt count after successful generation
        let newMonthlyPromptCount = monthlyPromptCount;
        if (uid && meals.length > 0) {
            try {
                const userRef = adminDb.collection("users").doc(uid);

                if (needsReset) {
                    // Reset period and set count to 1
                    await userRef.update({
                        monthlyPromptCount: 1,
                        promptPeriodStart: FieldValue.serverTimestamp(),
                    });
                    newMonthlyPromptCount = 1;
                    console.log("[MEALS] Reset period and set monthly prompt count to 1 for user:", uid);
                } else {
                    // Just increment
                    await userRef.update({
                        monthlyPromptCount: FieldValue.increment(1),
                    });
                    newMonthlyPromptCount = monthlyPromptCount + 1;
                    console.log("[MEALS] Incremented monthly prompt count for user:", uid, "->", newMonthlyPromptCount);
                }
            } catch (err) {
                console.error("[MEALS] Error updating monthly prompt count:", err);
            }
        }

        // Calculate days until reset for response
        const now = new Date();
        const resetDate = promptPeriodStart ? new Date(promptPeriodStart.getTime() + THIRTY_DAYS_MS) : null;
        const daysUntilReset = resetDate ? Math.max(0, Math.ceil((resetDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))) : 30;

        return NextResponse.json({
            meals,
            meta: {
                usedDoctorInstructions: Boolean(doctorContext),
                blockedIngredientsFromDoctor:
                    doctorContext?.blockedIngredients ?? [],
                blockedGroupsFromDoctor:
                    doctorContext?.blockedFoodGroups ?? [],
                monthlyPromptCount: newMonthlyPromptCount,
                monthlyPromptLimit: FREE_TIER_MONTHLY_LIMIT,
                promptPeriodStart: promptPeriodStart?.toISOString() ?? null,
                daysUntilReset,
            },
        });
    } catch (err) {
        console.error("🔥 Error in /api/meals:", err);

        if (err instanceof Error && err.message === "MODEL_PARSE_ERROR") {
            return NextResponse.json(
                {
                    error: "MODEL_PARSE_ERROR",
                    message:
                        "CartSense had trouble reading the AI response. Please try again.",
                },
                { status: 500 },
            );
        }

        if (err instanceof Error && err.message === "MODEL_EMPTY_RESPONSE") {
            return NextResponse.json(
                {
                    error: "MODEL_EMPTY_RESPONSE",
                    message:
                        "CartSense did not receive a usable response from the model. Please try again.",
                },
                { status: 500 },
            );
        }

        return NextResponse.json(
            {
                error: "SERVER_ERROR",
                message:
                    "Something went wrong generating meals. Please try again.",
            },
            { status: 500 },
        );
    }
}
