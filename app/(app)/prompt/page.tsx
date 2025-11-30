"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { logUserEvent } from "@/lib/logUserEvent";
import { Sparkles, Send, AlertCircle } from "lucide-react";

type MealsMeta = {
    usedDoctorInstructions?: boolean;
    blockedIngredientsFromDoctor?: string[];
    blockedGroupsFromDoctor?: string[];
};

type MealsApiResponse = {
    meals?: any[];
    meta?: MealsMeta;
    error?: string;
    message?: string;
};

const foodGreetings = [
    "What's cooking today",
    "Ready to whip up something delicious",
    "Let's plan your next tasty meal",
    "Hungry for inspiration",
    "Time to get cooking",
    "What's on the menu today",
    "Let's make something amazing",
    "Craving something good",
];

const loadingMessages = [
    "Preheating the oven...",
    "Gathering fresh ingredients...",
    "Checking the pantry...",
    "Mixing flavors together...",
    "Seasoning to perfection...",
    "Simmering ideas...",
    "Taste testing recipes...",
    "Plating your options...",
    "Adding a pinch of creativity...",
    "Whisking up something special...",
];

function getRandomGreeting() {
    return foodGreetings[Math.floor(Math.random() * foodGreetings.length)];
}

export default function PromptPage() {
    const router = useRouter();

    const [user, setUser] = useState<User | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [name, setName] = useState("");
    const [userPrefs, setUserPrefs] = useState<any>(null);
    const [greeting, setGreeting] = useState("");

    const [prompt, setPrompt] = useState("");
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [monthlyPromptCount, setMonthlyPromptCount] = useState(0);
    const [monthlyPromptLimit] = useState(10);
    const [daysUntilReset, setDaysUntilReset] = useState(30);
    const [isPremium, setIsPremium] = useState(false);

    useEffect(() => {
        setGreeting(getRandomGreeting());
    }, []);

    // Rotate loading messages while submitting
    useEffect(() => {
        if (!submitting) {
            setLoadingMessage("");
            return;
        }

        // Set initial message
        setLoadingMessage(loadingMessages[Math.floor(Math.random() * loadingMessages.length)]);

        const interval = setInterval(() => {
            setLoadingMessage(loadingMessages[Math.floor(Math.random() * loadingMessages.length)]);
        }, 2500);

        return () => clearInterval(interval);
    }, [submitting]);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                router.push("/login");
            } else {
                setUser(firebaseUser);

                const ref = doc(db, "users", firebaseUser.uid);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data();
                    setName(data.name || "");
                    setUserPrefs(data);
                    setIsPremium(data.isPremium ?? false);

                    // Calculate monthly prompt usage
                    let count = data.monthlyPromptCount ?? 0;
                    let periodStart = data.promptPeriodStart;

                    // Check if period needs reset (30 days)
                    if (periodStart) {
                        const startDate = typeof periodStart.toDate === "function"
                            ? periodStart.toDate()
                            : new Date(periodStart);
                        const now = new Date();
                        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

                        if (now.getTime() - startDate.getTime() >= thirtyDaysMs) {
                            // Period expired, show as reset
                            count = 0;
                            setDaysUntilReset(30);
                        } else {
                            // Calculate days until reset
                            const resetDate = new Date(startDate.getTime() + thirtyDaysMs);
                            const days = Math.max(0, Math.ceil((resetDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
                            setDaysUntilReset(days);
                        }
                    }

                    setMonthlyPromptCount(count);
                }
            }
            setLoadingUser(false);
        });

        return () => unsub();
    }, [router]);

    const handleSubmit = async () => {
        const trimmed = prompt.trim();

        if (!trimmed) {
            setMessage("Please enter what kind of meals you want.");
            return;
        }

        if (!user) {
            setMessage("Please log in again to generate meals.");
            return;
        }

        setMessage("");
        setSubmitting(true);

        try {
            const res = await fetch("/api/meals", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    prompt: trimmed,
                    prefs: userPrefs,
                    uid: user.uid,
                }),
            });

            const data = (await res.json()) as MealsApiResponse;

            if (!res.ok) {
                if (
                    data?.error === "NOT_FOOD_REQUEST" ||
                    data?.error === "OUT_OF_DOMAIN"
                ) {
                    setMessage(
                        data.message ||
                        "CartSense can only help with meals, recipes, nutrition and grocery planning. Try something like \"heart-healthy dinners with chicken\" or \"high-protein lunches under 600 calories\"."
                    );
                    setPrompt("");
                } else if (data?.error === "NOT_ALLOWED") {
                    setMessage(
                        data.message ||
                        "CartSense can't respond to this request. Try asking for meal ideas, recipes, or grocery help instead."
                    );
                    setPrompt("");
                } else {
                    setMessage(
                        data.message || data.error || "Failed to generate meals."
                    );
                }
                return;
            }

            const meals = data.meals || [];
            const payloadToStore = {
                meals,
                meta: data.meta,
            };

            sessionStorage.setItem(
                "generatedMeals",
                JSON.stringify(payloadToStore)
            );

            logUserEvent(user.uid, {
                type: "prompt_submitted",
                prompt: trimmed,
            }).catch((err) => {
                console.error("Failed to log prompt_submitted event:", err);
            });

            router.push(`/meals?prompt=${encodeURIComponent(trimmed)}`);
        } catch (err: any) {
            console.error(err);
            setMessage("Error connecting to meals API");
        } finally {
            setSubmitting(false);
        }
    };

    if (loadingUser) {
        return (
            <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-3 border-gray-200 border-t-[#4A90E2] rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-500">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafb]">
            {/* Main Content */}
            <div className="px-6 pt-8 lg:pt-12">
                <div className="max-w-2xl mx-auto">
                    {/* Greeting */}
                    <div className="mb-6">
                        <h1 className="text-2xl lg:text-3xl font-medium text-gray-900 mb-1">
                            {greeting}{name ? `, ${name}` : ""}?
                        </h1>
                    </div>

                    {/* Search Card */}
                    <div className="bg-white rounded-2xl shadow-lg p-5 mb-6">
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Ex: Give me heart-healthy meals with chicken, low sodium, easy to cook..."
                            className="w-full h-28 lg:h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#4A90E2] focus:outline-none focus:bg-white resize-none transition-colors"
                            disabled={submitting}
                        />

                        {/* Error Message */}
                        {message && (
                            <div className="flex items-start gap-2 mt-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-600 whitespace-pre-line">{message}</p>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || !prompt.trim()}
                            className="w-full mt-4 py-4 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Generating meals...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-5 h-5" />
                                    <span>Generate Meals</span>
                                </>
                            )}
                        </button>

                        {/* AI Powered Label */}
                        <div className="flex items-center justify-center gap-2 mt-4">
                            <Sparkles className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-400">AI powered meal suggestions</span>
                        </div>
                    </div>

                    {/* Tips Card */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <h3 className="font-medium text-gray-900 mb-3">Tips for better results</h3>
                        <ul className="space-y-2">
                            {[
                                "Include specific dietary needs (low sodium, high protein)",
                                "Mention cooking time preferences (quick, slow cooker)",
                                "Add ingredient preferences or restrictions",
                                "Specify meal type (breakfast, lunch, dinner, snacks)",
                            ].map((tip, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-gray-500">
                                    <span className="text-[#4A90E2] mt-0.5">•</span>
                                    {tip}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Prompt Counter - Free Tier */}
                    {!isPremium && (
                        <div className="mt-4 bg-white rounded-2xl border border-gray-100 p-5">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-medium text-gray-700">Monthly usage</span>
                                <span className="text-sm text-gray-500">
                                    {monthlyPromptCount} / {monthlyPromptLimit} generations
                                </span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${
                                        monthlyPromptCount >= monthlyPromptLimit
                                            ? "bg-red-500"
                                            : monthlyPromptCount >= monthlyPromptLimit * 0.8
                                            ? "bg-amber-500"
                                            : "bg-[#4A90E2]"
                                    }`}
                                    style={{ width: `${Math.min((monthlyPromptCount / monthlyPromptLimit) * 100, 100)}%` }}
                                />
                            </div>
                            {monthlyPromptCount >= monthlyPromptLimit ? (
                                <p className="text-xs text-red-600 mt-2">
                                    You've used all free prompts for this month. Resets in {daysUntilReset} day{daysUntilReset !== 1 ? "s" : ""}.
                                </p>
                            ) : monthlyPromptCount >= monthlyPromptLimit * 0.8 ? (
                                <p className="text-xs text-amber-600 mt-2">
                                    {monthlyPromptLimit - monthlyPromptCount} generation{monthlyPromptLimit - monthlyPromptCount !== 1 ? "s" : ""} remaining. Resets in {daysUntilReset} day{daysUntilReset !== 1 ? "s" : ""}.
                                </p>
                            ) : (
                                <p className="text-xs text-gray-500 mt-2">
                                    Resets in {daysUntilReset} day{daysUntilReset !== 1 ? "s" : ""}.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Loading Overlay */}
            {submitting && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-8 mx-6 max-w-sm w-full text-center shadow-xl animate-scale-up">
                        <div className="w-16 h-16 bg-gradient-to-br from-[#4A90E2] to-[#357ABD] rounded-full flex items-center justify-center mx-auto mb-4">
                            <Sparkles className="w-8 h-8 text-white animate-pulse" />
                        </div>
                        <p className="text-base text-gray-700 mb-4 h-6 transition-opacity duration-300">
                            {loadingMessage}
                        </p>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full w-1/3 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] rounded-full animate-bounce-bar" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}