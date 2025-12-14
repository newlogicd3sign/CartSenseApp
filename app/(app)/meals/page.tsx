"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { logUserEvent } from "@/lib/logUserEvent";
import { ACCENT_COLORS, type AccentColor } from "@/lib/utils";
import {
    saveGeneratedMeals,
    loadGeneratedMeals,
    clearLastViewedMeal,
} from "@/lib/mealStorage";
import { ArrowLeft, Heart, Sparkles, ShieldCheck, Home } from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { EmptyState } from "@/components/EmptyState";
import { MealCard } from "@/components/MealCard";
import { Alert } from "@/components/Alert";

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
        fiber: number;
        fat: number;
    };
    ingredients: Ingredient[];
    steps: string[];
    imageUrl?: string;
    cookTimeRange?: {
        min: number;
        max: number;
    };
};

type MealsMeta = {
    usedDoctorInstructions?: boolean;
    blockedIngredientsFromDoctor?: string[];
    blockedGroupsFromDoctor?: string[];
    pantryMode?: boolean;
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
    const pantryMode = searchParams.get("pantryMode") === "true";

    const [user, setUser] = useState<User | null>(null);
    const [prefs, setPrefs] = useState<Record<string, unknown> | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [meals, setMeals] = useState<Meal[]>([]);
    const [mealsMeta, setMealsMeta] = useState<MealsMeta | null>(null);
    const [storedPrompt, setStoredPrompt] = useState<string>("");
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
    const streamMeals = useCallback(async (uid: string, userPrefs: Record<string, unknown>, prompt: string, isPantryMode: boolean) => {
        // Prevent duplicate streams for the same prompt
        if (hasStartedStreaming.current === prompt) return;
        hasStartedStreaming.current = prompt;

        setLoadingMeals(true);
        setStreamStatus("Connecting...");

        try {
            const res = await fetch("/api/meals/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, prefs: userPrefs, uid, pantryMode: isPantryMode }),
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
                                // Save to both sessionStorage and localStorage
                                saveGeneratedMeals(
                                    mealsArray.filter(Boolean),
                                    mealsMetaRef.current ?? undefined,
                                    decodeURIComponent(prompt)
                                );
                                // First meal arrived - stop showing loading
                                if (mealsArray.filter(Boolean).length === 1) {
                                    setLoadingMeals(false);
                                }
                                break;

                            case "meal_updated":
                                mealsArray[event.index] = event.meal;
                                setMeals([...mealsArray]);
                                // Save updated meal (e.g., new image)
                                saveGeneratedMeals(
                                    mealsArray.filter(Boolean),
                                    mealsMetaRef.current ?? undefined,
                                    decodeURIComponent(prompt)
                                );
                                break;

                            case "meta":
                                mealsMetaRef.current = event.meta;
                                setMealsMeta(event.meta);
                                // Save with meta
                                saveGeneratedMeals(
                                    mealsArray.filter(Boolean),
                                    event.meta,
                                    decodeURIComponent(prompt)
                                );
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

    // Load from storage OR start streaming
    useEffect(() => {
        if (!user || !prefs) return;

        // If we should stream, start the stream and clear any previous "last viewed" state
        if (shouldStream && promptFromUrl) {
            clearLastViewedMeal();
            streamMeals(user.uid, prefs, decodeURIComponent(promptFromUrl), pantryMode);
            return;
        }

        // Otherwise load from storage (sessionStorage first, then localStorage)
        setLoadingMeals(true);

        const stored = loadGeneratedMeals();
        if (!stored || !stored.meals || stored.meals.length === 0) {
            setMeals([]);
            setMealsMeta(null);
            setStoredPrompt("");
        } else {
            setMeals(stored.meals);
            setMealsMeta(stored.meta ?? null);
            setStoredPrompt(stored.prompt ?? "");
        }

        setLoadingMeals(false);
    }, [user, prefs, shouldStream, promptFromUrl, pantryMode, streamMeals]);

    if (loadingUser) {
        return <LoadingScreen message="Loading your profile..." />;
    }

    if (!user) {
        return <LoadingScreen message="Redirecting to login..." />;
    }

    const displayedPrompt =
        promptFromUrl && promptFromUrl.trim().length > 0
            ? decodeURIComponent(promptFromUrl)
            : storedPrompt && storedPrompt.trim().length > 0
                ? storedPrompt
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

            {/* Pantry Mode Banner */}
            {mealsMeta?.pantryMode && (
                <div className="px-6 pt-4">
                    <div className="max-w-3xl mx-auto">
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <Home className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="font-medium text-amber-800 text-sm">Pantry Mode Active</h3>
                                <p className="text-xs text-amber-600">Recipes only — cook with what you have at home</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Doctor Note Applied Banner */}
            {doctorApplied && (
                <div className="px-6 pt-4">
                    <div className="max-w-3xl mx-auto">
                        <Alert
                            variant="success"
                            icon={<Heart className="w-4 h-4" />}
                            title="Diet instructions applied"
                            className="rounded-2xl"
                        >
                            {(blockedIngredients.length > 0 || blockedGroups.length > 0) && (
                                <span className="text-xs">
                                    These meals avoid{" "}
                                    {blockedIngredients.length > 0 && (
                                        <span className="font-medium">{blockedIngredients.join(", ")}</span>
                                    )}
                                    {blockedIngredients.length > 0 && blockedGroups.length > 0 && " and "}
                                    {blockedGroups.length > 0 && (
                                        <span className="font-medium">{blockedGroups.join(", ")}</span>
                                    )}
                                    {" "}as specified in your diet instructions.
                                </span>
                            )}
                        </Alert>
                    </div>
                </div>
            )}

            {/* Stream Error */}
            {streamError && (
                <div className="px-6 pt-4">
                    <div className="max-w-3xl mx-auto">
                        <Alert
                            variant="error"
                            action={{ label: "Try again", onClick: () => router.push("/prompt") }}
                            className="rounded-2xl"
                        >
                            {streamError}
                        </Alert>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="px-6 py-6">
                <div className="max-w-3xl mx-auto">
                    {meals.length === 0 && !streamError && !loadingMeals && !streamStatus ? (
                        <EmptyState
                            icon={<Sparkles className="w-8 h-8 text-gray-400" />}
                            title="No meals generated"
                            description="Try going back and submitting a new prompt."
                            action={{
                                label: "Try again",
                                onClick: () => router.push("/prompt"),
                            }}
                        />
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
                            {meals.map((meal, index) => (
                                <MealCard
                                    key={meal.id}
                                    id={meal.id}
                                    name={meal.name}
                                    description={meal.description}
                                    mealType={meal.mealType}
                                    macros={meal.macros}
                                    imageUrl={meal.imageUrl}
                                    cookTimeRange={meal.cookTimeRange}
                                    onClick={() => router.push(`/meals/${meal.id}?prompt=${encodeURIComponent(displayedPrompt)}`)}
                                    animationDelay={index * 100}
                                    badge={
                                        (doctorApplied || userHasDietInstructions) ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-medium text-emerald-700">
                                                <ShieldCheck className="w-3 h-3" />
                                                Diet Compliant
                                            </span>
                                        ) : undefined
                                    }
                                />
                            ))}

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
        <Suspense fallback={<LoadingScreen message="Loading meals..." />}>
            <MealsPageContent />
        </Suspense>
    );
}
