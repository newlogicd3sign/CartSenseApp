import { NextResponse } from "next/server";
import OpenAI from "openai";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

const db = adminDb;

const FREE_CHAT_MONTHLY_LIMIT = 6;

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
        fat: number;
    };
    ingredients: Ingredient[];
    steps: string[];
};

type UserPrefs = {
    dietType?: string;
    allergiesAndSensitivities?: {
        allergies?: string[];
        sensitivities?: string[];
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
- Respect allergies/sensitivities (STRICT)
- Minimal edits - only change what's needed
- Heart-conscious by default
- If change is major (new recipe), use "new_meal_variant"

JSON response:
{"reply":"explanation","action":"no_change|update_meal|new_meal_variant","updatedMeal":{...if action != no_change}}

updatedMeal shape:
{"id":"","mealType":"breakfast|lunch|dinner|snack","name":"","description":"","servings":N,"macros":{"calories":N,"protein":N,"carbs":N,"fat":N},"ingredients":[{"name":"display","quantity":"","grocerySearchTerm":"raw product","preparation":""}],"steps":[""]}

KEY RULES:
- macros = PER SERVING
- grocerySearchTerm = raw product (no prep words). "diced onion" → "yellow onion"
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
        };

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

        // Optionally you could do some light validation on updatedMeal here

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

        return NextResponse.json({ ...parsed, monthlyChatCount: newMonthlyChatCount }, { status: 200 });
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
