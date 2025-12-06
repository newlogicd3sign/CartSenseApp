"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, Sparkles, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";

export default function UpgradeSuccessPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get("session_id");
    const [showContent, setShowContent] = useState(false);

    useEffect(() => {
        // Trigger confetti animation
        const duration = 2000;
        const end = Date.now() + duration;

        const frame = () => {
            confetti({
                particleCount: 3,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ["#8b5cf6", "#a78bfa", "#c4b5fd"],
            });
            confetti({
                particleCount: 3,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ["#8b5cf6", "#a78bfa", "#c4b5fd"],
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        };

        frame();

        // Show content after a brief delay for dramatic effect
        setTimeout(() => setShowContent(true), 300);
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-white flex items-center justify-center p-6">
            <div
                className={`max-w-md w-full text-center transition-all duration-500 ${
                    showContent
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-4"
                }`}
            >
                {/* Success icon */}
                <div className="relative inline-flex mb-6">
                    <div className="absolute inset-0 bg-green-400 rounded-full blur-xl opacity-30 animate-pulse" />
                    <div className="relative p-4 bg-green-100 rounded-full">
                        <CheckCircle className="w-16 h-16 text-green-500" />
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-2xl font-bold text-gray-900 mb-3">
                    Welcome to Premium!
                </h1>

                <p className="text-gray-600 mb-8">
                    Your subscription is now active. Enjoy unlimited access to all CartSense features.
                </p>

                {/* Benefits reminder */}
                <div className="bg-violet-50 rounded-xl p-4 mb-8 text-left">
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-5 h-5 text-violet-600" />
                        <span className="font-semibold text-violet-900">
                            You now have access to:
                        </span>
                    </div>
                    <ul className="space-y-2 text-sm text-violet-800">
                        <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-violet-600" />
                            1,000 AI chat messages per month
                        </li>
                        <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-violet-600" />
                            Diet instruction photo uploads
                        </li>
                        <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-violet-600" />
                            Unlimited saved meals
                        </li>
                        <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-violet-600" />
                            Unlimited shopping lists
                        </li>
                    </ul>
                </div>

                {/* CTA */}
                <button
                    onClick={() => router.push("/prompt")}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors shadow-lg shadow-violet-200"
                >
                    <span>Start Creating Meals</span>
                    <ArrowRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}