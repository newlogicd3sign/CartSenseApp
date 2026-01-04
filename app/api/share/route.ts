import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuth } from "@/lib/authHelper";

export async function POST(request: Request) {
    try {
        // Verify authentication
        const auth = await verifyAuth(request);
        if (!auth.success) return auth.error;
        const userId = auth.userId;

        const { meal } = await request.json();

        if (!meal) {
            return NextResponse.json({ error: "Missing meal data" }, { status: 400 });
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
