import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/firebaseAdmin";
import Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
    console.log("[STRIPE WEBHOOK] Received request");
    console.log("[STRIPE WEBHOOK] webhookSecret exists:", !!webhookSecret);
    console.log("[STRIPE WEBHOOK] webhookSecret starts with:", webhookSecret?.substring(0, 10));

    if (!webhookSecret) {
        console.error("[STRIPE WEBHOOK] Missing STRIPE_WEBHOOK_SECRET");
        return NextResponse.json(
            { error: "Webhook not configured" },
            { status: 500 }
        );
    }

    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature");

    console.log("[STRIPE WEBHOOK] signature exists:", !!signature);

    if (!signature) {
        console.error("[STRIPE WEBHOOK] Missing stripe-signature header");
        return NextResponse.json(
            { error: "Missing signature" },
            { status: 400 }
        );
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
        console.error("[STRIPE WEBHOOK] Signature verification failed:", err);
        return NextResponse.json(
            { error: "Invalid signature" },
            { status: 400 }
        );
    }

    console.log("[STRIPE WEBHOOK] Received event:", event.type);

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                await handleCheckoutCompleted(session);
                break;
            }

            case "customer.subscription.created":
            case "customer.subscription.updated": {
                const subscription = event.data.object as Stripe.Subscription;
                await handleSubscriptionChange(subscription);
                break;
            }

            case "customer.subscription.deleted": {
                const subscription = event.data.object as Stripe.Subscription;
                await handleSubscriptionDeleted(subscription);
                break;
            }

            case "invoice.payment_failed": {
                const invoice = event.data.object as Stripe.Invoice;
                await handlePaymentFailed(invoice);
                break;
            }

            default:
                console.log("[STRIPE WEBHOOK] Unhandled event type:", event.type);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("[STRIPE WEBHOOK] Error processing event:", error);
        return NextResponse.json(
            { error: "Webhook handler failed" },
            { status: 500 }
        );
    }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const firebaseUid = session.metadata?.firebaseUid;

    if (!firebaseUid) {
        console.error("[STRIPE WEBHOOK] No firebaseUid in checkout session metadata");
        return;
    }

    console.log("[STRIPE WEBHOOK] Checkout completed for user:", firebaseUid);

    // The subscription will be activated via subscription.created/updated event
    // But we can also set premium here as a safety measure
    const plan = session.metadata?.plan || "individual";
    const userRef = adminDb.collection("users").doc(firebaseUid);
    await userRef.set(
        {
            isPremium: true,
            planType: plan,
            stripeSubscriptionId: session.subscription,
            premiumSince: new Date(),
            monthlyPromptCount: 0,
            promptPeriodStart: new Date(),
        },
        { merge: true }
    );
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
    const firebaseUid = subscription.metadata?.firebaseUid;

    if (!firebaseUid) {
        // Try to get from customer
        const customer = await stripe.customers.retrieve(subscription.customer as string);
        if (customer.deleted) {
            console.error("[STRIPE WEBHOOK] Customer deleted, cannot process subscription");
            return;
        }
        const uidFromCustomer = customer.metadata?.firebaseUid;
        if (!uidFromCustomer) {
            console.error("[STRIPE WEBHOOK] No firebaseUid in subscription or customer metadata");
            return;
        }
        await updateUserSubscription(uidFromCustomer, subscription);
        return;
    }

    await updateUserSubscription(firebaseUid, subscription);
}

async function updateUserSubscription(uid: string, subscription: Stripe.Subscription) {
    const isActive = subscription.status === "active" || subscription.status === "trialing";
    const plan = subscription.metadata?.plan || "individual";

    console.log("[STRIPE WEBHOOK] Updating subscription for user:", uid, "active:", isActive, "plan:", plan);

    // Get period end from the first subscription item
    const periodEnd = subscription.items?.data?.[0]?.current_period_end;

    const userRef = adminDb.collection("users").doc(uid);
    await userRef.set(
        {
            isPremium: isActive,
            planType: isActive ? plan : "free",
            stripeSubscriptionId: subscription.id,
            stripeSubscriptionStatus: subscription.status,
            ...(periodEnd && { subscriptionCurrentPeriodEnd: new Date(periodEnd * 1000) }),
        },
        { merge: true }
    );
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const firebaseUid = subscription.metadata?.firebaseUid;
    const previousPlan = subscription.metadata?.plan || "individual";

    let uid = firebaseUid;

    if (!uid) {
        // Try to get from customer
        const customer = await stripe.customers.retrieve(subscription.customer as string);
        if (!customer.deleted) {
            uid = customer.metadata?.firebaseUid;
        }
    }

    if (!uid) {
        console.error("[STRIPE WEBHOOK] Cannot find firebaseUid for deleted subscription");
        return;
    }

    console.log("[STRIPE WEBHOOK] Subscription deleted for user:", uid, "previous plan:", previousPlan);

    const userRef = adminDb.collection("users").doc(uid);
    await userRef.set(
        {
            isPremium: false,
            planType: "free",
            previousPlanType: previousPlan,
            stripeSubscriptionStatus: "canceled",
            canceledAt: new Date(),
        },
        { merge: true }
    );
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;

    if (!customerId) {
        console.error("[STRIPE WEBHOOK] No customer in invoice");
        return;
    }

    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
        console.error("[STRIPE WEBHOOK] Customer deleted");
        return;
    }

    const firebaseUid = customer.metadata?.firebaseUid;
    if (!firebaseUid) {
        console.error("[STRIPE WEBHOOK] No firebaseUid in customer metadata");
        return;
    }

    console.log("[STRIPE WEBHOOK] Payment failed for user:", firebaseUid);

    // Optionally mark user as having payment issues
    const userRef = adminDb.collection("users").doc(firebaseUid);
    await userRef.set(
        {
            hasPaymentIssue: true,
            lastPaymentFailure: new Date(),
        },
        { merge: true }
    );
}