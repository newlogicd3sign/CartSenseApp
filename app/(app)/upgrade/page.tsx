"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebaseClient";
import { authFetch } from "@/lib/authFetch";
import { onAuthStateChanged } from "firebase/auth";
import {
    Sparkles,
    Check,
    MessageSquare,
    Camera,
    Bookmark,
    ShoppingCart,
    Zap,
    ArrowLeft,
    Users,
} from "lucide-react";
import { getRandomAccentColor } from "@/lib/utils";

type PlanType = "individual" | "family";
type BillingCycle = "yearly" | "monthly";

const getFeatures = (plan: PlanType) => [
    {
        icon: MessageSquare,
        title: plan === "family" ? "1,500 AI Chat Messages" : "1,000 AI Chat Messages",
        description: "Customize your meals with unlimited AI conversations",
    },
    {
        icon: Camera,
        title: "Diet Instruction Photos",
        description: "Upload diet instructions to filter meal suggestions",
    },
    {
        icon: Bookmark,
        title: "Unlimited Saved Meals",
        description: "Save as many meals as you want for easy access",
    },
    {
        icon: ShoppingCart,
        title: "Unlimited Shopping Lists",
        description: "Create unlimited shopping sessions",
    },
    {
        icon: Zap,
        title: "Priority Generation",
        description: "Faster meal generation during peak times",
    },
];

const plans = [
    {
        id: "individual" as PlanType,
        name: "Individual",
        monthlyPrice: "$9.99",
        yearlyPrice: "$90.00",
        description: "Perfect for single users",
        highlight: false,
        features: null,
    },
    {
        id: "family" as PlanType,
        name: "Household",
        monthlyPrice: "$14.99",
        yearlyPrice: "$135.00",
        description: "For the whole household",
        highlight: true,
        features: [
            "Up to 5 members",
            "Diet instructions per member",
            "Toggle members on/off",
            "One unified grocery list",
            "Plus 500 extra prompts"
        ],
    },
];

export default function UpgradePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<PlanType>("individual");
    const [billingCycle, setBillingCycle] = useState<BillingCycle>("yearly");
    const [user, setUser] = useState<{ uid: string; email: string | null } | null>(null);
    const canceled = searchParams.get("canceled") === "true";

    // Random color for back button
    const backButtonColor = useMemo(() => getRandomAccentColor(), []);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                setUser({ uid: firebaseUser.uid, email: firebaseUser.email });
            }
        });
        return () => unsub();
    }, []);

    const handleUpgrade = async () => {
        if (!user?.email) return;

        setLoading(true);
        try {
            const res = await authFetch("/api/stripe/checkout", {
                method: "POST",
                body: JSON.stringify({
                    email: user.email,
                    plan: selectedPlan,
                    billingCycle: billingCycle,
                }),
            });

            const data = await res.json();

            if (data.url) {
                window.location.href = data.url;
            } else {
                console.error("No checkout URL returned");
                setLoading(false);
            }
        } catch (error) {
            console.error("Checkout error:", error);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-white">
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
                <button
                    onClick={() => router.back()}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:opacity-80 shadow-sm"
                    style={{
                        backgroundColor: `${backButtonColor.primary}15`,
                        color: backButtonColor.dark,
                    }}
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="font-medium">Back</span>
                </button>
            </div>

            {/* Content */}
            <div className="px-6 pb-12">
                {/* Canceled banner */}
                {canceled && (
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-amber-800 text-sm">
                            Checkout was canceled. Feel free to try again when you&apos;re ready.
                        </p>
                    </div>
                )}

                {/* Hero */}
                <div className="text-center mb-8">
                    <div className="inline-flex p-4 bg-violet-100 rounded-full mb-4">
                        <Sparkles className="w-10 h-10 text-violet-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        Upgrade to Premium
                    </h1>
                    <p className="text-gray-600">
                        Unlock all features and get the most out of CartSense
                    </p>
                </div>

                {/* Billing Cycle Toggle */}
                <div className="flex justify-center mb-6">
                    <div className="inline-flex bg-gray-100 rounded-xl p-1">
                        <button
                            onClick={() => setBillingCycle("yearly")}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                billingCycle === "yearly"
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
                            }`}
                        >
                            Yearly
                            <span className="ml-1 text-xs text-green-600 font-semibold">Save 25%</span>
                        </button>
                        <button
                            onClick={() => setBillingCycle("monthly")}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                billingCycle === "monthly"
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
                            }`}
                        >
                            Monthly
                        </button>
                    </div>
                </div>

                {/* Plan Selection */}
                <div className="space-y-3 mb-6">
                    {plans.map((plan) => (
                        <button
                            key={plan.id}
                            onClick={() => setSelectedPlan(plan.id)}
                            className={`relative w-full p-4 rounded-xl border-2 transition-all text-left ${
                                selectedPlan === plan.id
                                    ? "border-violet-600 bg-violet-50"
                                    : "border-gray-200 bg-white hover:border-gray-300"
                            }`}
                        >
                            {plan.highlight && (
                                <span className="absolute -top-2.5 left-4 px-2 py-0.5 bg-violet-600 text-white text-xs font-medium rounded-full">
                                    Best Value
                                </span>
                            )}
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        {plan.id === "family" ? (
                                            <Users className="w-4 h-4 text-violet-600" />
                                        ) : (
                                            <Sparkles className="w-4 h-4 text-violet-600" />
                                        )}
                                        <span className="font-semibold text-gray-900">{plan.name}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mb-2">{plan.description}</p>
                                    {plan.features && (
                                        <ul className="space-y-1">
                                            {plan.features.map((feature, idx) => (
                                                <li key={idx} className="flex items-center gap-2 text-xs text-gray-600">
                                                    <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                                                    {feature}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div className="text-right flex-shrink-0 ml-4">
                                    <div className="flex items-baseline gap-0.5">
                                        <span className="text-2xl font-bold text-gray-900">
                                            {billingCycle === "yearly"
                                                ? `$${(parseFloat(plan.yearlyPrice.replace("$", "")) / 12).toFixed(2)}`
                                                : plan.monthlyPrice}
                                        </span>
                                        <span className="text-gray-500 text-sm">/mo</span>
                                    </div>
                                    {billingCycle === "yearly" && (
                                        <div className="mt-0.5">
                                            <p className="text-xs text-gray-500">
                                                {plan.yearlyPrice}/yr
                                            </p>
                                            <p className="text-xs text-green-600 font-medium">
                                                Save ${((parseFloat(plan.monthlyPrice.replace("$", "")) * 12) - parseFloat(plan.yearlyPrice.replace("$", ""))).toFixed(2)}
                                            </p>
                                        </div>
                                    )}
                                    {selectedPlan === plan.id && (
                                        <div className="mt-1 flex justify-end">
                                            <div className="w-5 h-5 bg-violet-600 rounded-full flex items-center justify-center">
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Features card */}
                <div className="bg-white rounded-2xl shadow-lg shadow-violet-100 border border-violet-100 p-6 mb-8">
                    <p className="text-sm text-gray-500 mb-4">All plans include:</p>

                    {/* Features list */}
                    <div className="space-y-4">
                        {getFeatures(selectedPlan).map((feature, index) => {
                            const Icon = feature.icon;
                            return (
                                <div key={index} className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                                        <Icon className="w-4 h-4 text-violet-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-gray-900 text-sm">
                                            {feature.title}
                                        </h3>
                                        <p className="text-xs text-gray-500">
                                            {feature.description}
                                        </p>
                                    </div>
                                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 ml-auto" />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* CTA Button */}
                <button
                    onClick={handleUpgrade}
                    disabled={loading || !user}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors shadow-lg shadow-violet-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Loading...</span>
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-5 h-5" />
                            <span>Start Premium</span>
                        </>
                    )}
                </button>

                {/* Trust signals */}
                <div className="mt-6 text-center">
                    <p className="text-xs text-gray-400">
                        Secure payment powered by Stripe
                    </p>
                </div>
            </div>
        </div>
    );
}