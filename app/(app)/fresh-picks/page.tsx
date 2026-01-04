"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Sparkles, Lock, ArrowRight, Bookmark, ThumbsUp, ThumbsDown, ChevronRight, ChefHat } from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { MealCard } from "@/components/MealCard";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { getRandomAccentColor, type AccentColor } from "@/lib/utils";
import { loadGeneratedMeals, saveGeneratedMeals } from "@/lib/mealStorage";
import { getCompliantDiets } from "@/lib/sensitivityMapping";

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
    ingredients: any[];
    steps: string[];
    cookTimeRange?: {
        min: number;
        max: number;
    };
    imageUrl?: string;
    estimatedCost?: number;
};

export default function FreshPicksPage() {
    const router = useRouter();
    const { showToast } = useToast();

    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // States
    const [isLocked, setIsLocked] = useState(false);
    const [currentSavedCount, setCurrentSavedCount] = useState(0);
    const [neededCount, setNeededCount] = useState(5);
    const [freshMeals, setFreshMeals] = useState<Meal[]>([]);

    const [dietType, setDietType] = useState<string | undefined>(undefined);
    const [accentColor, setAccentColor] = useState<AccentColor>({ primary: "#3b82f6", dark: "#2563eb" });

    useEffect(() => {
        setAccentColor(getRandomAccentColor());
    }, []);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                router.push("/login");
                return;
            }
            setUser(firebaseUser);

            // Fetch User Profile
            const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
            if (userDoc.exists()) {
                setDietType(userDoc.data().dietType);
            }

            // Initial fetch
            fetchFreshPicks(firebaseUser.uid);
        });
        return () => unsub();
    }, [router]);

    const fetchFreshPicks = async (userId: string) => {
        try {
            const res = await fetch("/api/fresh-picks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, userTimezoneOffset: new Date().getTimezoneOffset() }),
            });

            const data = await res.json();

            if (res.status === 422 && data.error === "INSUFFICIENT_DATA") {
                setIsLocked(true);
                setCurrentSavedCount(data.currentCount);
                setNeededCount(data.neededCount);
                setLoading(false);
                return;
            }

            if (!res.ok) {
                throw new Error(data.message || "Failed to load Fresh Picks");
            }

            setFreshMeals(data.meals);
            setLoading(false);

        } catch (error: any) {
            console.error("Error fetching fresh picks:", error);
            showToast("Failed to load your daily picks.", "error");
            setLoading(false);
        }
    };

    const handleViewMeal = (meal: Meal) => {
        // 1. Get current storage to avoid wiping recent searches if possible
        const stored = loadGeneratedMeals() || { meals: [] };

        // 2. Check if this meal is already in storage
        const exists = stored.meals.some(m => m.id === meal.id);

        if (!exists) {
            // 3. Add to storage so detailed view can find it
            // We prepend so it's easy to find if iterating
            const newMeals = [meal, ...stored.meals];
            saveGeneratedMeals(newMeals, stored.meta, stored.prompt);
        }

        // 4. Navigate
        router.push(`/meals/${meal.id}?source=fresh-picks`);
    };

    const handleSaveMeal = async (meal: Meal) => {
        if (!user) return;
        try {
            // Save to Firestore
            const { id, ...mealData } = meal; // Remove the temporary ID
            await addDoc(collection(db, "savedMeals", user.uid, "meals"), {
                ...mealData,
                savedAt: serverTimestamp(),
                source: "fresh_picks"
            });
        } catch (error) {
            console.error("Error saving meal:", error);
            showToast("Failed to save meal.", "error");
        }
    };

    // Animation State
    const [exitingMealId, setExitingMealId] = useState<string | null>(null);
    const [exitDirection, setExitDirection] = useState<"left" | "right">("right");

    const handleFeedback = async (meal: Meal, action: "like" | "dislike") => {
        if (!user) return;

        // Trigger exit animation
        setExitDirection(action === "like" ? "right" : "left");
        setExitingMealId(meal.id);

        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 300));

        // Actual State Update
        if (action === "dislike") {
            setFreshMeals(prev => prev.filter(m => m.id !== meal.id));
            showToast("Got it! We won't suggest this again.", "success");
        } else {
            // Like = Save
            await handleSaveMeal(meal);
            showToast("Meal saved! We'll suggest more like this.", "success");
            setFreshMeals(prev => prev.filter(m => m.id !== meal.id));
        }

        // Reset animation state
        setExitingMealId(null);

        // API Call in background
        try {
            await fetch("/api/fresh-picks/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user.uid,
                    meal,
                    action
                }),
            });
        } catch (error) {
            console.error("Error submitting feedback:", error);
        }
    };

    if (loading) {
        return <LoadingScreen message="Curating your daily picks..." />;
    }

    return (
        <div className="min-h-screen bg-[#f8fafb]">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 px-6 py-8">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-sm">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Fresh Picks</h1>
                            <p className="text-sm text-gray-500">
                                Daily personalized suggestions based on your taste.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-6 py-8">
                <div className="max-w-md mx-auto">
                    {isLocked ? (
                        <div className="w-full bg-white rounded-2xl shadow-lg p-8 border border-gray-100 text-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <ChefHat className="w-8 h-8 text-orange-500" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Let's Learn Your Taste</h1>
                            <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                                We generate a daily Breakfast, Lunch, Dinner, and Snack idea that learns from your searches and saved meals.
                                <br /><br />
                                Save <span className="font-semibold text-gray-900">{Math.max(0, neededCount - currentSavedCount)} more {neededCount - currentSavedCount === 1 ? 'meal' : 'meals'}</span> to get started!
                            </p>

                            {/* Progress Bar */}
                            <div className="mb-8">
                                <div className="flex justify-between text-sm font-medium mb-2">
                                    <span className="text-gray-600">Progress</span>
                                    <span className="text-[#4A90E2]">{currentSavedCount}/{neededCount} Saved</span>
                                </div>
                                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[#4A90E2] transition-all duration-500 ease-out"
                                        style={{ width: `${Math.min((currentSavedCount / neededCount) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>

                            <Button
                                onClick={() => router.push("/prompt")}
                                fullWidth
                                size="lg"
                                icon={<ArrowRight className="w-5 h-5" />}
                                iconPosition="right"
                                className="rounded-xl"
                            >
                                Browse & Generate Meals
                            </Button>
                        </div>
                    ) : freshMeals.length > 0 ? (
                        <div
                            key={freshMeals[0].id}
                            className={`relative group transition-all duration-300 ease-out ${exitingMealId === freshMeals[0].id
                                ? exitDirection === "right"
                                    ? "translate-x-full opacity-0 rotate-12"
                                    : "-translate-x-full opacity-0 -rotate-12"
                                : "translate-x-0 opacity-100 rotate-0"
                                }`}
                        >
                            <MealCard
                                id={freshMeals[0].id}
                                name={freshMeals[0].name}
                                description={freshMeals[0].description}
                                mealType={freshMeals[0].mealType}
                                macros={freshMeals[0].macros}
                                imageUrl={freshMeals[0].imageUrl}
                                cookTimeRange={freshMeals[0].cookTimeRange}
                                dietType={dietType}
                                dietBadges={getCompliantDiets(freshMeals[0].ingredients)}
                                estimatedCost={freshMeals[0].estimatedCost}
                                onClick={() => handleViewMeal(freshMeals[0])}
                                bottomActions={
                                    <div className="flex flex-col gap-3 w-full mt-2">
                                        {/* View Meal Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleViewMeal(freshMeals[0]);
                                            }}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors text-sm font-semibold"
                                        >
                                            <span>View Meal Details</span>
                                            <ChevronRight className="w-4 h-4" />
                                        </button>

                                        {/* Save & Like */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleFeedback(freshMeals[0], "like");
                                            }}
                                            className="w-full flex items-center justify-center gap-2 py-3 bg-[#4A90E2] text-white rounded-xl hover:bg-[#357abd] transition-colors text-sm font-semibold shadow-sm shadow-blue-200"
                                        >
                                            <ThumbsUp className="w-4 h-4" />
                                            <span>Save & Like</span>
                                        </button>

                                        {/* Dislike */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleFeedback(freshMeals[0], "dislike");
                                            }}
                                            className="w-full flex items-center justify-center gap-2 py-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors text-sm font-semibold"
                                        >
                                            <ThumbsDown className="w-4 h-4" />
                                            <span>Pass</span>
                                        </button>
                                    </div>
                                }
                            />
                            {/* Stack Effect Hint */}
                            {freshMeals.length > 1 && (
                                <div className="absolute top-2 -inset-x-2 bottom-0 bg-white border border-gray-100 rounded-2xl -z-10 translate-y-2 scale-[0.98] shadow-sm" />
                            )}
                        </div>
                    ) : (
                        !loading && (
                            <div className="text-center py-20">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Sparkles className="w-8 h-8 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">All Caught Up!</h3>
                                <p className="text-gray-500 max-w-sm mx-auto">
                                    You've reviewed all your options. Check back tomorrow for more daily picks!
                                </p>
                            </div>
                        )
                    )}
                </div>
            </div>

        </div>
    );
}
