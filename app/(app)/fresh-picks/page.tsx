"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Sparkles, Lock, ArrowRight, Bookmark } from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { MealCard } from "@/components/MealCard";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { getRandomAccentColor, type AccentColor } from "@/lib/utils";
import { loadGeneratedMeals, saveGeneratedMeals } from "@/lib/mealStorage";

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
            showToast("Meal saved to favorites!", "success");
        } catch (error) {
            console.error("Error saving meal:", error);
            showToast("Failed to save meal.", "error");
        }
    };

    if (loading) {
        return <LoadingScreen message="Curating your daily picks..." />;
    }

    if (isLocked) {
        const progress = Math.min((currentSavedCount / neededCount) * 100, 100);
        return (
            <div className="min-h-screen bg-[#f8fafb] flex flex-col items-center justify-center p-6 text-center">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Lock className="w-8 h-8 text-gray-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Unlock Fresh Picks</h1>
                    <p className="text-gray-500 mb-8">
                        Save at least {neededCount} meals to unlock personalized daily suggestions.
                        We need to learn your taste first!
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
                                style={{ width: `${progress}%` }}
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
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafb]">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 px-6 py-8">
                <div className="max-w-7xl mx-auto">
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
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {freshMeals.map((meal) => (
                            <div key={meal.id} className="relative group">
                                <MealCard
                                    id={meal.id} // Note: This ID is virtual, detailed view might fail if not handled
                                    name={meal.name}
                                    description={meal.description}
                                    mealType={meal.mealType}
                                    macros={meal.macros}
                                    imageUrl={meal.imageUrl}
                                    cookTimeRange={meal.cookTimeRange}
                                    dietType={dietType}
                                    onClick={() => handleViewMeal(meal)}
                                    actionButton={
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSaveMeal(meal);
                                            }}
                                            className="inline-flex items-center justify-center w-8 h-8 bg-white/90 backdrop-blur-sm text-[#4A90E2] hover:bg-[#4A90E2] hover:text-white rounded-full shadow-sm transition-all"
                                            title="Save to favorites"
                                        >
                                            <Bookmark className="w-4 h-4" />
                                        </button>
                                    }
                                />
                            </div>
                        ))}
                    </div>

                    {freshMeals.length === 0 && !loading && (
                        <div className="text-center py-20">
                            <p className="text-gray-400">No fresh picks available right now. Check back tomorrow!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
