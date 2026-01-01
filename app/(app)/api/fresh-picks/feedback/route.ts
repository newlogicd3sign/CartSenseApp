import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: Request) {
    try {
        const { userId, meal, action } = await request.json();

        if (!userId || !meal || !action) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (action !== "like" && action !== "dislike") {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        // Store feedback in user's subcollection
        await adminDb
            .collection("users")
            .doc(userId)
            .collection("mealFeedback")
            .add({
                mealName: meal.name,
                mealId: meal.id || null, // Might be virtual ID
                action,
                mealData: {
                    name: meal.name,
                    description: meal.description,
                    ingredients: meal.ingredients,
                    mealType: meal.mealType,
                    macros: meal.macros,
                },
                timestamp: FieldValue.serverTimestamp(),
            });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error submitting feedback:", error);
        return NextResponse.json(
            { error: "SERVER_ERROR", message: "Failed to submit feedback" },
            { status: 500 }
        );
    }
}
