// app/api/meals/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { randomUUID } from "crypto";
import { searchKrogerProduct } from "@/lib/kroger";
import { adminDb } from "@/lib/firebaseAdmin";
import {
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    doc,
    getDoc,
} from "firebase/firestore";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // ✅ FIXED: process.env.OPENAI_API_KEY
});

const ENABLE_KROGER = process.env.ENABLE_KROGER_INTEGRATION === "true";

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

// ---------- Kroger enrichment ----------

const MAX_MEALS_WITH_PRODUCTS = 3;
const MAX_INGREDIENTS_PER_MEAL = 6;

async function enrichMealsWithKroger(meals: Meal[]): Promise<Meal[]> {
    if (!ENABLE_KROGER) {
        console.log("[MEALS] Kroger enrichment disabled via env flag");
        return meals;
    }

    console.log(
        `[MEALS] Enriching up to ${MAX_MEALS_WITH_PRODUCTS} meals with Kroger products`,
    );

    const limitedMeals = meals.slice(0, MAX_MEALS_WITH_PRODUCTS);

    const enrichedMeals = await Promise.all(
        limitedMeals.map(async (meal, mealIndex) => {
            console.log(
                `[MEALS] Enriching meal ${mealIndex + 1}: ${meal.name} (${meal.id})`,
            );
            const enrichedIngredients = await Promise.all(
                meal.ingredients.map(async (ingredient, index) => {
                    if (index >= MAX_INGREDIENTS_PER_MEAL) return ingredient;

                    try {
                        console.log(
                            `[MEALS]  -> searching Kroger for ingredient "${ingredient.name}"`,
                        );
                        const match = await searchKrogerProduct(ingredient.name);

                        if (!match) {
                            console.log(
                                `[MEALS]  -> no Kroger match for "${ingredient.name}"`,
                            );
                            return ingredient;
                        }

                        console.log(
                            `[MEALS]  -> matched Kroger product "${match.name}" (${
                                match.krogerProductId
                            })`,
                        );

                        const enriched: Ingredient = {
                            ...ingredient,
                            krogerProductId: match.krogerProductId,
                            productName: match.name,
                            productImageUrl: match.imageUrl,
                            productSize: match.size,
                            productAisle: match.aisle,
                            price:
                                ingredient.price != null
                                    ? ingredient.price
                                    : match.price ?? undefined,
                            aisle: ingredient.aisle ?? match.aisle ?? ingredient.aisle,
                        };

                        return enriched;
                    } catch (err) {
                        console.error(
                            "[MEALS] Kroger enrichment error for ingredient:",
                            ingredient.name,
                            err,
                        );
                        return ingredient;
                    }
                }),
            );

            return {
                ...meal,
                ingredients: enrichedIngredients,
            };
        }),
    );

    return [...enrichedMeals, ...meals.slice(MAX_MEALS_WITH_PRODUCTS)];
}

// ---------- Image generation (hero images) ----------

const MAX_MEALS_WITH_IMAGES = 3;

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

async function generateImageForMeal(meal: Meal): Promise<string | undefined> {
    if (!process.env.OPENAI_API_KEY) {
        console.warn("⚠️ No OPENAI_API_KEY set, skipping image generation");
        return undefined;
    }

    try {
        const prompt = buildMealImagePrompt(meal);
        console.log("[MEALS] Generating image for meal:", meal.name);

        const result = await openai.images.generate({
            model: "gpt-image-1",
            prompt,
            n: 1,
            size: "1024x1024",
        });

        const url = result.data?.[0]?.url;
        if (!url) {
            console.warn("[MEALS] No image URL returned for meal:", meal.name);
            return undefined;
        }

        console.log("[MEALS] Got image URL for meal:", meal.name, url);
        return url;
    } catch (err: any) {
        console.error("[MEALS] Error generating image for meal:", meal.name);
        console.error("[MEALS]  Status:", err?.status || err?.response?.status);
        console.error("[MEALS]  Data:", err?.response?.data || err);
        return undefined;
    }
}

async function attachImagesToMeals(meals: Meal[]): Promise<Meal[]> {
    if (meals.length === 0) return meals;

    const count = Math.min(MAX_MEALS_WITH_IMAGES, meals.length);
    console.log(
        `[MEALS] Attaching hero images to first ${count} meal(s) (if possible)`,
    );

    const limitedMeals = meals.slice(0, count);

    const mealsWithImages = await Promise.all(
        limitedMeals.map(async (meal, index) => {
            if (meal.imageUrl) {
                console.log(
                    `[MEALS] Meal ${index + 1} already has imageUrl, keeping as-is:`,
                    meal.name,
                );
                return meal;
            }

            let imageUrl = await generateImageForMeal(meal);

            if (!imageUrl) {
                imageUrl = `https://placehold.co/1024x600/cccccc/555555?text=${encodeURIComponent(
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
        const eventsRef = collection(adminDb, "userEvents", uid, "events");
        const q = query(eventsRef, orderBy("createdAt", "desc"), limit(50));
        const snap = await getDocs(q);

        const events: HistoryEventForModel[] = snap.docs.map((docSnap) => {
            const d = docSnap.data() as RawUserEvent;

            const promptSnippet =
                d.prompt && typeof d.prompt === "string"
                    ? d.prompt.slice(0, 140)
                    : null;

            const messageSnippet =
                d.message && typeof d.message === "string"
                    ? d.message.slice(0, 140)
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
        const userRef = doc(adminDb, "users", uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
            console.log("[MEALS]  -> No user doc found for doctor instructions");
            return null;
        }

        const data = snap.data() as { doctorInstructions?: DoctorInstructions };
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

    const systemPrompt = `
You are CartSense, an AI meal planner that suggests realistic meals built from grocery-store ingredients.

Constraints:
- Always respect allergies and sensitivities from the user.
- Always respect doctor-imposed restrictions from the user profile (blocked ingredients and food groups).
- Focus on heart-conscious meals (lower saturated fat, reasonable sodium) by default.
- Include a mix of breakfast, lunch, dinner, and snack options when appropriate.
- Use ingredients that could reasonably be found at Kroger or similar U.S. grocery stores.
- Use the provided "history" of user interactions to infer preferences:
  - Which meal types they save and view
  - How they modify meals (thread messages)
  - Their past prompts
- Subtly bias toward what they seem to like (proteins, meal types, flavor patterns),
  and away from what they often remove or complain about.

${doctorConstraintsText}

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
          "quantity": "string",
          "category": "string (optional)",
          "aisle": "string (optional)",
          "price": number (optional)
        }
      ],
      "steps": ["string", "string"]
    }
  ]
}
No extra keys, no explanations, just JSON.
`.trim();

    const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
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
                        "CartSense can’t respond to this request. Try asking for meal ideas, recipes, or grocery help instead.",
                },
                { status: 400 },
            );
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

        // Optional Kroger enrichment
        if (ENABLE_KROGER && meals.length > 0) {
            console.log("[MEALS] Running Kroger enrichment");
            meals = await enrichMealsWithKroger(meals);
        } else {
            console.log(
                "[MEALS] Skipping Kroger enrichment. ENABLE_KROGER=",
                ENABLE_KROGER,
            );
        }

        // 🖼 Attach hero images (first few meals)
        if (meals.length > 0) {
            console.log("[MEALS] Attaching hero images");
            meals = await attachImagesToMeals(meals);
        } else {
            console.log("[MEALS] No meals to attach images to");
        }

        console.log("[MEALS] Final response meals:", meals.length);

        return NextResponse.json({
            meals,
            meta: {
                usedDoctorInstructions: Boolean(doctorContext),
                blockedIngredientsFromDoctor:
                    doctorContext?.blockedIngredients ?? [],
                blockedGroupsFromDoctor:
                    doctorContext?.blockedFoodGroups ?? [],
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
