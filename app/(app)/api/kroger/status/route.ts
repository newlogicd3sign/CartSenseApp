// app/(app)/api/kroger/status/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return NextResponse.json(
                { error: "USER_ID_REQUIRED", message: "User ID is required." },
                { status: 400 }
            );
        }

        // Get user document
        const userDocSnap = await adminDb.collection("users").doc(userId).get();
        const userData = userDocSnap.data();

        if (!userData) {
            return NextResponse.json({
                linked: false,
                hasStore: false,
            });
        }

        const krogerLinked = userData.krogerLinked === true;
        const defaultKrogerLocationId = userData.defaultKrogerLocationId;

        console.log("Kroger status check - krogerLinked:", krogerLinked, "defaultKrogerLocationId:", defaultKrogerLocationId);

        if (!krogerLinked) {
            return NextResponse.json({
                linked: false,
                hasStore: false,
                debug: { krogerLinked: userData.krogerLinked, defaultKrogerLocationId }
            });
        }

        // Check if user has any locations in the subcollection
        const locationsSnap = await adminDb
            .collection("krogerLocations")
            .doc(userId)
            .collection("locations")
            .get();

        const locations = locationsSnap.docs;
        const hasLocations = locations.length > 0;

        // Check if defaultKrogerLocationId is valid
        let hasValidStore = false;

        if (defaultKrogerLocationId && hasLocations) {
            // Check if the stored ID matches any actual location
            // Note: locations store the ID in field "krogerLocationId"
            const locationExists = locations.some(
                (loc) => loc.data().krogerLocationId === defaultKrogerLocationId
            );

            if (locationExists) {
                hasValidStore = true;
            } else {
                // Stale ID - update to first available location
                console.log("Detected stale defaultKrogerLocationId, updating to first location...");
                const firstLocation = locations[0].data();
                await adminDb.collection("users").doc(userId).update({
                    defaultKrogerLocationId: firstLocation.krogerLocationId,
                });
                hasValidStore = true;
            }
        } else if (defaultKrogerLocationId && !hasLocations) {
            // User has a defaultKrogerLocationId but no locations - clear it
            console.log("Detected stale defaultKrogerLocationId with no locations, clearing...");
            await adminDb.collection("users").doc(userId).update({
                defaultKrogerLocationId: null,
            });
            hasValidStore = false;
        } else if (!defaultKrogerLocationId && hasLocations) {
            // User has locations but no default - set to first
            console.log("No defaultKrogerLocationId but has locations, setting first...");
            const firstLocation = locations[0].data();
            await adminDb.collection("users").doc(userId).update({
                defaultKrogerLocationId: firstLocation.krogerLocationId,
            });
            hasValidStore = true;
        }

        return NextResponse.json({
            linked: true,
            hasStore: hasValidStore,
            locationCount: locations.length,
        });
    } catch (err) {
        console.error("Error checking Kroger status:", err);
        return NextResponse.json(
            { error: "SERVER_ERROR", message: "An unexpected error occurred." },
            { status: 500 }
        );
    }
}