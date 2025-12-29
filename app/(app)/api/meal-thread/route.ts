import { NextResponse } from "next/server";
import OpenAI from "openai";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import type { FoodEventType, FoodEventContext, FoodEventPayload } from "@/types/preferences";

const db = adminDb;

// Helper to normalize ingredient key for preference tracking
function normalizeIngredientKey(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/^[\d./-]+\s*/, "")
        .replace(/^(fresh|dried|ground|minced|chopped|diced|sliced|whole|organic|large|medium|small|extra|virgin|raw|cooked|frozen|canned|boneless|skinless|lean)\s+/gi, "")
        .replace(/,.*$/, "")
        .replace(/\s*\([^)]*\)/g, "")
        .replace(/[\s-]+/g, "_")
        .replace(/[^a-z0-9_]/g, "")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
}

// Server-side food event logger
async function logFoodEventServer(
    userId: string,
    type: FoodEventType,
    mealId?: string,
    payload?: FoodEventPayload,
    mealType?: string
): Promise<void> {
    try {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();

        const mealTime = mealType || (
            hour >= 5 && hour < 11 ? "breakfast" :
                hour >= 11 && hour < 15 ? "lunch" :
                    hour >= 17 && hour < 21 ? "dinner" : "snack"
        );

        const context: FoodEventContext = {
            mealTime: mealTime as FoodEventContext["mealTime"],
            dayType: day === 0 || day === 6 ? "weekend" : "weekday",
        };

        const eventDoc = {
            createdAt: FieldValue.serverTimestamp(),
            type,
            mealId: mealId || null,
            source: "prompt" as const,
            context,
            payload: payload || {},
            clientEventId: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        };

        const eventsCol = db.collection("foodEvents").doc(userId).collection("events");
        await eventsCol.add(eventDoc);
    } catch (err) {
        console.error("logFoodEventServer error:", err);
    }
}

const FREE_CHAT_MONTHLY_LIMIT = 6;

// Sensitivity keywords mapping for post-validation
const SENSITIVITY_KEYWORDS: Record<string, string[]> = {
    "dairy": ["milk", "cheese", "yogurt", "butter", "cream", "whey", "casein", "ghee", "ricotta", "mozzarella", "cheddar", "parmesan"],
    "eggs": ["egg", "eggs", "mayonnaise", "mayo"],
    "fish": ["fish", "salmon", "tuna", "cod", "tilapia", "halibut", "trout", "sardine", "anchovy"],
    "shellfish": ["shrimp", "crab", "lobster", "clam", "mussel", "oyster", "scallop", "prawn", "calamari"],
    "peanuts": ["peanut", "peanuts", "peanut butter"],
    "tree nuts": ["almond", "walnut", "cashew", "pecan", "pistachio", "macadamia", "hazelnut"],
    "wheat/gluten": ["bread", "pasta", "flour", "wheat", "gluten", "noodle", "couscous"],
    "soy": ["soy", "tofu", "tempeh", "edamame", "miso"],
    "sesame": ["sesame", "tahini"],
    "red meat": ["beef", "steak", "pork", "lamb", "bacon", "ham", "sausage", "ribs", "brisket", "veal", "venison"],
    "lactose": ["milk", "cream", "ice cream", "soft cheese", "yogurt"],
    "gluten sensitivity": ["bread", "pasta", "flour", "wheat", "noodle", "couscous"],
};

type DietaryViolation = {
    ingredientName: string;
    violationType: "allergy" | "sensitivity" | "doctor_blocked";
    restriction: string;
};

// Validate meal ingredients against user restrictions
function validateMealIngredients(
    ingredients: { name: string }[],
    allergies: string[],
    sensitivities: string[],
    doctorBlockedIngredients?: string[]
): DietaryViolation[] {
    const violations: DietaryViolation[] = [];

    for (const ingredient of ingredients) {
        const ingredientLower = ingredient.name.toLowerCase();

        // Check allergies
        for (const allergy of allergies) {
            const allergyLower = allergy.toLowerCase();
            const keywords = SENSITIVITY_KEYWORDS[allergyLower] || [allergyLower];

            for (const keyword of keywords) {
                if (ingredientLower.includes(keyword)) {
                    violations.push({
                        ingredientName: ingredient.name,
                        violationType: "allergy",
                        restriction: allergy
                    });
                    break;
                }
            }
        }

        // Check sensitivities
        for (const sensitivity of sensitivities) {
            const sensitivityLower = sensitivity.toLowerCase();
            const keywords = SENSITIVITY_KEYWORDS[sensitivityLower] || [sensitivityLower];

            for (const keyword of keywords) {
                if (ingredientLower.includes(keyword)) {
                    violations.push({
                        ingredientName: ingredient.name,
                        violationType: "sensitivity",
                        restriction: sensitivity
                    });
                    break;
                }
            }
        }

        // Check doctor-blocked ingredients
        if (doctorBlockedIngredients) {
            for (const blocked of doctorBlockedIngredients) {
                if (ingredientLower.includes(blocked.toLowerCase())) {
                    violations.push({
                        ingredientName: ingredient.name,
                        violationType: "doctor_blocked",
                        restriction: blocked
                    });
                }
            }
        }
    }

    return violations;
}

// These types mirror what you're already using in /api/meals and MealDetailPage

type Ingredient = {
    name: string;
    quantity: string;
    category?: string;
    aisle?: string;
    price?: number;

    // Kroger enrichment fields (optional)
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
    cookTimeRange?: {
        min: number;
        max: number;
    };
};

type UserPrefs = {
    dietType?: string;
    allergiesAndSensitivities?: {
        allergies?: string[];
        sensitivities?: string[];
    };
    dislikedFoods?: string[];
    doctorDietInstructions?: {
        hasActiveNote?: boolean;
        blockedIngredients?: string[];
        blockedGroups?: string[];
    };
};

type MealThreadReply = {
    reply: string;
    action: "no_change" | "update_meal" | "new_meal_variant";
    updatedMeal?: Meal;
};

type ThreadMessage = {
    role: "user" | "assistant";
    content: string;
};

type ThreadRequestBody = {
    userId: string;
    meal: Meal;
    prefs?: UserPrefs;
    message: string;
    history?: ThreadMessage[];
    originalPrompt?: string;
};

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are CartSense, an AI meal editor. Customize the given meal based on user requests.

RULES:
- Respect allergies/sensitivities/dislikes (STRICT)
- Minimal edits - only change what's needed for simple fixes. HOWEVER:
- ALWAYS fulfill explicit user requests (e.g. "make it spicy", "add protein", "create a variant"). NEVER refuse a request because "no modifications are needed". If the user wants a change, MAKE IT.
- If the user asks for a "variant", change at least 2-3 significant ingredients or the cooking method to feel distinct while keeping the core concept.
- Heart-conscious by default
- If change is major (new recipe), use "new_meal_variant"
- IMPORTANT: Be semantic about dislikes. If someone dislikes "tomatoes", they typically still enjoy tomato sauce, ketchup, or cooked tomato products. If they dislike "mushrooms", they mean whole mushrooms, not mushroom powder/extract in sauces. Apply common sense.

JSON response:
{"reply":"explanation","action":"no_change|update_meal|new_meal_variant","updatedMeal":{...if action != no_change}}

updatedMeal shape:
{"id":"","mealType":"breakfast|lunch|dinner|snack","name":"","description":"","servings":N,"macros":{"calories":N,"protein":N,"carbs":N,"fiber":N,"fat":N},"cookTimeRange":{"min":N,"max":N},"ingredients":[{"name":"display","quantity":"","grocerySearchTerm":"raw product","preparation":""}],"steps":[""]}

KEY RULES:
- macros = PER SERVING
- cookTimeRange = estimated cook time in minutes as a range (min to max) accounting for skill variance
- grocerySearchTerm: MUST be the RAW, UNCOOKED, WHOLE product. NEVER use "cooked", "grilled", "roasted", "baked", "sliced", "diced" here. "diced onion" -> "yellow onion", "cooked chicken" -> "boneless skinless chicken breast".
- Include all seasonings with measurements
- Steps: detailed, food-blogger style`;

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as ThreadRequestBody;

        const { userId, meal, prefs, message, history, originalPrompt } = body;

        if (!userId || typeof userId !== "string") {
            return NextResponse.json(
                { error: "INVALID_USER", message: "Missing or invalid 'userId'." },
                { status: 400 },
            );
        }

        if (!meal || typeof meal !== "object") {
            return NextResponse.json(
                { error: "INVALID_MEAL", message: "Missing or invalid 'meal'." },
                { status: 400 },
            );
        }

        if (!message || typeof message !== "string" || !message.trim()) {
            return NextResponse.json(
                {
                    error: "INVALID_MESSAGE",
                    message: "Please describe what you want to change about this meal.",
                },
                { status: 400 },
            );
        }

        // Check chat quota for free users
        const userRef = db.collection("users").doc(userId);
        const userSnap = await userRef.get();
        const userData = userSnap.data() as {
            isPremium?: boolean;
            monthlyChatCount?: number;
            chatPeriodStart?: FirebaseFirestore.Timestamp;
        } | undefined;

        const isPremium = userData?.isPremium ?? false;
        let monthlyChatCount = userData?.monthlyChatCount ?? 0;
        const chatPeriodStart = userData?.chatPeriodStart;

        // Check if period has expired (30 days)
        if (chatPeriodStart) {
            const periodStartDate = chatPeriodStart.toDate();
            const now = new Date();
            const daysSinceStart = (now.getTime() - periodStartDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceStart >= 30) {
                // Reset the period
                monthlyChatCount = 0;
            }
        }

        // Check limit for free users
        if (!isPremium && monthlyChatCount >= FREE_CHAT_MONTHLY_LIMIT) {
            return NextResponse.json(
                {
                    error: "CHAT_LIMIT_REACHED",
                    message: "You've used all 6 free chat messages this month. Upgrade to Premium for unlimited chat.",
                    monthlyChatCount,
                },
                { status: 403 },
            );
        }

        const safePrefs: UserPrefs = {
            dietType: prefs?.dietType,
            allergiesAndSensitivities: {
                allergies: prefs?.allergiesAndSensitivities?.allergies ?? [],
                sensitivities:
                    prefs?.allergiesAndSensitivities?.sensitivities ?? [],
            },
            dislikedFoods: prefs?.dislikedFoods ?? [],
        };

        // Extract doctor instructions for validation
        const doctorBlockedIngredients = prefs?.doctorDietInstructions?.blockedIngredients ?? [];

        // Build conversation history for OpenAI (limit to last 5 exchanges to keep costs low)
        const safeHistory = Array.isArray(history) ? history.slice(-10) : [];
        const historyMessages: { role: "user" | "assistant"; content: string }[] = safeHistory
            .filter((msg) => msg.role === "user" || msg.role === "assistant")
            .map((msg) => ({
                role: msg.role,
                content: msg.content,
            }));

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: SYSTEM_PROMPT,
                },
                // First message: context with meal, prefs, and original prompt
                {
                    role: "user",
                    content: JSON.stringify({
                        meal,
                        prefs: safePrefs,
                        originalPrompt: originalPrompt || null,
                        history: historyMessages.length > 0
                            ? historyMessages.map(m => `${m.role}: ${m.content}`).join("\n")
                            : null,
                        message: message.trim(),
                    }),
                },
            ],
        });

        const content = completion.choices[0]?.message?.content;

        if (!content) {
            return NextResponse.json(
                {
                    error: "MODEL_EMPTY_RESPONSE",
                    message:
                        "CartSense did not receive a usable response. Please try again.",
                },
                { status: 500 },
            );
        }

        let parsed: MealThreadReply;
        try {
            parsed = JSON.parse(content) as MealThreadReply;
        } catch (err) {
            console.error("JSON parse error from OpenAI (meal-thread):", err, content);
            return NextResponse.json(
                {
                    error: "MODEL_PARSE_ERROR",
                    message:
                        "CartSense had trouble reading the AI response. Please try again.",
                },
                { status: 500 },
            );
        }

        if (!parsed.reply || typeof parsed.reply !== "string") {
            return NextResponse.json(
                {
                    error: "INVALID_MODEL_REPLY",
                    message:
                        "CartSense did not return a valid reply. Please try again.",
                },
                { status: 500 },
            );
        }

        if (
            parsed.action !== "no_change" &&
            parsed.action !== "update_meal" &&
            parsed.action !== "new_meal_variant"
        ) {
            return NextResponse.json(
                {
                    error: "INVALID_MODEL_ACTION",
                    message:
                        "CartSense returned an invalid action. Please try again.",
                },
                { status: 500 },
            );
        }

        // Validate updated meal against dietary restrictions
        let dietaryWarnings: DietaryViolation[] = [];
        if (parsed.updatedMeal && parsed.updatedMeal.ingredients) {
            dietaryWarnings = validateMealIngredients(
                parsed.updatedMeal.ingredients,
                safePrefs.allergiesAndSensitivities?.allergies || [],
                safePrefs.allergiesAndSensitivities?.sensitivities || [],
                doctorBlockedIngredients
            );

            if (dietaryWarnings.length > 0) {
                console.log("[MEAL-THREAD] Dietary violations found in updated meal:", dietaryWarnings);
            }
        }

        // Increment chat count for free users after successful response
        let newMonthlyChatCount = monthlyChatCount;
        if (!isPremium) {
            if (!chatPeriodStart || monthlyChatCount === 0) {
                // Start a new period
                await userRef.update({
                    monthlyChatCount: 1,
                    chatPeriodStart: FieldValue.serverTimestamp(),
                });
                newMonthlyChatCount = 1;
            } else {
                await userRef.update({
                    monthlyChatCount: FieldValue.increment(1),
                });
                newMonthlyChatCount = monthlyChatCount + 1;
            }
        }

        // Log food events for preference learning when meal is edited
        if (parsed.action === "update_meal" || parsed.action === "new_meal_variant") {
            // Log MEAL_EDITED event
            void logFoodEventServer(userId, "MEAL_EDITED", meal.id, {}, meal.mealType);

            // Detect ingredient changes if we have an updated meal
            if (parsed.updatedMeal) {
                const originalIngredients = new Set(meal.ingredients.map((i) => normalizeIngredientKey(i.name)));
                const newIngredients = new Set(parsed.updatedMeal.ingredients.map((i) => normalizeIngredientKey(i.name)));

                // Find removed ingredients
                for (const ingredientKey of originalIngredients) {
                    if (!newIngredients.has(ingredientKey)) {
                        const original = meal.ingredients.find(
                            (i) => normalizeIngredientKey(i.name) === ingredientKey
                        );
                        void logFoodEventServer(userId, "INGREDIENT_REMOVED", meal.id, {
                            ingredientKey,
                            ingredientText: original?.name,
                        }, meal.mealType);
                    }
                }

                // Find added ingredients
                for (const ingredientKey of newIngredients) {
                    if (!originalIngredients.has(ingredientKey)) {
                        const added = parsed.updatedMeal.ingredients.find(
                            (i) => normalizeIngredientKey(i.name) === ingredientKey
                        );
                        void logFoodEventServer(userId, "INGREDIENT_ADDED", meal.id, {
                            ingredientKey,
                            ingredientText: added?.name,
                        }, meal.mealType);
                    }
                }
            }
        }

        return NextResponse.json({
            ...parsed,
            monthlyChatCount: newMonthlyChatCount,
            dietaryWarnings: dietaryWarnings.length > 0 ? dietaryWarnings : undefined,
        }, { status: 200 });
    } catch (error) {
        console.error("Error in /api/meal-thread:", error);
        return NextResponse.json(
            {
                error: "SERVER_ERROR",
                message:
                    "Something went wrong updating this meal. Please try again.",
            },
            { status: 500 },
        );
    }
}
