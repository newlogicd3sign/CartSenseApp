import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import OpenAI from "openai";
import { FieldValue } from "firebase-admin/firestore";

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

function buildSystemPrompt(householdSize: number = 1): string {
    return `You are a personalized meal planner.
Your task is to generate a Daily Meal Plan (Breakfast, Lunch, Dinner, Snack) based on the user's previously SAVED MEALS.

GOAL:
Create 4 NEW meals that the user would likely enjoy, based on the patterns, cuisines, and macro profiles of their saved meals.
The new meals should be DISTINCT from the saved meals (do not just copy them), but fit the same vibe.

FEEDBACK HANDLING:
- If LIKED meals are provided: Use them as strong examples of what to generate more of.
- If DISLIKED meals are provided: AVOID similar meals, ingredients, or styles.


RULES:
1. Generate exactly 4 meals: Breakfast, Lunch, Dinner, Snack.
2. Respect implied dietary preferences (e.g. if all saved meals are vegan, suggest vegan).
3. Be creative but practical.
4. Output specific JSON format.
5. servings: Default to ${householdSize} serving${householdSize > 1 ? 's' : ''} (household size) unless context suggests otherwise.
6. INGREDIENT RULES (CRITICAL): 
   - "grocerySearchTerm" MUST be the RAW, UNCOOKED, WHOLE product.
   - NEVER use "cooked", "grilled", "roasted", "baked", "sliced", "diced" in grocerySearchTerm.
   - Example: "Grilled Chicken" -> name: "Grilled Chicken", ingredient: "chicken breast", grocerySearchTerm: "boneless skinless chicken breast".
   - Example: "Diced Tomatoes" -> grocerySearchTerm: "roma tomatoes".
   - Example: "Ground Chicken" -> grocerySearchTerm: "ground chicken" (NOT "chicken breast").
   - Example: "Ground Beef" -> grocerySearchTerm: "ground beef" (NOT "beef").

JSON RESPONSE FORMAT:
{
  "meals": [
    {
      "id": "generated-1",
      "mealType": "breakfast",
      "name": "...",
      "description": "...",
      "servings": ${householdSize},
      "macros": { "calories": 500, "protein": 30, "carbs": 40, "fat": 20, "fiber": 10 },
      "cookTimeRange": { "min": 15, "max": 30 },
      "ingredients": [
        { "name": "display name", "quantity": "...", "grocerySearchTerm": "raw product name" }
      ],
      "steps": ["..."]
    },
    ... (lunch, dinner, snack)
  ]
}
`;
}

export async function POST(request: Request) {
    try {
        const { userId, userTimezoneOffset } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }

        // 1. Check for cached Fresh Picks (valid for 24 hours)
        const userRef = adminDb.collection("users").doc(userId);
        const freshPicksRef = userRef.collection("freshPicks").doc("daily");
        const freshPicksSnap = await freshPicksRef.get();

        const now = new Date();
        // Reset cache at midnight local time if possible, or just 24h expiration
        // For simplicity: 24h expiration from 'generatedAt'
        if (freshPicksSnap.exists) {
            const data = freshPicksSnap.data();
            if (data?.generatedAt) {
                const generatedAt = data.generatedAt.toDate();
                const diffHours = (now.getTime() - generatedAt.getTime()) / (1000 * 60 * 60);

                if (diffHours < 24) {
                    // Fetch feedback created AFTER the cache was generated
                    // This tells us which of these cached meals the user has already acted on
                    const feedbackSnap = await userRef
                        .collection("mealFeedback")
                        .where("timestamp", ">=", data.generatedAt)
                        .get();

                    const actedOnMealNames = new Set(
                        feedbackSnap.docs.map(d => d.data().mealName)
                    );

                    // Filter out meals that have been acted on
                    const remainingMeals = (data.meals || []).filter((m: any) => !actedOnMealNames.has(m.name));

                    console.log(`Serving cached Fresh Picks. Filtered ${data.meals.length - remainingMeals.length} acted-on meals.`);

                    return NextResponse.json({
                        source: "cache",
                        meals: remainingMeals,
                        generatedAt: data.generatedAt,
                    });
                }
            }
        }

        // 2. Fetch User's Saved Meals to separate logic
        const savedMealsSnap = await adminDb
            .collection("savedMeals")
            .doc(userId)
            .collection("meals")
            .orderBy("savedAt", "desc")
            .limit(20)
            .get();

        // 2b. Fetch active family members to calculate household size
        const familyMembersSnap = await adminDb
            .collection("users")
            .doc(userId)
            .collection("familyMembers")
            .where("isActive", "==", true)
            .get();

        const householdSize = 1 + familyMembersSnap.size; // Primary user + active family members

        const savedMeals = savedMealsSnap.docs.map(doc => {
            const data = doc.data();
            return {
                name: data.name,
                description: data.description,
                ingredients: data.ingredients.map((i: any) => i.name).slice(0, 5), // Top 5 ingredients
                macros: data.macros,
                mealType: data.mealType,
            };
        });

        // 3. Check Minimum Requirement (5 meals)
        if (savedMeals.length < 5) {
            return NextResponse.json({
                error: "INSUFFICIENT_DATA",
                currentCount: savedMeals.length,
                neededCount: 5,
                message: "Save at least 5 meals to unlock Fresh Picks."
            }, { status: 422 }); // 422 Unprocessable Entity
        }

        // 3b. Fetch User's Feedback (Likes/Dislikes)
        const feedbackSnap = await adminDb
            .collection("users")
            .doc(userId)
            .collection("mealFeedback")
            .orderBy("timestamp", "desc")
            .limit(50) // Last 50 feedback items
            .get();

        const feedback = feedbackSnap.docs.map(doc => ({
            name: doc.data().mealName,
            action: doc.data().action, // "like" or "dislike"
        }));

        const likedMeals = feedback.filter(f => f.action === "like").map(f => f.name);
        const dislikedMeals = feedback.filter(f => f.action === "dislike").map(f => f.name);

        // 4. Generate with OpenAI
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Cost efficient
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: buildSystemPrompt(householdSize) },
                {
                    role: "user",
                    content: JSON.stringify({
                        savedMealsSummary: savedMeals,
                        feedbackSummary: {
                            liked: likedMeals,
                            disliked: dislikedMeals
                        },
                        instruction: "Generate 4 new distinct meals (Breakfast, Lunch, Dinner, Snack) based on these favorites and feedback."
                    })
                }
            ]
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error("Empty response from AI");
        }

        const parsed = JSON.parse(content);
        if (!parsed.meals || !Array.isArray(parsed.meals)) {
            throw new Error("Invalid JSON structure from AI");
        }

        // Add IDs and timestamp
        const finalMeals = parsed.meals.map((m: any, idx: number) => ({
            ...m,
            id: `fresh-pick-${Date.now()}-${idx}`,
            isFreshPick: true, // Marker for frontend
        }));

        // 5. Cache Results
        await freshPicksRef.set({
            meals: finalMeals,
            generatedAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({
            source: "generated",
            meals: finalMeals,
            generatedAt: new Date(),
        });

    } catch (error: any) {
        console.error("Error in /api/fresh-picks:", error);
        return NextResponse.json({
            error: "SERVER_ERROR",
            message: error.message || "Failed to generate Fresh Picks"
        }, { status: 500 });
    }
}
