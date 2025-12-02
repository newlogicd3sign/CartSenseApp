"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getRandomAccentColor, getRandomAccentColorExcluding, type AccentColor } from "@/lib/utils";
import { Sparkles, UtensilsCrossed, ChefHat, Soup, Pizza, Salad, Sandwich, Croissant, Apple, Carrot, Beef, Fish, Citrus, Drumstick, Wheat, Ham, CookingPot, Hamburger, ShieldCheck, HeartPulse } from "lucide-react";
import { useToast } from "@/components/Toast";

const foodIcons = [
    UtensilsCrossed,
    ChefHat,
    Soup,
    Pizza,
    Salad,
    Sandwich,
    Croissant,
    Apple,
    Carrot,
    Beef,
    Fish,
    Citrus,
    Drumstick,
    Wheat,
    Ham,
    CookingPot,
    Hamburger,
];

function getRandomFoodIcon() {
    return foodIcons[Math.floor(Math.random() * foodIcons.length)];
}

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

function getRandomGreeting() {
    return foodGreetings[Math.floor(Math.random() * foodGreetings.length)];
}

export default function PromptPage() {
    const router = useRouter();
    const { showToast } = useToast();

    const [user, setUser] = useState<User | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [name, setName] = useState("");
    const [greeting, setGreeting] = useState("");

    const [prompt, setPrompt] = useState("");
    const [monthlyPromptCount, setMonthlyPromptCount] = useState(0);
    const [monthlyPromptLimit] = useState(10);
    const [daysUntilReset, setDaysUntilReset] = useState(30);
    const [isPremium, setIsPremium] = useState(false);
    const [accentColor, setAccentColor] = useState<AccentColor>({ primary: "#4A90E2", dark: "#357ABD" });
    const [badgeColor, setBadgeColor] = useState<AccentColor>({ primary: "#a855f7", dark: "#9333ea" });
    const [animateFromSetup, setAnimateFromSetup] = useState(false);
    const [FoodIcon, setFoodIcon] = useState<typeof UtensilsCrossed>(() => UtensilsCrossed);

    // Doctor diet instructions state
    const [hasDietInstructions, setHasDietInstructions] = useState(false);
    const [blockedIngredients, setBlockedIngredients] = useState<string[]>([]);
    const [blockedGroups, setBlockedGroups] = useState<string[]>([]);

    useEffect(() => {
        // Scroll to top when page loads
        window.scrollTo(0, 0);

        setGreeting(getRandomGreeting());
        setFoodIcon(() => getRandomFoodIcon());
        const primaryColor = getRandomAccentColor();
        setAccentColor(primaryColor);
        setBadgeColor(getRandomAccentColorExcluding(primaryColor));

        // Check if we should animate entry (from login or setup)
        const animateEntry = sessionStorage.getItem("animateEntry");
        if (animateEntry === "true") {
            setAnimateFromSetup(true);
            sessionStorage.removeItem("animateEntry");
        }
    }, []);

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
                    setIsPremium(data.isPremium ?? false);

                    // Calculate monthly prompt usage
                    let count = data.monthlyPromptCount ?? 0;
                    const periodStart = data.promptPeriodStart;

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

                    // Check for doctor diet instructions
                    const dietInstructions = data.doctorDietInstructions;
                    if (dietInstructions?.hasActiveNote) {
                        setHasDietInstructions(true);
                        setBlockedIngredients(dietInstructions.blockedIngredients || []);
                        setBlockedGroups(dietInstructions.blockedGroups || []);
                    }
                }
            }
            setLoadingUser(false);
        });

        return () => unsub();
    }, [router]);

    const handleSubmit = () => {
        const trimmed = prompt.trim();

        if (!trimmed) {
            showToast("Please enter what kind of meals you want.", "error");
            return;
        }

        if (!user) {
            showToast("Please log in again to generate meals.", "error");
            return;
        }

        // Navigate immediately to meals page with stream=true
        // The meals page will handle the streaming
        router.push(`/meals?prompt=${encodeURIComponent(trimmed)}&stream=true`);
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
                    <div className={`mb-6 ${animateFromSetup ? "animate-greeting-intro" : ""}`}>
                        <h1 className="text-2xl lg:text-3xl font-medium text-center text-gray-900 mb-1">
                            {greeting}{name ? `, ${name}` : ""}?
                        </h1>
                    </div>

                    {/* Diet Instructions Guardrails Card */}
                    {hasDietInstructions && (
                        <div className={`bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 mb-6 ${animateFromSetup ? "animate-content-after-greeting" : ""}`}>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="font-medium text-emerald-800 text-sm">Diet Guardrails Active</h3>
                                    <p className="text-emerald-600" style={{ fontSize: '10px' }}>Meals will comply with your doctor&apos;s instructions</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Search Card */}
                    <div className={`bg-white rounded-2xl shadow-lg p-5 mb-6 ${animateFromSetup ? "animate-content-after-greeting" : ""}`}>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Ex: Give me heart-healthy meals with chicken, low sodium, easy to cook..."
                            className="w-full h-28 lg:h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white resize-none transition-colors"
                            style={{ borderColor: prompt ? accentColor.primary : undefined }}
                        />

                        {/* Submit Button */}
                        <button
                            onClick={handleSubmit}
                            disabled={!prompt.trim()}
                            className="w-full mt-4 py-4 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            style={{ background: `linear-gradient(to right, ${accentColor.primary}, ${accentColor.dark})` }}
                        >
                            <FoodIcon className="w-5 h-5" />
                            <span>Generate Meals</span>
                        </button>

                        {/* Labels Row */}
                        <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4" style={{ color: badgeColor.primary }} />
                                <span className="text-sm" style={{ color: badgeColor.primary }}>AI powered</span>
                            </div>
                            {hasDietInstructions && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full">
                                    <HeartPulse className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="text-xs font-medium text-emerald-700">Diet Compliant</span>
                                </div>
                            )}
                        </div>

                        {/* Disclaimer */}
                        <p className="text-center text-gray-400 mt-3" style={{ fontSize: '10px' }}>
                            CartSense can make mistakes. Check important info.
                        </p>
                    </div>

                    {/* Tips Card */}
                    <div className={`bg-white rounded-2xl border border-gray-100 p-5 ${animateFromSetup ? "animate-content-after-greeting" : ""}`}>
                        <h3 className="font-medium text-gray-900 mb-3">Tips for better results</h3>
                        <ul className="space-y-2">
                            {[
                                "Your saved diet preferences are automatically applied",
                                "Mention cooking time or effort (quick 20-min, slow cooker)",
                                "Try a cuisine style (Italian, Mexican, Asian-inspired)",
                                "Specify meal type (breakfast, lunch, dinner, snacks)",
                            ].map((tip, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-gray-500">
                                    <span style={{ color: accentColor.primary }} className="mt-0.5">•</span>
                                    {tip}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Prompt Counter - Free Tier */}
                    {!isPremium && (
                        <div className={`mt-4 bg-white rounded-2xl border border-gray-100 p-5 ${animateFromSetup ? "animate-content-after-greeting" : ""}`}>
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
                                            : ""
                                    }`}
                                    style={{
                                        width: `${Math.min((monthlyPromptCount / monthlyPromptLimit) * 100, 100)}%`,
                                        backgroundColor: monthlyPromptCount < monthlyPromptLimit * 0.8 ? accentColor.primary : undefined
                                    }}
                                />
                            </div>
                            {monthlyPromptCount >= monthlyPromptLimit ? (
                                <p className="text-xs text-red-600 mt-2">
                                    You&apos;ve used all free prompts for this month. Resets in {daysUntilReset} day{daysUntilReset !== 1 ? "s" : ""}.
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
        </div>
    );
}
