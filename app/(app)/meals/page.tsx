"use client";

import { Suspense, useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { logUserEvent } from "@/lib/logUserEvent";
import { ACCENT_COLORS, type AccentColor, getRandomAccentColor } from "@/lib/utils";
import {
    saveGeneratedMeals,
    loadGeneratedMeals,
    clearAllMealStorage,
    clearLastViewedMeal,
} from "@/lib/mealStorage";
import { getCompliantDiets } from "@/lib/sensitivityMapping";
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
    estimatedCost?: number;
};

type MealsMeta = {
    usedDietRestrictions?: boolean;
    blockedIngredientsFromUpload?: string[];
    blockedGroupsFromUpload?: string[];
    pantryMode?: boolean;
};



{/* Remove old banners here by replacing with empty string or comment */
    /* Stream Error */
}

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
    const ignoreConflicts = searchParams.get("ignoreConflicts") === "true";

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
    const isActivelyStreaming = useRef(false);
    const mealsMetaRef = useRef<MealsMeta | null>(null);
    const colorIndexRef = useRef(0);

    // Random color for back button
    const backButtonColor = useMemo(() => getRandomAccentColor(), []);

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
    const streamMeals = useCallback(async (uid: string, userPrefs: Record<string, unknown>, prompt: string, isPantryMode: boolean, shouldIgnoreConflicts: boolean) => {
        // Prevent duplicate streams for the same prompt
        if (hasStartedStreaming.current === prompt) return;
        hasStartedStreaming.current = prompt;
        isActivelyStreaming.current = true;

        setLoadingMeals(true);
        setStreamStatus("Connecting...");

        try {
            const res = await fetch("/api/meals/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, prefs: userPrefs, uid, pantryMode: isPantryMode, ignoreConflicts: shouldIgnoreConflicts }),
            });

            if (!res.ok || !res.body) {
                const data = await res.json().catch(() => ({}));
                setStreamError(data.message || "Failed to generate meals");
                setLoadingMeals(false);
                isActivelyStreaming.current = false;
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
                                setStreamStatus("");
                                setLoadingMeals(false);
                                isActivelyStreaming.current = false;
                                break;

                            case "done":
                                setStreamComplete(true);
                                setStreamStatus("");
                                isActivelyStreaming.current = false;
                                // Log event
                                logUserEvent(uid, { type: "prompt_submitted", prompt }).catch(() => { });
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
            isActivelyStreaming.current = false;
        }
    }, []);

    // Manual scroll-to-top removed to support Next.js scroll restoration
    // and prevent jumping on mobile interactions
    useEffect(() => {
        // window.scrollTo(0, 0); 
    }, []);

    // After a successful stream, strip the stream flag so refreshes don't re-generate meals
    useEffect(() => {
        if (!streamComplete) return;

        const params = new URLSearchParams(Array.from(searchParams.entries()));
        if (!params.has("stream")) return;

        params.delete("stream");
        const query = params.toString();
        router.replace(`/meals${query ? `?${query}` : ""}`);
    }, [streamComplete, searchParams, router]);

    // Load from storage OR start streaming
    useEffect(() => {
        if (!user || !prefs) return;

        // If we should stream, start the stream and clear any previous "last viewed" state
        if (shouldStream && promptFromUrl) {
            clearLastViewedMeal();

            // Immediately strip stream=true from URL to prevent re-streaming on back navigation
            // This must happen BEFORE the user can navigate away
            const params = new URLSearchParams(Array.from(searchParams.entries()));
            params.delete("stream");
            const query = params.toString();
            router.replace(`/meals${query ? `?${query}` : ""}`, { scroll: false });

            streamMeals(user.uid, prefs, decodeURIComponent(promptFromUrl), pantryMode, ignoreConflicts);
            return;
        }

        // Skip loading from storage if we're currently streaming (stream just removed the param)
        // This prevents overwriting meals that are actively being streamed
        if (isActivelyStreaming.current) {
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
    }, [user, prefs, shouldStream, promptFromUrl, pantryMode, streamMeals, searchParams, router]);

    // Reload meals from storage when page becomes visible (e.g., navigating back)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !shouldStream) {
                // Reload from storage when page becomes visible
                const stored = loadGeneratedMeals();
                if (stored && stored.meals && stored.meals.length > 0) {
                    setMeals(stored.meals);
                    setMealsMeta(stored.meta ?? null);
                    setStoredPrompt(stored.prompt ?? "");
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [shouldStream]);

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

    const customRestrictionsApplied = Boolean(mealsMeta?.usedDietRestrictions);
    const blockedIngredients = mealsMeta?.blockedIngredientsFromUpload || [];
    const blockedGroups = mealsMeta?.blockedGroupsFromUpload || [];

    // Check if user has diet instructions from their profile
    const userHasDietInstructions = Boolean(
        (prefs as { dietRestrictions?: { hasActiveNote?: boolean } })?.dietRestrictions?.hasActiveNote
    );

    return (
        <div className="min-h-screen bg-[#f8fafb]">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-20 lg:static">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center justify-between mb-3">
                        <button
                            onClick={() => {
                                clearAllMealStorage();
                                router.push("/prompt");
                            }}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:opacity-80"
                            style={{
                                backgroundColor: `${backButtonColor.primary}15`,
                                color: backButtonColor.dark,
                            }}
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span className="font-medium">Back to prompt</span>
                        </button>

                        <div className="flex items-center gap-2">
                            {mealsMeta?.pantryMode && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                                    <Home className="w-3.5 h-3.5" />
                                    Pantry Mode
                                </span>
                            )}
                            {customRestrictionsApplied && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    Diet Compliant
                                </span>
                            )}
                        </div>
                    </div>

                    <h1 className="text-xl lg:text-2xl text-gray-900">Your Meal Suggestions</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Based on: <span className="text-gray-700">{displayedPrompt}</span>
                    </p>
                </div>
            </div>



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
                            {/* Status indicator above skeletons */}
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
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {/* Status indicator at the top while streaming */}
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
                                        (customRestrictionsApplied || userHasDietInstructions) ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-pink-50 border border-pink-200 rounded-full text-xs font-medium text-pink-700">
                                                <ShieldCheck className="w-3 h-3" />
                                                Diet Compliant
                                            </span>
                                        ) : undefined
                                    }
                                    dietType={prefs?.dietType as string | undefined}
                                    dietBadges={getCompliantDiets(meal.ingredients)}
                                    estimatedCost={meal.estimatedCost}
                                />
                            ))}
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
