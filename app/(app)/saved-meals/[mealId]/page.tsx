"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
    doc,
    getDoc,
    collection,
    addDoc,
    serverTimestamp,
} from "firebase/firestore";
import {
    ArrowLeft,
    Flame,
    Beef,
    Wheat,
    Droplet,
    ShoppingCart,
    ChefHat,
    Users,
    CheckCircle,
    Clock,
    Bookmark,
} from "lucide-react";

type Ingredient = {
    name: string;
    quantity: string;
    category?: string;
    aisle?: string;
    price?: number;
    krogerProductId?: string;
    productName?: string;
    productImageUrl?: string;
    productSize?: string;
    productAisle?: string;
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

export default function SavedMealDetailPage() {
    const router = useRouter();
    const params = useParams();
    const mealId = params.mealId as string;

    const [user, setUser] = useState<User | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [meal, setMeal] = useState<SavedMeal | null>(null);
    const [loadingMeal, setLoadingMeal] = useState(true);

    const [addingToList, setAddingToList] = useState(false);
    const [addMessage, setAddMessage] = useState<string | null>(null);
    const [selectedIngredients, setSelectedIngredients] = useState<Set<number>>(new Set());
    const [krogerConnected, setKrogerConnected] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                router.push("/login");
                return;
            }

            setUser(firebaseUser);

            // Fetch user prefs to check Kroger connection
            try {
                const userRef = doc(db, "users", firebaseUser.uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    const data = userSnap.data();
                    setKrogerConnected(Boolean(data.krogerLinked));
                }
            } catch (err) {
                console.error("Error loading user prefs", err);
            }

            setLoadingUser(false);
        });

        return () => unsub();
    }, [router]);

    useEffect(() => {
        const fetchMeal = async () => {
            if (!user) return;

            setLoadingMeal(true);
            try {
                const ref = doc(db, "savedMeals", user.uid, "meals", mealId);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    setMeal({
                        id: snap.id,
                        ...(snap.data() as Omit<SavedMeal, "id">),
                    });
                } else {
                    setMeal(null);
                }
            } catch (err) {
                console.error("Error loading saved meal", err);
                setMeal(null);
            } finally {
                setLoadingMeal(false);
            }
        };

        fetchMeal();
    }, [user, mealId]);

    // Initialize all ingredients as selected when meal loads
    useEffect(() => {
        if (meal) {
            setSelectedIngredients(new Set(meal.ingredients.map((_, idx) => idx)));
        }
    }, [meal]);

    const toggleIngredient = (idx: number) => {
        setSelectedIngredients((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(idx)) {
                newSet.delete(idx);
            } else {
                newSet.add(idx);
            }
            return newSet;
        });
    };

    const toggleAllIngredients = () => {
        if (!meal) return;
        if (selectedIngredients.size === meal.ingredients.length) {
            setSelectedIngredients(new Set());
        } else {
            setSelectedIngredients(new Set(meal.ingredients.map((_, idx) => idx)));
        }
    };

    const handleAddToShoppingList = async () => {
        if (!user || !meal) return;
        if (selectedIngredients.size === 0) {
            setAddMessage("Please select at least one ingredient to add.");
            return;
        }

        try {
            setAddingToList(true);
            setAddMessage(null);

            const itemsCol = collection(db, "shoppingLists", user.uid, "items");
            const ingredientsToAdd = meal.ingredients.filter((_, idx) => selectedIngredients.has(idx));

            const writes = ingredientsToAdd.map((ing) =>
                addDoc(itemsCol, {
                    name: ing.name,
                    quantity: ing.quantity,
                    mealId: meal.id,
                    mealName: meal.name,
                    checked: false,
                    createdAt: serverTimestamp(),
                    krogerProductId: ing.krogerProductId ?? null,
                    productName: ing.productName ?? null,
                    productImageUrl: ing.productImageUrl ?? null,
                    productSize: ing.productSize ?? null,
                    productAisle: ing.productAisle ?? null,
                    price: typeof ing.price === "number" ? ing.price : null,
                })
            );

            await Promise.all(writes);

            setAddMessage(
                `Added ${ingredientsToAdd.length} item${ingredientsToAdd.length !== 1 ? "s" : ""} to your shopping list.`
            );
        } catch (err) {
            console.error("Error adding to shopping list", err);
            setAddMessage("Something went wrong adding items to your list.");
        } finally {
            setAddingToList(false);
        }
    };

    const formatSavedAt = (ts: any) => {
        const d = ts?.toDate?.() || new Date();
        const date = d.toLocaleDateString([], { month: "long", day: "numeric" });
        const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        return `${date} at ${time}`;
    };

    if (loadingUser || loadingMeal) {
        return (
            <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-3 border-gray-200 border-t-[#4A90E2] rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-500">Loading your meal...</p>
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

    if (!meal) {
        return (
            <div className="min-h-screen bg-[#f8fafb] px-6 py-8">
                <div className="max-w-2xl mx-auto text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Bookmark className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Meal not found</h3>
                    <p className="text-gray-500 mb-6">We couldn't find that saved meal.</p>
                    <button
                        onClick={() => router.push("/saved-meals")}
                        className="px-6 py-3 bg-[#4A90E2]/10 text-[#4A90E2] rounded-xl hover:bg-[#4A90E2]/20 transition-colors"
                    >
                        Back to saved meals
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafb]">
            {/* Header with Back Button */}
            <div className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-20">
                <div className="max-w-3xl mx-auto">
                    <button
                        onClick={() => router.push("/saved-meals")}
                        className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="text-sm">Back to saved meals</span>
                    </button>
                </div>
            </div>

            {/* Hero Section - Image Left, Content Right */}
            <div className="px-6 py-6">
                <div className="max-w-3xl mx-auto">
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-4">
                        {/* Thumbnail - Left */}
                        <div className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 bg-gray-100 rounded-xl overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={meal.imageUrl ?? "https://placehold.co/256x256/e5e7eb/9ca3af?text=Meal"}
                                alt={meal.name}
                                className="w-full h-full object-cover"
                            />
                        </div>

                        {/* Content - Right */}
                        <div className="flex-1 flex flex-col min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="inline-block px-2 py-0.5 bg-gray-100 rounded-md text-xs font-medium text-gray-600 capitalize">
                                    {meal.mealType}
                                </span>
                                <div className="w-5 h-5 bg-[#4A90E2] rounded-full flex items-center justify-center">
                                    <Bookmark className="w-2.5 h-2.5 text-white fill-white" />
                                </div>
                            </div>
                            <h1 className="text-lg sm:text-xl font-medium text-gray-900 mb-1 line-clamp-2">{meal.name}</h1>
                            <p className="text-sm text-gray-500 line-clamp-2">{meal.description}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-6 pb-6">
                <div className="max-w-3xl mx-auto space-y-6">
                    {/* Saved At Badge */}
                    {meal.savedAt && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-xl w-fit">
                            <Clock className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-600">
                                Saved {formatSavedAt(meal.savedAt)}
                            </span>
                        </div>
                    )}

                    {/* Original Prompt */}
                    {meal.prompt && (
                        <div className="bg-[#4A90E2]/5 border border-[#4A90E2]/20 rounded-2xl p-4">
                            <p className="text-xs font-medium text-[#4A90E2] uppercase tracking-wide mb-1">
                                Original request
                            </p>
                            <p className="text-sm text-gray-700">{meal.prompt}</p>
                        </div>
                    )}

                    {/* Macros Card */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Users className="w-5 h-5 text-gray-400" />
                            <span className="text-sm text-gray-500">{meal.servings} servings</span>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                            <div className="text-center">
                                <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <Flame className="w-6 h-6 text-orange-500" />
                                </div>
                                <div className="text-lg font-medium text-gray-900">{meal.macros.calories}</div>
                                <div className="text-xs text-gray-500">kcal</div>
                            </div>
                            <div className="text-center">
                                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <Beef className="w-6 h-6 text-blue-500" />
                                </div>
                                <div className="text-lg font-medium text-gray-900">{meal.macros.protein}g</div>
                                <div className="text-xs text-gray-500">Protein</div>
                            </div>
                            <div className="text-center">
                                <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <Wheat className="w-6 h-6 text-amber-500" />
                                </div>
                                <div className="text-lg font-medium text-gray-900">{meal.macros.carbs}g</div>
                                <div className="text-xs text-gray-500">Carbs</div>
                            </div>
                            <div className="text-center">
                                <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <Droplet className="w-6 h-6 text-purple-500" />
                                </div>
                                <div className="text-lg font-medium text-gray-900">{meal.macros.fat}g</div>
                                <div className="text-xs text-gray-500">Fat</div>
                            </div>
                        </div>
                    </div>

                    {/* Ingredients */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-medium text-gray-900">
                                Ingredients ({selectedIngredients.size} of {meal.ingredients.length} selected)
                            </h3>
                            <button
                                onClick={toggleAllIngredients}
                                className="text-sm text-[#4A90E2] hover:underline"
                            >
                                {selectedIngredients.size === meal.ingredients.length ? "Deselect all" : "Select all"}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">Uncheck items you already have at home</p>
                        <ul className="space-y-3">
                            {meal.ingredients.map((ing, idx) => (
                                <li
                                    key={idx}
                                    onClick={() => toggleIngredient(idx)}
                                    className={`flex items-center gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0 cursor-pointer transition-opacity ${
                                        !selectedIngredients.has(idx) ? "opacity-50" : ""
                                    }`}
                                >
                                    {krogerConnected && ing.productImageUrl ? (
                                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={ing.productImageUrl}
                                                alt={ing.productName || ing.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    ) : null}
                                    <div className="flex-1 min-w-0">
                                        <div className={`font-medium ${selectedIngredients.has(idx) ? "text-gray-900" : "text-gray-500 line-through"}`}>{ing.name}</div>
                                        <div className="text-sm text-gray-500">
                                            {ing.quantity}
                                            {ing.category && ` • ${ing.category}`}
                                            {krogerConnected && ing.productAisle && ` • ${ing.productAisle}`}
                                            {krogerConnected && typeof ing.price === "number" && (
                                                <span className="text-[#4A90E2]"> • ${ing.price.toFixed(2)}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0">
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                            selectedIngredients.has(idx)
                                                ? "bg-[#4A90E2] border-[#4A90E2]"
                                                : "border-gray-300 bg-white"
                                        }`}>
                                            {selectedIngredients.has(idx) && (
                                                <CheckCircle className="w-4 h-4 text-white" />
                                            )}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Cooking Steps */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <ChefHat className="w-5 h-5 text-gray-400" />
                            <h3 className="font-medium text-gray-900">Cooking Steps</h3>
                        </div>
                        <ol className="space-y-4">
                            {meal.steps.map((step, idx) => (
                                <li key={idx} className="flex gap-4">
                                    <div className="w-7 h-7 bg-[#4A90E2]/10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium text-[#4A90E2]">
                                        {idx + 1}
                                    </div>
                                    <p className="text-gray-600 text-sm pt-1">{step}</p>
                                </li>
                            ))}
                        </ol>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleAddToShoppingList}
                        disabled={addingToList || selectedIngredients.size === 0}
                        className="w-full py-4 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {addingToList ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Adding...</span>
                            </>
                        ) : (
                            <>
                                <ShoppingCart className="w-5 h-5" />
                                <span>Add {selectedIngredients.size} item{selectedIngredients.size !== 1 ? "s" : ""} to shopping list</span>
                            </>
                        )}
                    </button>

                    {/* Success Message */}
                    {addMessage && (
                        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                            <span className="text-sm text-emerald-700">{addMessage}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
