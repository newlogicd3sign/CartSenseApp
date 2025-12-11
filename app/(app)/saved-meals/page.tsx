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
    Search,
    Trash2,
} from "lucide-react";
import { getRandomAccentColor, type AccentColor } from "@/lib/utils";
import { LoadingScreen } from "@/components/LoadingScreen";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { MealCard } from "@/components/MealCard";

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
        fiber: number;
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
    const [accentColor, setAccentColor] = useState<AccentColor>({ primary: "#3b82f6", dark: "#2563eb" });

    useEffect(() => {
        setAccentColor(getRandomAccentColor());
    }, []);

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
        return <LoadingScreen message="Loading saved meals..." />;
    }

    if (!user) {
        return <LoadingScreen message="Redirecting to login..." />;
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
                        <EmptyState
                            icon={<Bookmark className="w-8 h-8 text-gray-400" />}
                            title="No saved meals yet"
                            description="When you save meals, they'll appear here for easy access."
                            action={{
                                label: "Generate new meals",
                                onClick: () => router.push("/prompt"),
                                variant: "gradient",
                                gradientColors: accentColor,
                            }}
                        />
                    ) : filteredMeals.length === 0 ? (
                        <EmptyState
                            icon={<Search className="w-8 h-8 text-gray-400" />}
                            title="No matches found"
                            description="Try a different search term."
                        />
                    ) : (
                        <div className="flex flex-col gap-3">
                            {filteredMeals.map((meal) => (
                                <MealCard
                                    key={meal.id}
                                    id={meal.id}
                                    name={meal.name}
                                    description={meal.description}
                                    mealType={meal.mealType}
                                    macros={meal.macros}
                                    imageUrl={meal.imageUrl}
                                    onClick={() => handleViewMeal(meal.id)}
                                    badge={
                                        <div className="w-5 h-5 bg-[#4A90E2] rounded-full flex items-center justify-center">
                                            <Bookmark className="w-2.5 h-2.5 text-white fill-white" />
                                        </div>
                                    }
                                    actionButton={
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMealToDelete(meal);
                                            }}
                                            className="inline-flex items-center justify-center w-6 h-6 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    }
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={!!mealToDelete}
                onClose={() => setMealToDelete(null)}
                onConfirm={() => mealToDelete && handleRemoveMeal(mealToDelete.id)}
                icon={<Trash2 className="w-6 h-6 text-red-500" />}
                title="Remove saved meal?"
                description={
                    mealToDelete
                        ? `"${mealToDelete.name}" will be removed from your saved meals. This action cannot be undone.`
                        : ""
                }
                confirmLabel="Remove"
                variant="danger"
            />
        </div>
    );
}
