"use client";

import { Suspense, useEffect, useState, useRef, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
    doc,
    getDoc,
    getDocs,
    collection,
    addDoc,
    updateDoc,
    serverTimestamp,
    setDoc,
} from "firebase/firestore";
import { logUserEvent } from "@/lib/logUserEvent";
import {
    loadGeneratedMeals,
    updateMealInStorage,
    saveLastViewedMeal,
} from "@/lib/mealStorage";
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
    X,
    AlertCircle,
    Sparkles,
    RefreshCw,
    PencilRuler,
    Ham,
    Egg,
    Milk,
    Leaf,
    Cookie,
    Package,
    Bean,
    FlaskConical,
    Apple,
    Clock,
    Home,
} from "lucide-react";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { useToast } from "@/components/Toast";
import { LoadingScreen } from "@/components/LoadingScreen";
import {
    isStapleItem,
    isSameIngredient,
    isExcludedIngredient,
    getRandomAccentColor,
} from "@/lib/utils";
import { getIngredientCategory } from "@/lib/ingredientQualityRules";

type Ingredient = {
    name: string;
    quantity: string;
    category?: string;
    aisle?: string;
    price?: number;
    soldBy?: "WEIGHT" | "UNIT";
    stockLevel?: string; // HIGH, LOW, or TEMPORARILY_OUT_OF_STOCK
    available?: boolean;
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

type UserPrefs = {
    name?: string;
    dietType?: string;
    krogerLinked?: boolean;
    defaultKrogerLocationId?: string | null;
    allergiesAndSensitivities?: {
        allergies?: string[];
        sensitivities?: string[];
    };
    isPremium?: boolean;
    monthlyChatCount?: number;
    chatPeriodStart?: { toDate: () => Date } | null;
};

type KrogerProduct = {
    krogerProductId: string;
    name: string;
    imageUrl?: string;
    price?: number;
    size?: string;
    aisle?: string;
};

type EnrichedItem = {
    originalName: string;
    quantity: string;
    found: boolean;
    product?: KrogerProduct;
};

type KrogerCartResponse = {
    success: boolean;
    message: string;
    enrichedItems?: EnrichedItem[];
    addedCount?: number;
    notFoundCount?: number;
    error?: string;
};

type MealThreadReply = {
    reply: string;
    action: "no_change" | "update_meal" | "new_meal_variant";
    updatedMeal?: Meal;
    monthlyChatCount?: number;
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
    pantryMode?: boolean;
};

type StoredMealsPayload =
    | {
    meals: Meal[];
    meta?: MealsMeta;
}
    | Meal[];

function MealDetailPageContent() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const { showToast } = useToast();

    const mealId = params.mealId as string;
    const promptParam = searchParams.get("prompt") || "";
    const displayedPrompt = promptParam.trim();

    const [user, setUser] = useState<User | null>(null);
    const [prefs, setPrefs] = useState<UserPrefs | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [meal, setMeal] = useState<Meal | null>(null);
    const [loadingMeal, setLoadingMeal] = useState(true);

    const [addingToList, setAddingToList] = useState(false);

    const [savingMeal, setSavingMeal] = useState(false);
    const [isMealAlreadySaved, setIsMealAlreadySaved] = useState(false);

    const [krogerConnected, setKrogerConnected] = useState(false);
    const [mealsMeta, setMealsMeta] = useState<MealsMeta | null>(null);

    const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
    const [threadInput, setThreadInput] = useState("");
    const [sendingThread, setSendingThread] = useState(false);
    const [threadError, setThreadError] = useState<string | null>(null);

    const [hasLoggedView, setHasLoggedView] = useState(false);
    const [selectedIngredients, setSelectedIngredients] = useState<Set<number>>(new Set());

    // Kroger cart state
    const [krogerStoreSet, setKrogerStoreSet] = useState(false);
    const [addingToKrogerCart, setAddingToKrogerCart] = useState(false);
    const [krogerResults, setKrogerResults] = useState<EnrichedItem[] | null>(null);
    const [showKrogerResults, setShowKrogerResults] = useState(false);

    // Lazy loading Kroger enrichment state
    const [enrichingKroger, setEnrichingKroger] = useState(false);
    const [hasEnrichedKroger, setHasEnrichedKroger] = useState(false);
    const [enrichedIngredients, setEnrichedIngredients] = useState<Ingredient[] | null>(null);

    // Chat limit state
    const [monthlyChatCount, setMonthlyChatCount] = useState(0);
    const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
    const [upgradeReason, setUpgradeReason] = useState<"limit_reached" | "voluntary">("limit_reached");
    const FREE_CHAT_LIMIT = 6;

    // Ref for chat messages container to control scrolling
    const chatMessagesRef = useRef<HTMLDivElement>(null);

    // Ingredient modal state
    const [selectedIngredientIndex, setSelectedIngredientIndex] = useState<number | null>(null);
    const [swappingIngredient, setSwappingIngredient] = useState(false);
    const [swapAlternatives, setSwapAlternatives] = useState<{
        krogerProductId: string;
        name: string;
        imageUrl?: string;
        price?: number;
        size?: string;
        aisle?: string;
    }[] | null>(null);
    const [loadingSwapSuggestions, setLoadingSwapSuggestions] = useState(false);
    const [showSwapOptions, setShowSwapOptions] = useState(false);

    // Random color for back button
    const backButtonColor = useMemo(() => getRandomAccentColor(), []);

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
                    setKrogerConnected(Boolean(data.krogerLinked));
                    setKrogerStoreSet(Boolean(data.defaultKrogerLocationId));

                    // Load chat count, resetting if period expired
                    let chatCount = data.monthlyChatCount ?? 0;
                    if (data.chatPeriodStart) {
                        const periodStart = data.chatPeriodStart.toDate();
                        const daysSinceStart = (Date.now() - periodStart.getTime()) / (1000 * 60 * 60 * 24);
                        if (daysSinceStart >= 30) {
                            chatCount = 0;
                        }
                    }
                    setMonthlyChatCount(chatCount);
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

        const stored = loadGeneratedMeals();
        if (!stored || !stored.meals) {
            setMeal(null);
            setMealsMeta(null);
        } else {
            const found = stored.meals.find((m) => m.id === mealId) || null;
            setMeal(found);
            setMealsMeta(stored.meta ?? null);

            // Save last viewed meal for restoration when returning to the app
            if (found) {
                saveLastViewedMeal(mealId, displayedPrompt);
            }
        }

        setLoadingMeal(false);
    }, [user, prefs, mealId, displayedPrompt]);

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

    // Scroll to top only on initial page load (not on meal updates)
    const hasScrolledToTop = useRef(false);
    useEffect(() => {
        if (!loadingMeal && meal && !hasScrolledToTop.current) {
            window.scrollTo(0, 0);
            hasScrolledToTop.current = true;
        }
    }, [loadingMeal, meal]);

    // Check if meal is already saved
    useEffect(() => {
        if (!user || !meal) return;

        const checkIfSaved = async () => {
            try {
                const mealRef = doc(db, "savedMeals", user.uid, "meals", meal.id);
                const mealSnap = await getDoc(mealRef);
                setIsMealAlreadySaved(mealSnap.exists());
            } catch (err) {
                console.error("Error checking if meal is saved:", err);
            }
        };

        checkIfSaved();
    }, [user, meal]);

    // Initialize all ingredients as selected when meal loads
    useEffect(() => {
        if (meal) {
            setSelectedIngredients(new Set(meal.ingredients.map((_, idx) => idx)));
        }
    }, [meal]);

    // Scroll chat container to bottom when messages change (without affecting page scroll)
    useEffect(() => {
        if (chatMessagesRef.current && threadMessages.length > 0) {
            chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
        }
    }, [threadMessages]);

    // Lazy load Kroger enrichment when viewing meal (only if Kroger is connected and not in pantry mode)
    useEffect(() => {
        // Skip Kroger enrichment in pantry mode - user is cooking with what they have
        if (!user || !meal || !krogerConnected || !krogerStoreSet || hasEnrichedKroger || mealsMeta?.pantryMode) return;

        // Check if any ingredient already has Kroger data (already enriched)
        const alreadyEnriched = meal.ingredients.some(ing => ing.krogerProductId);
        if (alreadyEnriched) {
            setHasEnrichedKroger(true);
            setEnrichedIngredients(meal.ingredients);
            return;
        }

        const enrichIngredients = async () => {
            setEnrichingKroger(true);
            try {
                const res = await fetch("/api/kroger/enrich", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userId: user.uid,
                        ingredients: meal.ingredients,
                    }),
                });

                const data = await res.json();

                if (data.success && data.ingredients) {
                    // Store enriched ingredients separately - don't replace meal state
                    // This prevents a jarring full re-render when scrolling
                    setEnrichedIngredients(data.ingredients);
                }
            } catch (err) {
                console.error("Error enriching ingredients with Kroger data:", err);
            } finally {
                setEnrichingKroger(false);
                setHasEnrichedKroger(true);
            }
        };

        enrichIngredients();
    }, [user, meal, krogerConnected, krogerStoreSet, hasEnrichedKroger, mealsMeta?.pantryMode]);

    // Use enriched ingredients if available, otherwise fall back to meal ingredients
    const displayIngredients = enrichedIngredients ?? meal?.ingredients ?? [];

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
        if (selectedIngredients.size === displayIngredients.length) {
            setSelectedIngredients(new Set());
        } else {
            setSelectedIngredients(new Set(displayIngredients.map((_, idx) => idx)));
        }
    };

    const applyUpdatedMeal = (updatedMeal: Meal) => {
        setMeal(updatedMeal);

        // Reset enriched ingredients so the new ingredients are displayed
        // and can be re-enriched with Kroger data
        setEnrichedIngredients(null);
        setHasEnrichedKroger(false);

        // Reset saved state so user can save the modified meal
        setIsMealAlreadySaved(false);

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
            showToast("Please select at least one ingredient to add.", "error");
            return;
        }

        try {
            setAddingToList(true);

            const itemsCol = collection(db, "shoppingLists", user.uid, "items");
            const ingredientsToAdd = displayIngredients.filter((_, idx) => selectedIngredients.has(idx));

            // Fetch existing shopping list items to check for duplicates
            const existingSnapshot = await getDocs(itemsCol);
            const existingItems = existingSnapshot.docs.map((d) => ({
                id: d.id,
                name: d.data().name as string,
                count: (d.data().count as number) || 1,
            }));

            // Separate items into: to update (increment count), to add (new), and to skip (staples)
            let skippedStaples = 0;
            const itemsToUpdate: { id: string; newCount: number }[] = [];
            const itemsToAdd: typeof ingredientsToAdd = [];

            for (const ing of ingredientsToAdd) {
                // Skip excluded ingredients like water (you don't need to buy these)
                if (isExcludedIngredient(ing.name)) {
                    continue;
                }

                // Check if this ingredient already exists in the shopping list
                const existingMatch = existingItems.find((existing) =>
                    isSameIngredient(existing.name, ing.name)
                );

                if (existingMatch) {
                    // If it's a staple item, skip it entirely (don't need multiple olive oils)
                    if (isStapleItem(ing.name)) {
                        skippedStaples++;
                        continue;
                    }
                    // For countable items, increment the count
                    itemsToUpdate.push({
                        id: existingMatch.id,
                        newCount: existingMatch.count + 1,
                    });
                    // Update the local count so subsequent duplicates in the same batch stack correctly
                    existingMatch.count += 1;
                } else {
                    itemsToAdd.push(ing);
                }
            }

            // Update existing items (increment count)
            if (itemsToUpdate.length > 0) {
                await Promise.all(
                    itemsToUpdate.map(({ id, newCount }) =>
                        updateDoc(doc(db, "shoppingLists", user.uid, "items", id), {
                            count: newCount,
                        })
                    )
                );
            }

            // Add new items
            if (itemsToAdd.length > 0) {
                await Promise.all(
                    itemsToAdd.map((ing) =>
                        addDoc(itemsCol, {
                            name: ing.name,
                            quantity: ing.quantity,
                            count: 1,
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
                            soldBy: krogerConnected ? ing.soldBy ?? null : null,
                            stockLevel: krogerConnected ? ing.stockLevel ?? null : null,
                        })
                    )
                );
            }

            const itemsToActuallyAdd = itemsToAdd;

            // Automatically save the meal when adding to shopping list
            if (!isMealAlreadySaved) {
                const mealRef = doc(db, "savedMeals", user.uid, "meals", meal.id);
                await setDoc(mealRef, {
                    ...meal,
                    prompt: displayedPrompt || null,
                    savedAt: serverTimestamp(),
                });
                setIsMealAlreadySaved(true);
            }

            // Build appropriate toast message
            let toastMessage = "";
            const addedCount = itemsToActuallyAdd.length;
            const updatedCount = itemsToUpdate.length;

            if (addedCount > 0 && updatedCount > 0) {
                toastMessage = `Added ${addedCount} item${addedCount !== 1 ? "s" : ""}, updated ${updatedCount} item${updatedCount !== 1 ? "s" : ""}.`;
            } else if (addedCount > 0 && skippedStaples > 0) {
                toastMessage = `Added ${addedCount} item${addedCount !== 1 ? "s" : ""}, skipped ${skippedStaples} already in list.`;
            } else if (addedCount > 0) {
                toastMessage = `Added ${addedCount} item${addedCount !== 1 ? "s" : ""} to your shopping list.`;
            } else if (updatedCount > 0) {
                toastMessage = `Updated quantities for ${updatedCount} item${updatedCount !== 1 ? "s" : ""}.`;
            } else if (skippedStaples > 0) {
                toastMessage = `All items already in your shopping list.`;
            }

            showToast(toastMessage, "success");

            // Log both events
            logUserEvent(user.uid, {
                type: "added_to_shopping_list",
                mealId: meal.id,
            }).catch((err) => {
                console.error("Failed to log added_to_shopping_list event:", err);
            });

            logUserEvent(user.uid, {
                type: "meal_saved",
                mealId: meal.id,
            }).catch((err) => {
                console.error("Failed to log meal_saved event:", err);
            });
        } catch (err) {
            console.error("Error adding to shopping list", err);
            showToast("Something went wrong adding items to your list.", "error");
        } finally {
            setAddingToList(false);
        }
    };

    const handleSaveMeal = async () => {
        if (!user || !meal) return;

        // Prevent saving if already saved
        if (isMealAlreadySaved) {
            showToast("This meal is already saved.", "info");
            return;
        }

        try {
            setSavingMeal(true);

            const mealRef = doc(db, "savedMeals", user.uid, "meals", meal.id);

            await setDoc(mealRef, {
                ...meal,
                prompt: displayedPrompt || null,
                savedAt: serverTimestamp(),
            });

            setIsMealAlreadySaved(true);
            showToast("Meal saved to your account.", "success");

            logUserEvent(user.uid, {
                type: "meal_saved",
                mealId: meal.id,
            }).catch((err) => {
                console.error("Failed to log meal_saved event:", err);
            });
        } catch (err) {
            console.error("Error saving meal", err);
            showToast("Something went wrong saving this meal.", "error");
        } finally {
            setSavingMeal(false);
        }
    };

    const handleAddToKrogerCart = async () => {
        if (!user || !meal) return;
        if (selectedIngredients.size === 0) {
            showToast("Please select at least one ingredient to add.", "error");
            return;
        }

        setAddingToKrogerCart(true);
        setKrogerResults(null);

        try {
            const ingredientsToAdd = displayIngredients.filter((_, idx) => selectedIngredients.has(idx));
            const cartItems = ingredientsToAdd.map((ing, idx) => ({
                id: `${meal.id}-${idx}`,
                name: ing.name,
                quantity: ing.quantity,
            }));

            const res = await fetch("/api/kroger/cart", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.uid, items: cartItems }),
            });

            const data = (await res.json()) as KrogerCartResponse;

            if (!res.ok) {
                if (data.error === "NOT_LINKED" || data.error === "TOKEN_EXPIRED") {
                    setKrogerConnected(false);
                    showToast(data.message || "Please link your Kroger account first.", "error");
                } else if (data.error === "NO_STORE") {
                    setKrogerStoreSet(false);
                    showToast(data.message || "Please select a Kroger store first.", "error");
                } else {
                    showToast(data.message || "Failed to add items to Kroger cart.", "error");
                }
            } else {
                showToast(data.message || "Items added to your Kroger cart!", "success");

                // Also save the meal when adding to Kroger cart
                if (!isMealAlreadySaved) {
                    const mealRef = doc(db, "savedMeals", user.uid, "meals", meal.id);
                    await setDoc(mealRef, {
                        ...meal,
                        prompt: displayedPrompt || null,
                        savedAt: serverTimestamp(),
                    });
                    setIsMealAlreadySaved(true);
                }

                logUserEvent(user.uid, {
                    type: "added_to_kroger_cart",
                    mealId: meal.id,
                }).catch((err) => {
                    console.error("Failed to log added_to_kroger_cart event:", err);
                });
            }

            if (data.enrichedItems && data.enrichedItems.length > 0) {
                setKrogerResults(data.enrichedItems);
                setShowKrogerResults(true);
            }
        } catch (err) {
            console.error("Error adding to Kroger cart:", err);
            showToast("Something went wrong. Please try again.", "error");
        } finally {
            setAddingToKrogerCart(false);
        }
    };

    const handleShowSwapOptions = async () => {
        if (!meal || !user || selectedIngredientIndex === null) return;

        // Check if Kroger is connected
        if (!krogerConnected || !krogerStoreSet) {
            showToast("Connect your Kroger account to swap products.", "error");
            return;
        }

        const ing = displayIngredients[selectedIngredientIndex];
        if (!ing) return;

        setLoadingSwapSuggestions(true);
        setSwapAlternatives(null);

        try {
            const res = await fetch("/api/swap-suggestions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user.uid,
                    ingredientName: ing.name,
                    currentProductId: ing.krogerProductId,
                    searchTerm: ing.name, // Use ingredient name for search
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.error === "NOT_LINKED" || data.error === "NO_STORE") {
                    showToast(data.message, "error");
                    return;
                }
                throw new Error(data.message || "Failed to get swap suggestions");
            }

            if (data.alternatives && data.alternatives.length > 0) {
                setSwapAlternatives(data.alternatives);
                setShowSwapOptions(true);
            } else {
                showToast("No alternative products found.", "info");
            }
        } catch (err) {
            console.error("Error getting swap suggestions:", err);
            showToast("Something went wrong getting swap options.", "error");
        } finally {
            setLoadingSwapSuggestions(false);
        }
    };

    const handleSelectSwap = (product: {
        krogerProductId: string;
        name: string;
        imageUrl?: string;
        price?: number;
        size?: string;
        aisle?: string;
    }) => {
        if (!meal || selectedIngredientIndex === null) return;

        setSwappingIngredient(true);

        // Use displayIngredients as source to preserve all existing Kroger data
        const currentIngredients = enrichedIngredients ?? meal.ingredients;
        const oldIngredient = currentIngredients[selectedIngredientIndex];

        // Create the swapped ingredient with updated Kroger product
        const swappedIngredient: Ingredient = {
            ...oldIngredient,
            krogerProductId: product.krogerProductId,
            productName: product.name,
            productImageUrl: product.imageUrl,
            productSize: product.size,
            productAisle: product.aisle,
            price: product.price,
        };

        // Update enrichedIngredients to show the new product immediately
        // This preserves all other ingredients' Kroger data
        const updatedEnriched = [...currentIngredients];
        updatedEnriched[selectedIngredientIndex] = swappedIngredient;
        setEnrichedIngredients(updatedEnriched);

        // Also update the meal state (for sessionStorage persistence)
        const updatedMealIngredients = [...meal.ingredients];
        updatedMealIngredients[selectedIngredientIndex] = {
            ...meal.ingredients[selectedIngredientIndex],
            krogerProductId: product.krogerProductId,
            productName: product.name,
            productImageUrl: product.imageUrl,
            productSize: product.size,
            productAisle: product.aisle,
            price: product.price,
        };

        const updatedMeal: Meal = {
            ...meal,
            ingredients: updatedMealIngredients,
        };

        // Update meal state and sessionStorage WITHOUT triggering re-enrichment
        setMeal(updatedMeal);
        try {
            const stored = sessionStorage.getItem("generatedMeals");
            if (stored) {
                const parsed: StoredMealsPayload = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    const list = [...parsed];
                    const idx = list.findIndex((m) => m.id === updatedMeal.id);
                    if (idx >= 0) {
                        list[idx] = updatedMeal;
                        sessionStorage.setItem("generatedMeals", JSON.stringify(list));
                    }
                } else {
                    const list = Array.isArray(parsed.meals) ? [...parsed.meals] : [];
                    const idx = list.findIndex((m) => m.id === updatedMeal.id);
                    if (idx >= 0) {
                        list[idx] = updatedMeal;
                        const newPayload = { ...parsed, meals: list };
                        sessionStorage.setItem("generatedMeals", JSON.stringify(newPayload));
                    }
                }
            }
        } catch (err) {
            console.error("Error updating generatedMeals in sessionStorage", err);
        }

        showToast(`Swapped to ${product.name}!`, "success");

        // Log the swap event
        if (user) {
            logUserEvent(user.uid, {
                type: "ingredient_swapped",
                mealId: meal.id,
                oldIngredient: oldIngredient.productName || oldIngredient.name,
                newIngredient: product.name,
            }).catch((err) => {
                console.error("Failed to log ingredient_swapped event:", err);
            });
        }

        // Close modals
        setShowSwapOptions(false);
        setSwapAlternatives(null);
        setSelectedIngredientIndex(null);
        setSwappingIngredient(false);
    };

    const handleSendThreadMessage = async () => {
        if (!meal || !threadInput.trim() || !user) return;

        // Check chat limit for free users
        if (!prefs?.isPremium && monthlyChatCount >= FREE_CHAT_LIMIT) {
            setUpgradeReason("limit_reached");
            setShowUpgradePrompt(true);
            return;
        }

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

        logUserEvent(user.uid, {
            type: "thread_message",
            mealId: meal.id,
            message: messageText,
        }).catch((err) => {
            console.error("Failed to log thread_message event:", err);
        });

        try {
            // Build history from threadMessages (only text content, limited to last 10)
            const historyForApi = threadMessages.slice(-10).map((msg) => ({
                role: msg.role,
                content: msg.content,
            }));

            const res = await fetch("/api/meal-thread", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user.uid,
                    meal,
                    prefs: prefs || undefined,
                    message: messageText,
                    history: historyForApi,
                    originalPrompt: displayedPrompt || undefined,
                }),
            });

            const data = (await res.json()) as MealThreadReply & { error?: string; message?: string };

            if (!res.ok) {
                if (data.error === "CHAT_LIMIT_REACHED") {
                    setUpgradeReason("limit_reached");
                    setShowUpgradePrompt(true);
                    // Remove the optimistically added user message
                    setThreadMessages((prev) => prev.filter((msg) => msg.id !== newUserMsg.id));
                    return;
                }
                throw new Error(data.message || "Failed to update meal");
            }

            // Update chat count from server response
            if (typeof data.monthlyChatCount === "number") {
                setMonthlyChatCount(data.monthlyChatCount);
            }

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
        return <LoadingScreen message="Loading your meal..." />;
    }

    if (!user) {
        return <LoadingScreen message="Redirecting to login..." />;
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
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:opacity-80"
                        style={{
                            backgroundColor: `${backButtonColor.primary}15`,
                            color: backButtonColor.dark,
                        }}
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-medium">Back to meals</span>
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
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="inline-block px-2 py-0.5 bg-gray-100 rounded-md text-xs font-medium text-gray-600 capitalize">
                                    {meal.mealType}
                                </span>
                                {meal.cookTimeRange && (
                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-sky-50 border border-sky-200 rounded-full">
                                        <Clock className="w-3 h-3 text-sky-600" />
                                        <span className="text-[10px] font-medium text-sky-700">{meal.cookTimeRange.min}-{meal.cookTimeRange.max}m</span>
                                    </div>
                                )}
                            </div>
                            <h1 className="text-lg sm:text-xl font-medium text-gray-900 mb-1">{meal.name}</h1>
                            <p className="text-sm text-gray-500">{meal.description}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
                <div className="max-w-3xl mx-auto space-y-6">
                    {/* Status Badges */}
                    <div className="flex flex-wrap gap-2">
                        {mealsMeta?.pantryMode && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                                <Home className="w-4 h-4 text-amber-600" />
                                <span className="text-sm font-medium text-amber-700">
                                    Pantry Mode — cook with what you have
                                </span>
                            </div>
                        )}
                        {doctorApplied && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                                <Heart className="w-4 h-4 text-emerald-500" />
                                <span className="text-sm font-medium text-emerald-700">
                                    Generated with your diet instructions
                                </span>
                            </div>
                        )}
                    </div>

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
                            <div className="text-center" title={`${meal.macros.carbs}g total carbs - ${meal.macros.fiber ?? 0}g fiber`}>
                                <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <Wheat className="w-6 h-6 text-amber-500" />
                                </div>
                                <div className="text-lg font-medium text-gray-900">{Math.max(0, meal.macros.carbs - (meal.macros.fiber ?? 0))}g</div>
                                <div className="text-xs text-gray-500">Net Carbs</div>
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
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <MessageCircle className="w-5 h-5 text-[#4A90E2]" />
                                <h3 className="font-medium text-gray-900">Ask AI</h3>
                            </div>
                            {prefs?.isPremium ? (
                                <div className="flex items-center gap-1 px-2 py-1 bg-violet-100 rounded-full">
                                    <Sparkles className="w-3 h-3 text-violet-600" />
                                    <span className="text-xs font-medium text-violet-700">Premium</span>
                                </div>
                            ) : (
                                <button
                                    onClick={() => {
                                        setUpgradeReason("voluntary");
                                        setShowUpgradePrompt(true);
                                    }}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full hover:opacity-80 transition-opacity ${
                                        FREE_CHAT_LIMIT - monthlyChatCount === 0
                                            ? "bg-red-100"
                                            : FREE_CHAT_LIMIT - monthlyChatCount === 1
                                                ? "bg-amber-100"
                                                : "bg-blue-100"
                                    }`}
                                >
                                    <MessageCircle className={`w-3 h-3 ${
                                        FREE_CHAT_LIMIT - monthlyChatCount === 0
                                            ? "text-red-500"
                                            : FREE_CHAT_LIMIT - monthlyChatCount === 1
                                                ? "text-amber-500"
                                                : "text-blue-500"
                                    }`} />
                                    <span className={`text-xs font-medium whitespace-nowrap ${
                                        FREE_CHAT_LIMIT - monthlyChatCount === 0
                                            ? "text-red-700"
                                            : FREE_CHAT_LIMIT - monthlyChatCount === 1
                                                ? "text-amber-700"
                                                : "text-blue-700"
                                    }`}>
                                        {FREE_CHAT_LIMIT - monthlyChatCount}/{FREE_CHAT_LIMIT} free
                                    </span>
                                </button>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 mb-4">
                            Swap ingredients, make it dairy-free, lower sodium, change servings, or create a variant.
                        </p>

                        {threadMessages.length > 0 && (
                            <div ref={chatMessagesRef} className="max-h-60 overflow-y-auto mb-4 space-y-2 p-3 bg-gray-50 rounded-xl">
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
                            <div className="flex items-center gap-2">
                                <h3 className="font-medium text-gray-900">
                                    Ingredients ({selectedIngredients.size} of {displayIngredients.length} selected)
                                </h3>
                                {enrichingKroger && (
                                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                        <div className="w-3 h-3 border-2 border-gray-300 border-t-[#4A90E2] rounded-full animate-spin" />
                                        <span>Loading prices...</span>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={toggleAllIngredients}
                                className="text-sm text-[#4A90E2] hover:underline"
                            >
                                {selectedIngredients.size === displayIngredients.length ? "Deselect all" : "Select all"}
                            </button>
                        </div>
                        {krogerConnected && (
                            <p className="text-xs text-gray-500 mb-4">Tap an ingredient to view details or swap it</p>
                        )}
                        <ul className="space-y-3">
                            {displayIngredients.map((ing, idx) => (
                                <li
                                    key={idx}
                                    className={`flex items-center gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0 transition-opacity ${
                                        !selectedIngredients.has(idx) ? "opacity-50" : ""
                                    }`}
                                >
                                    {/* Clickable area for opening modal - only when Kroger is connected */}
                                    <div
                                        onClick={() => {
                                            if (!krogerConnected) return;
                                            // Clear previous swap state when selecting a new ingredient
                                            setSwapAlternatives(null);
                                            setShowSwapOptions(false);
                                            setSelectedIngredientIndex(idx);
                                        }}
                                        className={`flex items-center gap-3 flex-1 min-w-0 ${krogerConnected ? "cursor-pointer" : ""}`}
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
                                        ) : (
                                            <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center">
                                                {(() => {
                                                    const category = getIngredientCategory(ing.name);
                                                    switch (category) {
                                                        case 'protein':
                                                            return <Ham className="w-6 h-6 text-red-400" />;
                                                        case 'eggs':
                                                            return <Egg className="w-6 h-6 text-amber-400" />;
                                                        case 'dairy':
                                                            return <Milk className="w-6 h-6 text-blue-400" />;
                                                        case 'produce':
                                                            return <Leaf className="w-6 h-6 text-green-500" />;
                                                        case 'carb':
                                                            return <Wheat className="w-6 h-6 text-amber-500" />;
                                                        case 'fats_oils':
                                                            return <Droplet className="w-6 h-6 text-yellow-500" />;
                                                        case 'snacks':
                                                            return <Cookie className="w-6 h-6 text-orange-400" />;
                                                        case 'beans':
                                                            return <Bean className="w-6 h-6 text-amber-600" />;
                                                        case 'pantry':
                                                            return <FlaskConical className="w-6 h-6 text-stone-500" />;
                                                        case 'fruits':
                                                            return <Apple className="w-6 h-6 text-red-500" />;
                                                        default:
                                                            return <Package className="w-6 h-6 text-gray-400" />;
                                                    }
                                                })()}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div>
                                                <span className={`font-medium ${selectedIngredients.has(idx) ? "text-gray-900" : "text-gray-500 line-through"}`}>{ing.name}</span>
                                                {krogerConnected && ing.stockLevel && ing.stockLevel !== "HIGH" && (
                                                    <span className={`inline-block ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap align-middle ${
                                                        ing.stockLevel === "LOW"
                                                            ? "bg-amber-100 text-amber-700"
                                                            : "bg-red-100 text-red-700"
                                                    }`}>
                                                        {ing.stockLevel === "LOW" ? "Low Stock" : "Out of Stock"}
                                                    </span>
                                                )}
                                            </div>
                                            {krogerConnected && (
                                                <div className="text-sm text-gray-500">
                                                    {ing.productSize || ing.quantity}
                                                    {ing.productAisle && ` • ${ing.productAisle}`}
                                                    {typeof ing.price === "number" && (
                                                        <span className="text-[#4A90E2]"> • ${ing.price.toFixed(2)}{ing.soldBy === "WEIGHT" ? "/lb" : ""}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {/* Checkbox for selection */}
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleIngredient(idx);
                                        }}
                                        className="flex-shrink-0 cursor-pointer p-1"
                                    >
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

                    {/* Recipe Quantities */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <PencilRuler className="w-5 h-5 text-gray-400" />
                            <h3 className="font-medium text-gray-900">Recipe Quantities</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {meal.ingredients.map((ing, idx) => (
                                <div key={idx} className="text-sm text-gray-600">
                                    <span className="font-medium text-gray-900">{ing.quantity}</span>
                                    <span className="ml-1">{ing.name}</span>
                                </div>
                            ))}
                        </div>
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

                        {/* Kroger Cart Button - only show if connected, store is set, and not in pantry mode */}
                        {krogerConnected && krogerStoreSet && !mealsMeta?.pantryMode && (
                            <button
                                onClick={handleAddToKrogerCart}
                                disabled={addingToKrogerCart || selectedIngredients.size === 0}
                                className="w-full py-4 bg-gradient-to-r from-[#1952B3] to-[#0E3D8C] text-white rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {addingToKrogerCart ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Adding to Kroger...</span>
                                    </>
                                ) : (
                                    <>
                                        <ExternalLink className="w-5 h-5" />
                                        <span>Add to Kroger Cart</span>
                                    </>
                                )}
                            </button>
                        )}

                        <button
                            onClick={handleSaveMeal}
                            disabled={savingMeal || isMealAlreadySaved}
                            className={`w-full py-4 rounded-2xl transition-colors active:scale-[0.98] disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                                isMealAlreadySaved
                                    ? "bg-emerald-50 border-2 border-emerald-200 text-emerald-600"
                                    : "bg-white border-2 border-[#4A90E2] text-[#4A90E2] hover:bg-[#4A90E2]/5 disabled:opacity-70"
                            }`}
                        >
                            {savingMeal ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-[#4A90E2]/30 border-t-[#4A90E2] rounded-full animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : isMealAlreadySaved ? (
                                <>
                                    <CheckCircle className="w-5 h-5" />
                                    <span>Meal saved</span>
                                </>
                            ) : (
                                <>
                                    <Bookmark className="w-5 h-5" />
                                    <span>Save meal for later</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Upgrade Prompt Modal */}
            {showUpgradePrompt && (
                <UpgradePrompt
                    feature="meal_chat"
                    onClose={() => setShowUpgradePrompt(false)}
                    reason={upgradeReason}
                />
            )}

            {/* Kroger Results Modal */}
            {showKrogerResults && krogerResults && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
                    <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <h3 className="font-medium text-gray-900">Kroger Cart Results</h3>
                            <button
                                onClick={() => setShowKrogerResults(false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {krogerResults.map((item, idx) => (
                                <div
                                    key={idx}
                                    className={`flex items-center gap-3 p-3 rounded-xl ${
                                        item.found ? "bg-emerald-50" : "bg-amber-50"
                                    }`}
                                >
                                    {item.product?.imageUrl ? (
                                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-white flex-shrink-0">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={item.product.imageUrl}
                                                alt={item.product.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                                            <ShoppingCart className="w-5 h-5 text-gray-400" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-gray-900 text-sm truncate">
                                            {item.product?.name || item.originalName}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {item.quantity}
                                            {item.product?.price && (
                                                <span className="text-[#4A90E2]"> • ${item.product.price.toFixed(2)}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0">
                                        {item.found ? (
                                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                                        ) : (
                                            <AlertCircle className="w-5 h-5 text-amber-500" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 border-t border-gray-100">
                            <button
                                onClick={() => setShowKrogerResults(false)}
                                className="w-full py-3 bg-[#4A90E2] text-white rounded-xl font-medium"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Ingredient Detail Modal */}
            {selectedIngredientIndex !== null && displayIngredients[selectedIngredientIndex] && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
                    <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <h3 className="font-medium text-gray-900">Ingredient Details</h3>
                            <button
                                onClick={() => setSelectedIngredientIndex(null)}
                                disabled={swappingIngredient}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {(() => {
                                const ing = displayIngredients[selectedIngredientIndex];
                                return (
                                    <div className="space-y-4">
                                        {/* Product Image */}
                                        {krogerConnected && ing.productImageUrl ? (
                                            <div className="w-full aspect-square max-w-[200px] mx-auto rounded-xl overflow-hidden bg-gray-100">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={ing.productImageUrl}
                                                    alt={ing.productName || ing.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-full aspect-square max-w-[200px] mx-auto rounded-xl bg-gray-100 flex items-center justify-center">
                                                {(() => {
                                                    const category = getIngredientCategory(ing.name);
                                                    switch (category) {
                                                        case 'protein':
                                                            return <Ham className="w-16 h-16 text-red-400" />;
                                                        case 'eggs':
                                                            return <Egg className="w-16 h-16 text-amber-400" />;
                                                        case 'dairy':
                                                            return <Milk className="w-16 h-16 text-blue-400" />;
                                                        case 'produce':
                                                            return <Leaf className="w-16 h-16 text-green-500" />;
                                                        case 'carb':
                                                            return <Wheat className="w-16 h-16 text-amber-500" />;
                                                        case 'fats_oils':
                                                            return <Droplet className="w-16 h-16 text-yellow-500" />;
                                                        case 'snacks':
                                                            return <Cookie className="w-16 h-16 text-orange-400" />;
                                                        case 'beans':
                                                            return <Bean className="w-16 h-16 text-amber-600" />;
                                                        case 'pantry':
                                                            return <FlaskConical className="w-16 h-16 text-stone-500" />;
                                                        case 'fruits':
                                                            return <Apple className="w-16 h-16 text-red-500" />;
                                                        default:
                                                            return <Package className="w-16 h-16 text-gray-400" />;
                                                    }
                                                })()}
                                            </div>
                                        )}

                                        {/* Ingredient Name */}
                                        <div className="text-center">
                                            <h4 className="text-lg font-medium text-gray-900">{ing.name}</h4>
                                            {krogerConnected && ing.productName && ing.productName !== ing.name && (
                                                <p className="text-sm text-gray-500 mt-1">{ing.productName}</p>
                                            )}
                                        </div>

                                        {/* Details Grid */}
                                        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                                            {krogerConnected && (
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-500">
                                                        {ing.productSize ? "Size" : "Quantity"}
                                                    </span>
                                                    <span className="text-sm font-medium text-gray-900">
                                                        {ing.productSize || ing.quantity}
                                                    </span>
                                                </div>
                                            )}
                                            {ing.category && (
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-500">Category</span>
                                                    <span className="text-sm font-medium text-gray-900">{ing.category}</span>
                                                </div>
                                            )}
                                            {krogerConnected && ing.productAisle && (
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-500">Aisle</span>
                                                    <span className="text-sm font-medium text-gray-900">{ing.productAisle}</span>
                                                </div>
                                            )}
                                            {krogerConnected && typeof ing.price === "number" && (
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-500">Price</span>
                                                    <span className="text-sm font-medium text-[#4A90E2]">
                                                        ${ing.price.toFixed(2)}{ing.soldBy === "WEIGHT" ? "/lb" : ""}
                                                    </span>
                                                </div>
                                            )}
                                            {krogerConnected && ing.stockLevel && (
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-500">Stock</span>
                                                    <span className={`text-sm font-medium ${
                                                        ing.stockLevel === "HIGH"
                                                            ? "text-emerald-600"
                                                            : ing.stockLevel === "LOW"
                                                                ? "text-amber-600"
                                                                : "text-red-600"
                                                    }`}>
                                                        {ing.stockLevel === "HIGH"
                                                            ? "In Stock"
                                                            : ing.stockLevel === "LOW"
                                                                ? "Low Stock"
                                                                : "Out of Stock"}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Selection Toggle */}
                                        <div
                                            onClick={() => toggleIngredient(selectedIngredientIndex)}
                                            className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer"
                                        >
                                            <span className="text-sm text-gray-700">Include in shopping list</span>
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                                selectedIngredients.has(selectedIngredientIndex)
                                                    ? "bg-[#4A90E2] border-[#4A90E2]"
                                                    : "border-gray-300 bg-white"
                                            }`}>
                                                {selectedIngredients.has(selectedIngredientIndex) && (
                                                    <CheckCircle className="w-4 h-4 text-white" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Modal Footer with Swap Button */}
                        <div className="p-4 border-t border-gray-100 space-y-3">
                            {showSwapOptions && swapAlternatives ? (
                                <>
                                    <p className="text-sm text-gray-600 font-medium mb-2">Choose a different product:</p>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {swapAlternatives.map((product) => (
                                            <button
                                                key={product.krogerProductId}
                                                onClick={() => handleSelectSwap(product)}
                                                disabled={swappingIngredient}
                                                className="w-full p-3 bg-gray-50 hover:bg-[#4A90E2]/10 border border-gray-200 hover:border-[#4A90E2] rounded-xl text-left transition-colors disabled:opacity-50 flex items-center gap-3"
                                            >
                                                {product.imageUrl ? (
                                                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-white flex-shrink-0">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={product.imageUrl}
                                                            alt={product.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="w-14 h-14 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                                                        <ShoppingCart className="w-6 h-6 text-gray-400" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-gray-900 text-sm line-clamp-2">{product.name}</div>
                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                        {product.size && <span>{product.size}</span>}
                                                        {product.aisle && <span> • {product.aisle}</span>}
                                                    </div>
                                                    {typeof product.price === "number" && (
                                                        <div className="text-sm font-medium text-[#4A90E2] mt-0.5">
                                                            ${product.price.toFixed(2)}
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowSwapOptions(false);
                                            setSwapAlternatives(null);
                                        }}
                                        className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <>
                                    {krogerConnected && krogerStoreSet ? (
                                        <button
                                            onClick={handleShowSwapOptions}
                                            disabled={loadingSwapSuggestions}
                                            className="w-full py-3 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-70"
                                        >
                                            {loadingSwapSuggestions ? (
                                                <>
                                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    <span>Finding products...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <RefreshCw className="w-5 h-5" />
                                                    <span>Swap Product</span>
                                                </>
                                            )}
                                        </button>
                                    ) : (
                                        <p className="text-sm text-gray-500 text-center py-2">
                                            Connect Kroger to swap products
                                        </p>
                                    )}
                                    <button
                                        onClick={() => {
                                            setSelectedIngredientIndex(null);
                                            setShowSwapOptions(false);
                                            setSwapAlternatives(null);
                                        }}
                                        disabled={loadingSwapSuggestions}
                                        className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium disabled:opacity-50"
                                    >
                                        Close
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function MealDetailPage() {
    return (
        <Suspense fallback={<LoadingScreen message="Loading meal details..." />}>
            <MealDetailPageContent />
        </Suspense>
    );
}
