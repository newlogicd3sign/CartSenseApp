import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/firebaseAdmin";

const PRICE_ID = process.env.STRIPE_PRICE_ID;

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { uid, email } = body as { uid?: string; email?: string };

        if (!uid || !email) {
            return NextResponse.json(
                { error: "Missing uid or email" },
                { status: 400 }
            );
        }

        if (!PRICE_ID) {
            console.error("[STRIPE] Missing STRIPE_PRICE_ID env variable");
            return NextResponse.json(
                { error: "Stripe not configured" },
                { status: 500 }
            );
        }

        // Check if user already has a Stripe customer ID
        const userRef = adminDb.collection("users").doc(uid);
        const userSnap = await userRef.get();
        let stripeCustomerId = userSnap.data()?.stripeCustomerId as string | undefined;

        // Create Stripe customer if they don't have one
        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email,
                metadata: {
                    firebaseUid: uid,
                },
            });
            stripeCustomerId = customer.id;

            // Save customer ID to user doc
            await userRef.set(
                { stripeCustomerId },
                { merge: true }
            );
        }

        // Create checkout session
        const origin = request.headers.get("origin") || "http://localhost:3000";

        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            mode: "subscription",
            payment_method_types: ["card"],
            line_items: [
                {
                    price: PRICE_ID,
                    quantity: 1,
                },
            ],
            success_url: `${origin}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/upgrade?canceled=true`,
            metadata: {
                firebaseUid: uid,
            },
            subscription_data: {
                metadata: {
                    firebaseUid: uid,
                },
            },
        });

        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error("[STRIPE] Checkout error:", error);
        return NextResponse.json(
            { error: "Failed to create checkout session" },
            { status: 500 }
        );
    }
}
