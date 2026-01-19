// app/(app)/api/kroger/track-click/route.ts
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { incrementKrogerMetric, trackUniqueKrogerUser } from "@/lib/krogerMetrics";

/**
 * POST /api/kroger/track-click
 * Track "Go to Kroger" link clicks for partnership reporting
 */
export async function POST(request: Request) {
    try {
        // Get the authorization header
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json(
                { error: "UNAUTHORIZED", message: "Missing authorization token" },
                { status: 401 }
            );
        }

        const token = authHeader.split("Bearer ")[1];

        // Verify the Firebase ID token
        let uid: string;
        try {
            const decodedToken = await adminAuth.verifyIdToken(token);
            uid = decodedToken.uid;
        } catch {
            return NextResponse.json(
                { error: "UNAUTHORIZED", message: "Invalid authorization token" },
                { status: 401 }
            );
        }

        // Track the click metrics (run in parallel)
        await Promise.all([
            // Always increment total clicks
            incrementKrogerMetric("totalGoToKrogerClicks"),
            // Track unique user (only increments on first click)
            trackUniqueKrogerUser(uid, "clickedGoToKroger"),
        ]);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[TRACK_CLICK] Error:", err);
        return NextResponse.json(
            { error: "SERVER_ERROR", message: "An unexpected error occurred" },
            { status: 500 }
        );
    }
}
