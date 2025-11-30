"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
    collection,
    onSnapshot,
    deleteDoc,
    doc,
    query,
    orderBy,
} from "firebase/firestore";
import { logUserEvent } from "@/lib/logUserEvent";
import {
    Bookmark,
    ChevronRight,
    Flame,
    Beef,
    Wheat,
    Droplet,
    Search,
    Trash2,
    X,
} from "lucide-react";

type Ingredient = {
    name: string;
    quantity: string;
    category?: string;
    aisle?: string;
    price?: number;
};

type SavedMeal = {
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
    prompt?: string | null;
    savedAt?: any;
    imageUrl?: string;
};

export default function SavedMealsPage() {
    const router = useRouter();

    const [user, setUser] = useState<User | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [meals, setMeals] = useState<SavedMeal[]>([]);
    const [loadingMeals, setLoadingMeals] = useState(true);

    const [searchQuery, setSearchQuery] = useState("");
    const [mealToDelete, setMealToDelete] = useState<SavedMeal | null>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (firebaseUser) => {
            if (!firebaseUser) {
                router.push("/login");
                return;
            }

            setUser(firebaseUser);
            setLoadingUser(false);
        });

        return () => unsub();
    }, [router]);

    useEffect(() => {
        if (!user) return;

        setLoadingMeals(true);

        const mealsCol = collection(db, "savedMeals", user.uid, "meals");
        const q = query(mealsCol, orderBy("savedAt", "desc"));

        const unsub = onSnapshot(
            q,
            (snapshot) => {
                const docs: SavedMeal[] = snapshot.docs.map((d) => ({
                    id: d.id,
                    ...(d.data() as Omit<SavedMeal, "id">),
                }));
                setMeals(docs);
                setLoadingMeals(false);
            },
            (error) => {
                console.error("Error listening to saved meals", error);
                setMeals([]);
                setLoadingMeals(false);
            }
        );

        return () => unsub();
    }, [user]);

    const handleRemoveMeal = async (mealId: string) => {
        if (!user) return;

        try {
            await deleteDoc(doc(db, "savedMeals", user.uid, "meals", mealId));
            setMealToDelete(null);
        } catch (err) {
            console.error("Error deleting saved meal", err);
        }
    };

    const handleViewMeal = async (mealId: string) => {
        if (user) {
            logUserEvent(user.uid, {
                type: "meal_viewed",
                mealId,
            }).catch((err) => {
                console.error("Failed to log meal_viewed event:", err);
            });
        }

        router.push(`/saved-meals/${mealId}`);
    };

    const filteredMeals = meals.filter(
        (meal) =>
            meal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            meal.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loadingUser || loadingMeals) {
        return (
            <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-3 border-gray-200 border-t-[#4A90E2] rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-500">Loading saved meals...</p>
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

    return (
        <div className="min-h-screen bg-[#f8fafb]">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 px-6 py-6">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-[#4A90E2]/10 rounded-xl flex items-center justify-center">
                            <Bookmark className="w-5 h-5 text-[#4A90E2]" />
                        </div>
                        <div>
                            <h1 className="text-xl lg:text-2xl text-gray-900">Saved Meals</h1>
                            <p className="text-sm text-gray-500">
                                {meals.length} meal{meals.length !== 1 ? "s" : ""} saved
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search */}
            {meals.length > 0 && (
                <div className="px-6 pt-4">
                    <div className="max-w-3xl mx-auto">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search saved meals..."
                                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#4A90E2] focus:outline-none transition-colors"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="px-6 py-6">
                <div className="max-w-3xl mx-auto">
                    {meals.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Bookmark className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No saved meals yet</h3>
                            <p className="text-gray-500 mb-6">
                                When you save meals, they'll appear here for easy access.
                            </p>
                            <button
                                onClick={() => router.push("/prompt")}
                                className="px-6 py-3 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white rounded-xl shadow-lg hover:shadow-xl transition-all"
                            >
                                Generate new meals
                            </button>
                        </div>
                    ) : filteredMeals.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Search className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No matches found</h3>
                            <p className="text-gray-500">Try a different search term.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {filteredMeals.map((meal) => {
                                const thumbSrc =
                                    meal.imageUrl ??
                                    "https://placehold.co/256x256/e5e7eb/9ca3af?text=Meal";

                                return (
                                    <div
                                        key={meal.id}
                                        className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100 flex p-4 gap-4"
                                    >
                                        {/* Thumbnail - Left */}
                                        <div
                                            onClick={() => handleViewMeal(meal.id)}
                                            className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-xl overflow-hidden cursor-pointer"
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={thumbSrc}
                                                alt={meal.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>

                                        {/* Content - Right */}
                                        <div className="flex-1 flex flex-col min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="inline-block px-2 py-0.5 bg-gray-100 rounded-md text-xs font-medium text-gray-600 capitalize">
                                                    {meal.mealType}
                                                </span>
                                                <div className="w-5 h-5 bg-[#4A90E2] rounded-full flex items-center justify-center">
                                                    <Bookmark className="w-2.5 h-2.5 text-white fill-white" />
                                                </div>
                                            </div>
                                            <h2
                                                onClick={() => handleViewMeal(meal.id)}
                                                className="text-base font-medium text-gray-900 mb-1 line-clamp-1 cursor-pointer hover:text-[#4A90E2] transition-colors"
                                            >
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

                                            {/* Actions */}
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleViewMeal(meal.id)}
                                                    className="flex items-center gap-1 px-4 py-2 bg-[#4A90E2]/10 text-[#4A90E2] text-sm font-medium rounded-xl hover:bg-[#4A90E2]/20 transition-colors"
                                                >
                                                    <span>View meal</span>
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setMealToDelete(meal);
                                                    }}
                                                    className="flex items-center gap-1 px-3 py-2 text-red-500 text-sm hover:bg-red-50 rounded-xl transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    <span>Remove</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {mealToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setMealToDelete(null)}
                    />
                    <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl animate-scale-up">
                        <button
                            onClick={() => setMealToDelete(null)}
                            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-400" />
                        </button>

                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-6 h-6 text-red-500" />
                        </div>

                        <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
                            Remove saved meal?
                        </h3>
                        <p className="text-sm text-gray-500 text-center mb-6">
                            "{mealToDelete.name}" will be removed from your saved meals. This action cannot be undone.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setMealToDelete(null)}
                                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleRemoveMeal(mealToDelete.id)}
                                className="flex-1 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
