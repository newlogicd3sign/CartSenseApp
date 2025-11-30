"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
    doc,
    getDoc,
    collection,
    addDoc,
    serverTimestamp,
    setDoc,
} from "firebase/firestore";
import { logUserEvent } from "@/lib/logUserEvent";
import {
    ArrowLeft,
    Flame,
    Beef,
    Wheat,
    Droplet,
    Heart,
    ShoppingCart,
    Bookmark,
    Send,
    ChefHat,
    Users,
    CheckCircle,
    MessageCircle,
    ExternalLink,
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

type UserPrefs = {
    name?: string;
    dietType?: string;
    krogerConnected?: boolean;
    allergiesAndSensitivities?: {
        allergies?: string[];
        sensitivities?: string[];
    };
};

type MealThreadReply = {
    reply: string;
    action: "no_change" | "update_meal" | "new_meal_variant";
    updatedMeal?: Meal;
};

type ThreadMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: string;
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

export default function MealDetailPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();

    const mealId = params.mealId as string;
    const promptParam = searchParams.get("prompt") || "";
    const displayedPrompt = promptParam.trim();

    const [user, setUser] = useState<User | null>(null);
    const [prefs, setPrefs] = useState<UserPrefs | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [meal, setMeal] = useState<Meal | null>(null);
    const [loadingMeal, setLoadingMeal] = useState(true);

    const [addingToList, setAddingToList] = useState(false);
    const [addMessage, setAddMessage] = useState<string | null>(null);

    const [savingMeal, setSavingMeal] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    const [krogerConnected, setKrogerConnected] = useState(false);
    const [mealsMeta, setMealsMeta] = useState<MealsMeta | null>(null);

    const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
    const [threadInput, setThreadInput] = useState("");
    const [sendingThread, setSendingThread] = useState(false);
    const [threadError, setThreadError] = useState<string | null>(null);

    const [hasLoggedView, setHasLoggedView] = useState(false);
    const [selectedIngredients, setSelectedIngredients] = useState<Set<number>>(new Set());

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                router.push("/login");
                return;
            }

            setUser(firebaseUser);

            try {
                const ref = doc(db, "users", firebaseUser.uid);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data() as UserPrefs;
                    setPrefs(data);
                    setKrogerConnected(Boolean(data.krogerConnected));
                }
            } catch (err) {
                console.error("Error loading user prefs", err);
            } finally {
                setLoadingUser(false);
            }
        });

        return () => unsub();
    }, [router]);

    useEffect(() => {
        if (!user || !prefs) return;
        setLoadingMeal(true);

        try {
            const stored = sessionStorage.getItem("generatedMeals");
            if (!stored) {
                setMeal(null);
                setMealsMeta(null);
            } else {
                const parsed: StoredMealsPayload = JSON.parse(stored);

                let list: Meal[] = [];
                let meta: MealsMeta | null = null;

                if (Array.isArray(parsed)) {
                    list = parsed;
                    meta = null;
                } else {
                    list = parsed.meals ?? [];
                    meta = parsed.meta ?? null;
                }

                const found = list.find((m) => m.id === mealId) || null;
                setMeal(found);
                setMealsMeta(meta);
            }
        } catch (err) {
            console.error("Error reading meal from sessionStorage", err);
            setMeal(null);
            setMealsMeta(null);
        } finally {
            setLoadingMeal(false);
        }
    }, [user, prefs, mealId]);

    useEffect(() => {
        if (!user || !meal || hasLoggedView) return;

        logUserEvent(user.uid, {
            type: "meal_viewed",
            mealId: meal.id,
        }).catch((err) => {
            console.error("Failed to log meal_viewed event:", err);
        });

        setHasLoggedView(true);
    }, [user, meal, hasLoggedView]);

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

    const applyUpdatedMeal = (updatedMeal: Meal) => {
        setMeal(updatedMeal);

        try {
            const stored = sessionStorage.getItem("generatedMeals");
            if (!stored) return;

            const parsed: StoredMealsPayload = JSON.parse(stored);

            if (Array.isArray(parsed)) {
                const list = [...parsed];
                const idx = list.findIndex((m) => m.id === updatedMeal.id);
                if (idx >= 0) {
                    list[idx] = updatedMeal;
                    sessionStorage.setItem("generatedMeals", JSON.stringify(list));
                }
                return;
            }

            const list = Array.isArray(parsed.meals) ? [...parsed.meals] : [];
            const idx = list.findIndex((m) => m.id === updatedMeal.id);
            if (idx >= 0) {
                list[idx] = updatedMeal;
                const newPayload = { ...parsed, meals: list };
                sessionStorage.setItem("generatedMeals", JSON.stringify(newPayload));
            }
        } catch (err) {
            console.error("Error updating generatedMeals in sessionStorage", err);
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

            await Promise.all(
                ingredientsToAdd.map((ing) =>
                    addDoc(itemsCol, {
                        name: ing.name,
                        quantity: ing.quantity,
                        mealId: meal.id,
                        mealName: meal.name,
                        checked: false,
                        createdAt: serverTimestamp(),
                        krogerProductId: krogerConnected ? ing.krogerProductId ?? null : null,
                        productName: krogerConnected ? ing.productName ?? null : null,
                        productImageUrl: krogerConnected ? ing.productImageUrl ?? null : null,
                        productSize: krogerConnected ? ing.productSize ?? null : null,
                        productAisle: krogerConnected ? ing.productAisle ?? null : null,
                        price: krogerConnected && typeof ing.price === "number" ? ing.price : null,
                    })
                )
            );

            setAddMessage(`Added ${ingredientsToAdd.length} item${ingredientsToAdd.length !== 1 ? "s" : ""} to your shopping list.`);

            logUserEvent(user.uid, {
                type: "added_to_shopping_list",
                mealId: meal.id,
            }).catch((err) => {
                console.error("Failed to log added_to_shopping_list event:", err);
            });
        } catch (err) {
            console.error("Error adding to shopping list", err);
            setAddMessage("Something went wrong adding items to your list.");
        } finally {
            setAddingToList(false);
        }
    };

    const handleSaveMeal = async () => {
        if (!user || !meal) return;

        try {
            setSavingMeal(true);
            setSaveMessage(null);

            const mealRef = doc(db, "savedMeals", user.uid, "meals", meal.id);

            await setDoc(mealRef, {
                ...meal,
                prompt: displayedPrompt || null,
                savedAt: serverTimestamp(),
            });

            setSaveMessage("Meal saved to your account.");

            logUserEvent(user.uid, {
                type: "meal_saved",
                mealId: meal.id,
            }).catch((err) => {
                console.error("Failed to log meal_saved event:", err);
            });
        } catch (err) {
            console.error("Error saving meal", err);
            setSaveMessage("Something went wrong saving this meal.");
        } finally {
            setSavingMeal(false);
        }
    };

    const handleSendThreadMessage = async () => {
        if (!meal || !threadInput.trim()) return;

        const messageText = threadInput.trim();
        setThreadInput("");
        setThreadError(null);

        const newUserMsg: ThreadMessage = {
            id: `user-${Date.now()}`,
            role: "user",
            content: messageText,
            createdAt: new Date().toISOString(),
        };

        setThreadMessages((prev) => [...prev, newUserMsg]);
        setSendingThread(true);

        if (user) {
            logUserEvent(user.uid, {
                type: "thread_message",
                mealId: meal.id,
                message: messageText,
            }).catch((err) => {
                console.error("Failed to log thread_message event:", err);
            });
        }

        try {
            const res = await fetch("/api/meal-thread", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    meal,
                    prefs: prefs || undefined,
                    message: messageText,
                }),
            });

            if (!res.ok) {
                throw new Error("Failed to update meal");
            }

            const data = (await res.json()) as MealThreadReply;

            const fullReply = data.reply || "";
            const assistantId = `assistant-${Date.now()}`;

            const assistantMsg: ThreadMessage = {
                id: assistantId,
                role: "assistant",
                content: "",
                createdAt: new Date().toISOString(),
            };

            setThreadMessages((prev) => [...prev, assistantMsg]);

            let index = 0;
            const step = 3;
            const delay = 20;

            const intervalId = window.setInterval(() => {
                index += step;
                if (index >= fullReply.length) {
                    index = fullReply.length;
                }

                const partial = fullReply.slice(0, index);

                setThreadMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === assistantId ? { ...msg, content: partial } : msg
                    )
                );

                if (index >= fullReply.length) {
                    window.clearInterval(intervalId);
                }
            }, delay);

            if (
                data.action !== "no_change" &&
                data.updatedMeal &&
                typeof data.updatedMeal === "object"
            ) {
                applyUpdatedMeal(data.updatedMeal);
            }
        } catch (err) {
            console.error("Error in /api/meal-thread", err);
            setThreadError("Something went wrong updating this meal.");
        } finally {
            setSendingThread(false);
        }
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
                        <ChefHat className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Meal not found</h3>
                    <p className="text-gray-500 mb-6">We couldn't find that meal.</p>
                    <button
                        onClick={() => router.push(`/meals?prompt=${promptParam}`)}
                        className="px-6 py-3 bg-[#4A90E2]/10 text-[#4A90E2] rounded-xl hover:bg-[#4A90E2]/20 transition-colors"
                    >
                        Back to your meals
                    </button>
                </div>
            </div>
        );
    }

    const doctorApplied = Boolean(mealsMeta?.usedDoctorInstructions);

    return (
        <div className="min-h-screen bg-[#f8fafb]">
            {/* Header with Back Button */}
            <div className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-20">
                <div className="max-w-3xl mx-auto">
                    <button
                        onClick={() => router.push(`/meals?prompt=${promptParam}`)}
                        className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="text-sm">Back to meals</span>
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
                            <span className="inline-block self-start px-2 py-0.5 bg-gray-100 rounded-md text-xs font-medium text-gray-600 capitalize mb-2">
                                {meal.mealType}
                            </span>
                            <h1 className="text-lg sm:text-xl font-medium text-gray-900 mb-1 line-clamp-2">{meal.name}</h1>
                            <p className="text-sm text-gray-500 line-clamp-2">{meal.description}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
                <div className="max-w-3xl mx-auto space-y-6">
                    {/* Doctor Badge */}
                    {doctorApplied && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl w-fit">
                            <Heart className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm font-medium text-emerald-700">
                                Generated with your doctor's instructions
                            </span>
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

                    {/* Ask AI Section */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <MessageCircle className="w-5 h-5 text-[#4A90E2]" />
                            <h3 className="font-medium text-gray-900">Ask CartSense about this meal</h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">
                            Swap ingredients, make it dairy-free, lower sodium, change servings, or create a variant.
                        </p>

                        {threadMessages.length > 0 && (
                            <div className="max-h-60 overflow-y-auto mb-4 space-y-2 p-3 bg-gray-50 rounded-xl">
                                {threadMessages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                    >
                                        <div
                                            className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                                                msg.role === "user"
                                                    ? "bg-[#4A90E2] text-white"
                                                    : "bg-white border border-gray-200 text-gray-700"
                                            }`}
                                        >
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={threadInput}
                                onChange={(e) => setThreadInput(e.target.value)}
                                placeholder="E.g. make this dairy-free..."
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey && !sendingThread) {
                                        e.preventDefault();
                                        handleSendThreadMessage();
                                    }
                                }}
                                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#4A90E2] focus:outline-none transition-colors"
                            />
                            <button
                                onClick={handleSendThreadMessage}
                                disabled={sendingThread || !threadInput.trim()}
                                className="px-4 py-3 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {sendingThread ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Send className="w-5 h-5" />
                                )}
                            </button>
                        </div>

                        {threadError && (
                            <p className="mt-2 text-sm text-red-500">{threadError}</p>
                        )}
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
                                        {krogerConnected && ing.krogerProductId && (
                                            <a
                                                href={`https://www.kroger.com/p/${ing.krogerProductId}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="inline-flex items-center gap-1 text-xs text-[#4A90E2] mt-1 hover:underline"
                                            >
                                                View at Kroger
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        )}
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

                    {/* Action Buttons */}
                    <div className="space-y-3">
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

                        <button
                            onClick={handleSaveMeal}
                            disabled={savingMeal}
                            className="w-full py-4 bg-white border-2 border-[#4A90E2] text-[#4A90E2] rounded-2xl hover:bg-[#4A90E2]/5 transition-colors active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {savingMeal ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-[#4A90E2]/30 border-t-[#4A90E2] rounded-full animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <Bookmark className="w-5 h-5" />
                                    <span>Save meal for later</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Success Messages */}
                    {(addMessage || saveMessage) && (
                        <div className="space-y-2">
                            {addMessage && (
                                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                                    <span className="text-sm text-emerald-700">{addMessage}</span>
                                </div>
                            )}
                            {saveMessage && (
                                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                                    <span className="text-sm text-emerald-700">{saveMessage}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
