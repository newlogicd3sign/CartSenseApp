// app/api/meals/stream/route.ts
// Streaming endpoint for meal generation - reduces perceived wait time
// Note: Kroger enrichment is lazy-loaded on the meal detail page, not during generation
import OpenAI from "openai";
import { randomUUID, createHash } from "crypto";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { v2 as cloudinary } from "cloudinary";

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
        fat: number;
    };
    ingredients: Ingredient[];
    steps: string[];
    imageUrl?: string;
};

type UserPrefs = {
    dietType?: string;
    allergiesAndSensitivities?: {
        allergies?: string[];
        sensitivities?: string[];
    };
};

type DoctorInstructions = {
    blockedIngredients?: string[];
    blockedFoodGroups?: string[];
    instructionsSummary?: string;
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

    return {
        id: normalizeString(r.id, randomUUID()),
        mealType: safeMealType,
        name: normalizeString(r.name, "Untitled meal"),
        description: normalizeString(r.description, ""),
        servings: Math.max(1, Math.round(normalizeNumber(r.servings, 1))),
        macros: {
            calories: normalizeNumber(macros.calories, 0),
            protein: normalizeNumber(macros.protein, 0),
            carbs: normalizeNumber(macros.carbs, 0),
            fat: normalizeNumber(macros.fat, 0),
        },
        ingredients: ingredientsArray.map((ing) => normalizeIngredient(ing)),
        steps: stepsArray.map((s) => normalizeString(s, "")).filter((s) => s.length > 0),
        imageUrl: typeof r.imageUrl === "string" && r.imageUrl.trim().length > 0 ? r.imageUrl.trim() : undefined,
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

        const data = snap.data() as { doctorInstructions?: DoctorInstructions } | undefined;
        const docInst = data?.doctorInstructions;
        if (!docInst) return null;

        const blockedIngredients = docInst.blockedIngredients?.map((s) => String(s).trim()).filter(Boolean) ?? [];
        const blockedFoodGroups = docInst.blockedFoodGroups?.map((s) => String(s).trim()).filter(Boolean) ?? [];
        const doctorSummary = docInst.instructionsSummary?.trim() || null;

        if (!blockedIngredients.length && !blockedFoodGroups.length && !doctorSummary) return null;

        return { blockedIngredients, blockedFoodGroups, doctorSummary };
    } catch {
        return null;
    }
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

function buildSystemPrompt(prompt: string, doctorContext: DoctorContextForModel | null, isPremium: boolean): string {
    const doctorConstraintsText = doctorContext
        ? `Doctor-imposed restrictions (hard constraints):
- Blocked ingredients: ${doctorContext.blockedIngredients.join(", ") || "None"}
- Blocked food groups: ${doctorContext.blockedFoodGroups.join(", ") || "None"}
- Doctor summary: ${doctorContext.doctorSummary || "None"}
You MUST strictly avoid all blocked ingredients and food groups.`
        : "Doctor-imposed restrictions: None on file.";

    // Detect if this is a broad meal plan or specific recipe search
    const isBroadRequest = isBroadMealPlanRequest(prompt);

    // Different output instructions based on request type
    let mealCountInstruction: string;
    if (isBroadRequest) {
        // Broad meal plan: 1 of each type (free) or 2 of each (premium)
        const mealsPerType = isPremium ? 2 : 1;
        mealCountInstruction = `This is a BROAD meal plan request. Generate exactly ${mealsPerType} breakfast, ${mealsPerType} lunch, ${mealsPerType} dinner, and ${mealsPerType} snack (${mealsPerType * 4} meals total). This gives the user a complete day's worth of meals.`;
    } else {
        // Specific recipe search: give them options of the same type
        mealCountInstruction = `This is a SPECIFIC recipe request. The user is looking for a particular type of dish or ingredient.
Return 3-4 different recipe OPTIONS that match their request.
All recipes can be the same meal type - do NOT force a mix of breakfast/lunch/dinner/snack.
For example, if they ask for "ground turkey recipes", give them 3-4 different ground turkey recipe ideas to choose from.
Pick the most appropriate mealType for what they're asking (e.g., "ground chicken meal" = probably dinner options).`;
    }

    return `You are CartSense, an AI meal planner that suggests realistic meals built from grocery-store ingredients.

Constraints:
- Always respect allergies and sensitivities from the user.
- Always respect doctor-imposed restrictions.
- Focus on heart-conscious meals (lower saturated fat, reasonable sodium) by default.
- Use ingredients that could reasonably be found at Kroger or similar U.S. grocery stores.

OUTPUT INSTRUCTIONS:
${mealCountInstruction}

${doctorConstraintsText}

IMPORTANT RECIPE INSTRUCTIONS:
- Write recipe steps like a friendly food blogger with clear, detailed instructions
- ALWAYS include seasonings and spices with specific measurements (e.g., "1 tsp garlic powder", "1/2 tsp smoked paprika", "salt and pepper to taste")
- Each step should explain the "why" when helpful (e.g., "Sear the chicken for 3-4 minutes until golden brown - this creates a flavorful crust")
- Include prep tips like "dice the onions" or "mince the garlic" in the steps
- For seasoning steps, be specific: "Season both sides of the chicken with 1/2 tsp salt, 1/4 tsp black pepper, and 1/2 tsp garlic powder"
- Include all seasonings and spices in the ingredients list with their quantities

Output JSON ONLY in the shape:
{
  "meals": [
    {
      "id": "string",
      "mealType": "breakfast" | "lunch" | "dinner" | "snack",
      "name": "string",
      "description": "string",
      "servings": number,
      "macros": { "calories": number, "protein": number, "carbs": number, "fat": number },
      "ingredients": [{
        "name": "string (display name with preparation, e.g. 'sliced bananas')",
        "quantity": "string",
        "grocerySearchTerm": "string (clean grocery item to search for, e.g. 'fresh bananas')",
        "preparation": "string (optional prep method: sliced, diced, minced, etc.)"
      }],
      "steps": ["string"]
    }
  ]
}
IMPORTANT:
- The "macros" values (calories, protein, carbs, fat) MUST be for 1 single serving, NOT for the entire recipe.
- The "ingredients" list MUST include all seasonings and spices needed (salt, pepper, garlic powder, herbs, etc.)
- The "steps" should be detailed, numbered instructions written in a warm, conversational food-blogger style

CRITICAL INGREDIENT FORMATTING:
- "name": What to display to the user (e.g., "sliced bananas", "diced onion", "minced garlic")
- "grocerySearchTerm": The actual grocery store product to search for - NO prep words like sliced/diced/minced/chopped. Use the raw ingredient name.
  Examples:
    - If name is "sliced bananas" → grocerySearchTerm should be "fresh bananas"
    - If name is "diced yellow onion" → grocerySearchTerm should be "yellow onion"
    - If name is "minced garlic" → grocerySearchTerm should be "fresh garlic" or "garlic"
    - If name is "shredded mozzarella" → grocerySearchTerm should be "mozzarella cheese"
    - If name is "crushed tomatoes" → grocerySearchTerm should be "crushed tomatoes" (this IS the product)
- "preparation": The prep method (sliced, diced, minced, chopped, etc.) - leave empty if none needed

No extra keys, no explanations, just JSON.`;
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
            const { prompt, prefs, uid } = body as {
                prompt?: string;
                prefs?: UserPrefs;
                uid?: string;
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

            // Load history and doctor context in parallel
            const [history, doctorContext] = await Promise.all([
                loadUserHistoryForModel(uid),
                loadDoctorInstructions(uid),
            ]);

            await writer.write(sendEvent({ type: "status", message: "Generating meal ideas..." }));

            // Stream from OpenAI
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                response_format: { type: "json_object" },
                stream: true,
                messages: [
                    { role: "system", content: buildSystemPrompt(prompt, doctorContext, isPremium) },
                    { role: "user", content: JSON.stringify({ userPrompt: prompt, prefs: prefs || {}, history, doctorInstructions: doctorContext }) },
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
            let parsed: { meals?: unknown[] };
            try {
                parsed = JSON.parse(fullContent);
            } catch {
                await writer.write(sendEvent({ type: "error", error: "MODEL_PARSE_ERROR", message: "Failed to parse AI response." }));
                await writer.close();
                return;
            }

            const rawMeals = Array.isArray(parsed.meals) ? parsed.meals : [];
            const meals: Meal[] = rawMeals.map((m) => normalizeMeal(m));

            if (meals.length === 0) {
                await writer.write(sendEvent({ type: "error", error: "NO_MEALS", message: "No meals were generated. Please try again." }));
                await writer.close();
                return;
            }

            // Send meals immediately (without images first)
            await writer.write(sendEvent({ type: "status", message: "Preparing your meals..." }));

            for (let i = 0; i < meals.length; i++) {
                await writer.write(sendEvent({ type: "meal", meal: meals[i], index: i }));
            }

            // Generate images in parallel for first 3 meals, then update
            await writer.write(sendEvent({ type: "status", message: "Creating meal images..." }));

            const mealsToEnhance = meals.slice(0, 3);
            const imagePromises = mealsToEnhance.map(async (meal, index) => {
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