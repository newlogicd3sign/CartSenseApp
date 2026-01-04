// app/(app)/api/kroger/store/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyAuth } from "@/lib/authHelper";

export async function POST(request: Request) {
    try {
        // Verify authentication
        const auth = await verifyAuth(request);
        if (!auth.success) return auth.error;
        const userId = auth.userId;

        const body = await request.json();
        const { locationId, name, address } = body;

        if (!locationId) {
            return NextResponse.json(
                { error: "LOCATION_ID_REQUIRED", message: "Location ID is required." },
                { status: 400 }
            );
        }

        // Save location to krogerLocations subcollection
        await adminDb
            .collection("krogerLocations")
            .doc(userId)
            .collection("locations")
            .doc(locationId)
            .set({
                krogerLocationId: locationId,
                name: name || null,
                address: address || null,
                updatedAt: Date.now(),
            }, { merge: true });

        // Set as default location
        await adminDb.collection("users").doc(userId).update({
            defaultKrogerLocationId: locationId,
        });

        return NextResponse.json({
            success: true,
            locationId,
            name,
        });
    } catch (err) {
        console.error("Error saving Kroger store:", err);
        return NextResponse.json(
            { error: "SERVER_ERROR", message: "Failed to save store." },
            { status: 500 }
        );
    }
}
