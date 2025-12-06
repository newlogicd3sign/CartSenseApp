import Stripe from "stripe";

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
    if (!_stripe) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) {
            throw new Error("Missing STRIPE_SECRET_KEY environment variable");
        }
        _stripe = new Stripe(key, {
            apiVersion: "2025-11-17.clover",
        });
    }
    return _stripe;
}

// Export as a getter to support lazy initialization
export const stripe = new Proxy({} as Stripe, {
    get(_, prop) {
        return getStripe()[prop as keyof Stripe];
    },
});