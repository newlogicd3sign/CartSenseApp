import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/firebaseAdmin";

const PRICE_IDS = {
    individual: {
        monthly: process.env.STRIPE_PRICE_ID_INDIVIDUAL_MONTHLY || process.env.STRIPE_PRICE_ID,
        yearly: process.env.STRIPE_PRICE_ID_INDIVIDUAL_YEARLY,
    },
    family: {
        monthly: process.env.STRIPE_PRICE_ID_FAMILY_MONTHLY || process.env.STRIPE_PRICE_ID_FAMILY,
        yearly: process.env.STRIPE_PRICE_ID_FAMILY_YEARLY,
    },
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { uid, email, plan = "individual", billingCycle = "yearly" } = body as {
            uid?: string;
            email?: string;
            plan?: "individual" | "family";
            billingCycle?: "monthly" | "yearly";
        };

        if (!uid || !email) {
            return NextResponse.json(
                { error: "Missing uid or email" },
                { status: 400 }
            );
        }

        const priceId = PRICE_IDS[plan]?.[billingCycle];
        if (!priceId) {
            console.error(`[STRIPE] Missing price ID for plan: ${plan}, billingCycle: ${billingCycle}`);
            return NextResponse.json(
                { error: "Stripe not configured for this plan" },
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
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${origin}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/upgrade?canceled=true`,
            metadata: {
                firebaseUid: uid,
                plan,
                billingCycle,
            },
            subscription_data: {
                metadata: {
                    firebaseUid: uid,
                    plan,
                    billingCycle,
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
