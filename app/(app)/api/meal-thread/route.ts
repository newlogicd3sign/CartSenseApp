import { NextResponse } from "next/server";
import OpenAI from "openai";

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
    meal: Meal;
    prefs?: UserPrefs;
    message: string;
    history?: ThreadMessage[];
    originalPrompt?: string;
};

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
You are CartSense, an AI meal editor that helps users customize ONE specific meal.

You will be given:
- The current meal as JSON ("meal")
- The user's dietary preferences and allergies as JSON ("prefs")
- The original prompt that generated this meal ("originalPrompt") - use this to understand the user's goals
- Previous conversation history ("history") - use this for context on what was already discussed
- The user's latest message describing what they want to change ("message")

Your job:
- Understand what the user is asking (e.g., swap ingredients, change cooking method, change servings, reduce sodium, make it dairy-free, etc.)
- Consider the original prompt and conversation history to maintain consistency with the user's original goals
- Modify the meal ONLY as much as needed to satisfy the request and stay within their preferences
- Return both:
  - A natural-language explanation to show in chat ("reply")
  - An updated meal object, if changes are needed

Rules:
- You MUST respect allergies and sensitivities: do NOT introduce restricted ingredients.
- Keep meals realistic and cookable in a home kitchen.
- Default to heart-conscious choices (reasonable saturated fat and sodium) unless the user clearly asks otherwise.
- If the user asks for an impossible or unsafe change, explain why and do not change the meal.
- Prefer minimal edits. For example:
  - If they say "swap chicken for ground turkey", change the protein + macros accordingly, but keep the rest of the recipe if it still makes sense.
- If the change is so large that it is basically a NEW recipe (e.g. "turn this into a vegetarian chili"), then consider this a NEW VARIANT.
- Use the conversation history to avoid repeating yourself or asking questions that were already answered.

IMPORTANT RECIPE INSTRUCTIONS:
- Write recipe steps like a friendly food blogger with clear, detailed instructions
- ALWAYS include seasonings and spices with specific measurements (e.g., "1 tsp garlic powder", "1/2 tsp smoked paprika", "salt and pepper to taste")
- Each step should explain the "why" when helpful (e.g., "Sear the chicken for 3-4 minutes until golden brown - this creates a flavorful crust")
- Include prep tips like "dice the onions" or "mince the garlic" in the steps
- For seasoning steps, be specific: "Season both sides of the chicken with 1/2 tsp salt, 1/4 tsp black pepper, and 1/2 tsp garlic powder"
- Include all seasonings and spices in the ingredients list with their quantities

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

You MUST respond with JSON ONLY in this exact shape:

{
  "reply": string,
  "action": "no_change" | "update_meal" | "new_meal_variant",
  "updatedMeal"?: Meal
}

Where:
- "reply" is what we will show as the assistant chat bubble.
- "action":
  - "no_change" → you are just explaining something; do NOT include updatedMeal.
  - "update_meal" → small modifications to the existing meal; include updatedMeal.
  - "new_meal_variant" → substantial changes that create a new version; include updatedMeal.
- "updatedMeal", if present, must follow this TypeScript shape:

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
  ingredients: {
    name: string;
    quantity: string;
    grocerySearchTerm?: string;
    preparation?: string;
    category?: string;
    aisle?: string;
    price?: number;

    krogerProductId?: string;
    productName?: string;
    productImageUrl?: string;
    productSize?: string;
    productAisle?: string;
  }[];
  steps: string[];  // Detailed, food-blogger style instructions with specific seasoning measurements
}

IMPORTANT:
- The "macros" values (calories, protein, carbs, fat) MUST be for 1 single serving, NOT for the entire recipe.
- The "ingredients" list MUST include all seasonings and spices needed (salt, pepper, garlic powder, herbs, etc.)
- The "steps" should be detailed instructions written in a warm, conversational food-blogger style
- Always include "grocerySearchTerm" for each ingredient to enable accurate grocery product matching

DO NOT include any extra text outside of this JSON. No markdown, no commentary, just JSON.
`.trim();

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as ThreadRequestBody;

        const { meal, prefs, message, history, originalPrompt } = body;

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

        return NextResponse.json(parsed, { status: 200 });
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
