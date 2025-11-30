"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Flame, Beef, Wheat, Droplet, Heart, ChevronRight, Sparkles } from "lucide-react";

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

export default function MealsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const promptFromUrl = searchParams.get("prompt") || "";

    const [user, setUser] = useState<User | null>(null);
    const [prefs, setPrefs] = useState<any>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [meals, setMeals] = useState<Meal[]>([]);
    const [mealsMeta, setMealsMeta] = useState<MealsMeta | null>(null);
    const [loadingMeals, setLoadingMeals] = useState(true);

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

    useEffect(() => {
        if (!user || !prefs) return;

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
    }, [user, prefs]);

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
                                    Doctor's instructions applied
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

            {/* Content */}
            <div className="px-6 py-6">
                <div className="max-w-3xl mx-auto">
                    {loadingMeals ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <div className="w-16 h-16 bg-gradient-to-br from-[#4A90E2] to-[#357ABD] rounded-full flex items-center justify-center mb-4">
                                <Sparkles className="w-8 h-8 text-white animate-pulse" />
                            </div>
                            <p className="text-gray-500">Generating meals for you...</p>
                        </div>
                    ) : meals.length === 0 ? (
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
                    ) : (
                        <div className="flex flex-col gap-3">
                            {meals.map((meal) => {
                                const thumbSrc =
                                    meal.imageUrl ??
                                    "https://placehold.co/256x256/e5e7eb/9ca3af?text=Meal";

                                return (
                                    <div
                                        key={meal.id}
                                        className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100 flex p-4 gap-4"
                                    >
                                        {/* Thumbnail - Left */}
                                        <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-xl overflow-hidden">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={thumbSrc}
                                                alt={meal.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>

                                        {/* Content - Right */}
                                        <div className="flex-1 flex flex-col min-w-0">
                                            <span className="inline-block self-start px-2 py-0.5 bg-gray-100 rounded-md text-xs font-medium text-gray-600 capitalize mb-1">
                                                {meal.mealType}
                                            </span>
                                            <h2 className="text-base font-medium text-gray-900 mb-1 line-clamp-1">
                                                {meal.name}
                                            </h2>
                                            <p className="text-sm text-gray-500 line-clamp-1 mb-2">
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
                                                className="self-start flex items-center gap-1 px-4 py-2 bg-[#4A90E2]/10 text-[#4A90E2] text-sm font-medium rounded-xl hover:bg-[#4A90E2]/20 transition-colors"
                                            >
                                                <span>View meal</span>
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
