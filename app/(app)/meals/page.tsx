"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { logUserEvent } from "@/lib/logUserEvent";
import { ACCENT_COLORS, type AccentColor } from "@/lib/utils";
import { ArrowLeft, Flame, Beef, Wheat, Droplet, Heart, ChevronRight, Sparkles, ShieldCheck } from "lucide-react";

type Ingredient = {
    name: string;
    quantity: string;
    category?: string;
    aisle?: string;
    price?: number;
};

type Meal = {
    id: string;
    mealType: "breakfast" | "lunch" | "dinner" | "snack";
    name: string;
    description: string;
    servings: number;
    macros: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
    };
    ingredients: Ingredient[];
    steps: string[];
    imageUrl?: string;
};

type MealsMeta = {
    usedDoctorInstructions?: boolean;
    blockedIngredientsFromDoctor?: string[];
    blockedGroupsFromDoctor?: string[];
};

type StoredMealsPayload =
    | {
    meals: Meal[];
    meta?: MealsMeta;
}
    | Meal[];

type StreamEvent =
    | { type: "status"; message: string }
    | { type: "meal"; meal: Meal; index: number }
    | { type: "meal_updated"; meal: Meal; index: number }
    | { type: "meta"; meta: MealsMeta }
    | { type: "done" }
    | { type: "error"; error: string; message: string };

function MealsPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const promptFromUrl = searchParams.get("prompt") || "";
    const shouldStream = searchParams.get("stream") === "true";

    const [user, setUser] = useState<User | null>(null);
    const [prefs, setPrefs] = useState<Record<string, unknown> | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [meals, setMeals] = useState<Meal[]>([]);
    const [mealsMeta, setMealsMeta] = useState<MealsMeta | null>(null);
    const [loadingMeals, setLoadingMeals] = useState(true);
    const [streamStatus, setStreamStatus] = useState<string>("");
    const [streamError, setStreamError] = useState<string>("");
    const [streamComplete, setStreamComplete] = useState(false);
    const [statusColor, setStatusColor] = useState<AccentColor>(ACCENT_COLORS[0]);

    const hasStartedStreaming = useRef<string | null>(null);
    const mealsMetaRef = useRef<MealsMeta | null>(null);
    const colorIndexRef = useRef(0);

    // Cycle through colors while streaming
    useEffect(() => {
        if (!streamStatus || streamComplete) return;

        const interval = setInterval(() => {
            colorIndexRef.current = (colorIndexRef.current + 1) % ACCENT_COLORS.length;
            setStatusColor(ACCENT_COLORS[colorIndexRef.current]);
        }, 1500);

        return () => clearInterval(interval);
    }, [streamStatus, streamComplete]);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                router.push("/login");
                return;
            }

            setUser(firebaseUser);

            const ref = doc(db, "users", firebaseUser.uid);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                setPrefs(snap.data());
            }

            setLoadingUser(false);
        });

        return () => unsub();
    }, [router]);

    // Stream meals from API
    const streamMeals = useCallback(async (uid: string, userPrefs: Record<string, unknown>, prompt: string) => {
        // Prevent duplicate streams for the same prompt
        if (hasStartedStreaming.current === prompt) return;
        hasStartedStreaming.current = prompt;

        setLoadingMeals(true);
        setStreamStatus("Connecting...");

        try {
            const res = await fetch("/api/meals/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, prefs: userPrefs, uid }),
            });

            if (!res.ok || !res.body) {
                const data = await res.json().catch(() => ({}));
                setStreamError(data.message || "Failed to generate meals");
                setLoadingMeals(false);
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            const mealsArray: Meal[] = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split("\n");

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;

                    try {
                        const event = JSON.parse(line.slice(6)) as StreamEvent;

                        switch (event.type) {
                            case "status":
                                setStreamStatus(event.message);
                                break;

                            case "meal":
                                mealsArray[event.index] = event.meal;
                                setMeals([...mealsArray]);
                                // Update sessionStorage immediately so detail page can access
                                sessionStorage.setItem("generatedMeals", JSON.stringify({
                                    meals: mealsArray.filter(Boolean),
                                    meta: mealsMetaRef.current,
                                }));
                                // First meal arrived - stop showing loading
                                if (mealsArray.filter(Boolean).length === 1) {
                                    setLoadingMeals(false);
                                }
                                break;

                            case "meal_updated":
                                mealsArray[event.index] = event.meal;
                                setMeals([...mealsArray]);
                                // Update sessionStorage with updated meal (e.g., new image)
                                sessionStorage.setItem("generatedMeals", JSON.stringify({
                                    meals: mealsArray.filter(Boolean),
                                    meta: mealsMetaRef.current,
                                }));
                                break;

                            case "meta":
                                mealsMetaRef.current = event.meta;
                                setMealsMeta(event.meta);
                                // Update sessionStorage with meta
                                sessionStorage.setItem("generatedMeals", JSON.stringify({
                                    meals: mealsArray.filter(Boolean),
                                    meta: event.meta,
                                }));
                                break;

                            case "error":
                                setStreamError(event.message);
                                setLoadingMeals(false);
                                break;

                            case "done":
                                setStreamComplete(true);
                                setStreamStatus("");
                                // Log event
                                logUserEvent(uid, { type: "prompt_submitted", prompt }).catch(() => {});
                                break;
                        }
                    } catch {
                        // Ignore parse errors
                    }
                }
            }

            setLoadingMeals(false);
        } catch (err) {
            console.error("Stream error:", err);
            setStreamError("Connection error. Please try again.");
            setLoadingMeals(false);
        }
    }, []);

    // Scroll to top when the page loads to ensure proper slide-up effect on mobile
    useEffect(() => {
        if (!loadingUser && user && prefs) {
            window.scrollTo(0, 0);
        }
    }, [loadingUser, user, prefs]);

    // Load from sessionStorage OR start streaming
    useEffect(() => {
        if (!user || !prefs) return;

        // If we should stream, start the stream
        if (shouldStream && promptFromUrl) {
            streamMeals(user.uid, prefs, decodeURIComponent(promptFromUrl));
            return;
        }

        // Otherwise load from sessionStorage
        setLoadingMeals(true);

        try {
            const stored = sessionStorage.getItem("generatedMeals");
            if (!stored) {
                setMeals([]);
                setMealsMeta(null);
            } else {
                const parsed: StoredMealsPayload = JSON.parse(stored);

                if (Array.isArray(parsed)) {
                    setMeals(parsed);
                    setMealsMeta(null);
                } else {
                    setMeals(parsed.meals ?? []);
                    setMealsMeta(parsed.meta ?? null);
                }
            }
        } catch (err) {
            console.error("Failed to parse meals from sessionStorage", err);
            setMeals([]);
            setMealsMeta(null);
        }

        setLoadingMeals(false);
    }, [user, prefs, shouldStream, promptFromUrl, streamMeals]);

    if (loadingUser) {
        return (
            <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-3 border-gray-200 border-t-[#4A90E2] rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-500">Loading your profile...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center">
                <p className="text-gray-500">Redirecting to login...</p>
            </div>
        );
    }

    const displayedPrompt =
        promptFromUrl && promptFromUrl.trim().length > 0
            ? decodeURIComponent(promptFromUrl)
            : "No prompt provided.";

    const doctorApplied = Boolean(mealsMeta?.usedDoctorInstructions);
    const blockedIngredients = mealsMeta?.blockedIngredientsFromDoctor || [];
    const blockedGroups = mealsMeta?.blockedGroupsFromDoctor || [];

    // Check if user has diet instructions from their profile
    const userHasDietInstructions = Boolean(
        (prefs as { doctorDietInstructions?: { hasActiveNote?: boolean } })?.doctorDietInstructions?.hasActiveNote
    );

    return (
        <div className="min-h-screen bg-[#f8fafb]">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-20 lg:static">
                <div className="max-w-3xl mx-auto">
                    <button
                        onClick={() => router.push("/prompt")}
                        className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors mb-3"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="text-sm">Back to search</span>
                    </button>
                    <h1 className="text-xl lg:text-2xl text-gray-900">Your Meal Suggestions</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Based on: <span className="text-gray-700">{displayedPrompt}</span>
                    </p>
                </div>
            </div>

            {/* Doctor Note Applied Banner */}
            {doctorApplied && (
                <div className="px-6 pt-4">
                    <div className="max-w-3xl mx-auto">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                                    <Heart className="w-3.5 h-3.5 text-white" />
                                </div>
                                <span className="text-sm font-medium text-emerald-700">
                                    Diet instructions applied
                                </span>
                            </div>
                            {(blockedIngredients.length > 0 || blockedGroups.length > 0) && (
                                <p className="text-xs text-emerald-600">
                                    These meals avoid{" "}
                                    {blockedIngredients.length > 0 && (
                                        <span className="font-medium">{blockedIngredients.join(", ")}</span>
                                    )}
                                    {blockedIngredients.length > 0 && blockedGroups.length > 0 && " and "}
                                    {blockedGroups.length > 0 && (
                                        <span className="font-medium">{blockedGroups.join(", ")}</span>
                                    )}
                                    {" "}as specified in your diet instructions.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}


            {/* Stream Error */}
            {streamError && (
                <div className="px-6 pt-4">
                    <div className="max-w-3xl mx-auto">
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                            <p className="text-sm text-red-700">{streamError}</p>
                            <button
                                onClick={() => router.push("/prompt")}
                                className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-xl text-sm hover:bg-red-200 transition-colors"
                            >
                                Try again
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="px-6 py-6">
                <div className="max-w-3xl mx-auto">
                    {meals.length === 0 && !streamError && !loadingMeals && !streamStatus ? (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Sparkles className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No meals generated</h3>
                            <p className="text-gray-500 mb-6">
                                Try going back and submitting a new prompt.
                            </p>
                            <button
                                onClick={() => router.push("/prompt")}
                                className="px-6 py-3 bg-[#4A90E2]/10 text-[#4A90E2] rounded-xl hover:bg-[#4A90E2]/20 transition-colors"
                            >
                                Try again
                            </button>
                        </div>
                    ) : meals.length === 0 && streamStatus ? (
                        /* Skeleton placeholder cards while loading */
                        <div className="flex flex-col gap-3">
                            {[0, 1].map((i) => (
                                <div
                                    key={i}
                                    className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex p-4 gap-4 animate-pulse"
                                    style={{ animationDelay: `${i * 150}ms` }}
                                >
                                    {/* Skeleton Thumbnail */}
                                    <div className="w-20 h-20 flex-shrink-0 bg-gray-200 rounded-xl" />

                                    {/* Skeleton Content */}
                                    <div className="flex-1 flex flex-col gap-2">
                                        {/* Meal type badge */}
                                        <div className="w-16 h-5 bg-gray-200 rounded-md" />
                                        {/* Title */}
                                        <div className="w-3/4 h-5 bg-gray-200 rounded-md" />
                                        {/* Description */}
                                        <div className="w-full h-4 bg-gray-100 rounded-md" />
                                        {/* Macros */}
                                        <div className="flex gap-3 mt-1">
                                            <div className="w-10 h-4 bg-gray-100 rounded" />
                                            <div className="w-10 h-4 bg-gray-100 rounded" />
                                            <div className="w-10 h-4 bg-gray-100 rounded" />
                                            <div className="w-10 h-4 bg-gray-100 rounded" />
                                        </div>
                                        {/* Button */}
                                        <div className="w-24 h-8 bg-gray-100 rounded-xl mt-1" />
                                    </div>
                                </div>
                            ))}

                            {/* Status indicator below skeletons */}
                            <div className="flex items-center gap-2 py-3">
                                <div
                                    className="w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-500"
                                    style={{ backgroundColor: statusColor.primary }}
                                >
                                    <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
                                </div>
                                <span
                                    className="text-sm font-medium transition-colors duration-500"
                                    style={{ color: statusColor.primary }}
                                >
                                    {streamStatus}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {/* Meal cards with staggered animation */}
                            {meals.map((meal, index) => {
                                const thumbSrc =
                                    meal.imageUrl ??
                                    "https://placehold.co/256x256/e5e7eb/9ca3af?text=Meal";

                                return (
                                    <div
                                        key={meal.id}
                                        className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-100 flex p-4 gap-4 animate-fade-slide-in"
                                        style={{
                                            animationDelay: `${index * 100}ms`,
                                            animationFillMode: "backwards",
                                        }}
                                    >
                                        {/* Thumbnail - Left */}
                                        <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-xl overflow-hidden">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={thumbSrc}
                                                alt={meal.name}
                                                className="w-full h-full object-cover transition-opacity duration-300"
                                            />
                                        </div>

                                        {/* Content - Right */}
                                        <div className="flex-1 flex flex-col min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="inline-block px-2 py-0.5 bg-gray-100 rounded-md text-xs font-medium text-gray-600 capitalize">
                                                    {meal.mealType}
                                                </span>
                                                {(doctorApplied || userHasDietInstructions) && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-medium text-emerald-700">
                                                        <ShieldCheck className="w-3 h-3" />
                                                        Diet Compliant
                                                    </span>
                                                )}
                                            </div>
                                            <h2 className="text-base font-medium text-gray-900 mb-1">
                                                {meal.name}
                                            </h2>
                                            <p className="text-sm text-gray-500 mb-2">
                                                {meal.description}
                                            </p>

                                            {/* Macros */}
                                            <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                                                <div className="flex items-center gap-1">
                                                    <Flame className="w-3 h-3 text-orange-500" />
                                                    <span>{meal.macros.calories}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Beef className="w-3 h-3 text-blue-500" />
                                                    <span>{meal.macros.protein}g</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Wheat className="w-3 h-3 text-amber-500" />
                                                    <span>{meal.macros.carbs}g</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Droplet className="w-3 h-3 text-purple-500" />
                                                    <span>{meal.macros.fat}g</span>
                                                </div>
                                            </div>

                                            {/* View Button */}
                                            <button
                                                onClick={() =>
                                                    router.push(
                                                        `/meals/${meal.id}?prompt=${encodeURIComponent(displayedPrompt)}`
                                                    )
                                                }
                                                className="inline-flex items-center gap-0.5 px-2 py-1 bg-[#4A90E2]/10 text-[#4A90E2] text-[10px] font-medium rounded-lg hover:bg-[#4A90E2]/20 transition-colors w-fit whitespace-nowrap"
                                            >
                                                <span>View</span>
                                                <ChevronRight className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Small left-aligned status indicator at the bottom */}
                            {streamStatus && !streamComplete && (
                                <div className="flex items-center gap-2 py-3">
                                    <div
                                        className="w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-500"
                                        style={{ backgroundColor: statusColor.primary }}
                                    >
                                        <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
                                    </div>
                                    <span
                                        className="text-sm font-medium transition-colors duration-500"
                                        style={{ color: statusColor.primary }}
                                    >
                                        {streamStatus}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function MealsPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-10 h-10 border-3 border-gray-200 border-t-[#4A90E2] rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-gray-500">Loading meals...</p>
                    </div>
                </div>
            }
        >
            <MealsPageContent />
        </Suspense>
    );
}
