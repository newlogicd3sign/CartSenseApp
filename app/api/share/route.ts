import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: Request) {
    try {
        const { meal, userId } = await request.json();

        if (!meal || !userId) {
            return NextResponse.json({ error: "Missing meal or user ID" }, { status: 400 });
        }

        // Sanitize meal data strictly for public sharing
        // We only persist what is needed to display/re-create the meal
        const publicMealData = {
            name: meal.name,
            description: meal.description,
            mealType: meal.mealType,
            macros: meal.macros,
            ingredients: meal.ingredients, // Array of ingredients
            steps: meal.steps,
            cookTimeRange: meal.cookTimeRange,
            imageUrl: meal.imageUrl || null,
            servings: meal.servings,
        };

        // Create a new document in 'sharedMeals'
        // We use add() to generate an auto-ID which serves as the shareId
        const docRef = await adminDb.collection("sharedMeals").add({
            originalMealId: meal.id,
            sharerId: userId,
            mealData: publicMealData,
            createdAt: FieldValue.serverTimestamp(),
            // Title and description for metadata previews can be derived from mealData
        });

        return NextResponse.json({
            shareId: docRef.id,
            publicUrl: `/share/${docRef.id}`
        });

    } catch (error: any) {
        console.error("Error creating shared meal:", error);
        return NextResponse.json({
            error: "SERVER_ERROR",
            message: "Failed to create share link."
        }, { status: 500 });
    }
}
