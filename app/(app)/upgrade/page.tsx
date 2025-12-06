"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebaseClient";
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
} from "lucide-react";

const features = [
    {
        icon: MessageSquare,
        title: "1,000 AI Chat Messages",
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

export default function UpgradePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<{ uid: string; email: string | null } | null>(null);
    const canceled = searchParams.get("canceled") === "true";

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
            const res = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    uid: user.uid,
                    email: user.email,
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
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="text-sm font-medium">Back</span>
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

                {/* Pricing card */}
                <div className="bg-white rounded-2xl shadow-lg shadow-violet-100 border border-violet-100 p-6 mb-8">
                    <div className="flex items-baseline gap-1 mb-2">
                        <span className="text-4xl font-bold text-gray-900">$9.99</span>
                        <span className="text-gray-500">/month</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-6">Cancel anytime</p>

                    {/* Features list */}
                    <div className="space-y-4">
                        {features.map((feature, index) => {
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