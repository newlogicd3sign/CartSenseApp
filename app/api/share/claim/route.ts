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

        const { shareId } = await request.json();

        if (!shareId) {
            return NextResponse.json({ error: "Missing shareId" }, { status: 400 });
        }

        // 1. Fetch the shared meal doc
        const sharedDocRef = adminDb.collection("sharedMeals").doc(shareId);
        const sharedDocSnap = await sharedDocRef.get();

        if (!sharedDocSnap.exists) {
            return NextResponse.json({ error: "NOT_FOUND", message: "This shared meal no longer exists." }, { status: 404 });
        }

        const sharedData = sharedDocSnap.data();
        const mealData = sharedData?.mealData;

        if (!mealData) {
            return NextResponse.json({ error: "INVALID_DATA", message: "Shared meal data is corrupted." }, { status: 422 });
        }

        // 2. Save it to the user's savedMeals collection
        const userSavedMealsRef = adminDb.collection("savedMeals").doc(userId).collection("meals");

        // Optional: Check if we already saved this exact meal (by name/sharer)?
        // For simplicity now, we just add it as new. Duplicate names are allowed.

        const newMealDoc = await userSavedMealsRef.add({
            ...mealData,
            savedAt: FieldValue.serverTimestamp(),
            source: "shared_link",
            originalShareId: shareId,
            sharerId: sharedData.sharerId // Keep track of who shared it
        });

        return NextResponse.json({
            success: true,
            newMealId: newMealDoc.id
        });

    } catch (error: any) {
        console.error("Error claiming shared meal:", error);
        return NextResponse.json({
            error: "SERVER_ERROR",
            message: "Failed to save the shared meal."
        }, { status: 500 });
    }
}
