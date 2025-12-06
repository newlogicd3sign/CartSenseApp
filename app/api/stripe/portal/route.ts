import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/firebaseAdmin";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { uid } = body as { uid?: string };

        if (!uid) {
            return NextResponse.json(
                { error: "Missing uid" },
                { status: 400 }
            );
        }

        // Get user's Stripe customer ID
        const userRef = adminDb.collection("users").doc(uid);
        const userSnap = await userRef.get();
        const stripeCustomerId = userSnap.data()?.stripeCustomerId as string | undefined;

        if (!stripeCustomerId) {
            return NextResponse.json(
                { error: "No subscription found" },
                { status: 400 }
            );
        }

        const origin = request.headers.get("origin") || "http://localhost:3000";

        // Create billing portal session
        const session = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: `${origin}/account`,
        });

        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error("[STRIPE] Portal error:", error);
        return NextResponse.json(
            { error: "Failed to create portal session" },
            { status: 500 }
        );
    }
}
