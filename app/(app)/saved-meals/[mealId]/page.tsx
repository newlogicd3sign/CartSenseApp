"use client";

import Image from "next/image";
import InstacartCarrot from "@/app/🥕 Instacart Logos/Logos - Carrot/RGB/PNG/Instacart_Carrot.png";
import { Browser } from "@capacitor/browser";
import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";

// Check if running in Capacitor
const isCapacitor = () => {
    if (typeof window === "undefined") return false;
    return (window as any).Capacitor?.isNativePlatform?.() ?? false;
};
import { MealImage } from "@/components/MealImage";
import { auth, db } from "@/lib/firebaseClient";
import { authFetch } from "@/lib/authFetch";
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
    query,
    where,
} from "firebase/firestore";
import {
    isStapleItem,
    isSameIngredient,
    isExcludedIngredient,
    getRandomAccentColor,
} from "@/lib/utils";
import { getIngredientCategory } from "@/lib/product-engine/ingredientQualityRules";
import { getIngredientImageUrl } from "@/lib/ingredientImages";
import { getEstimatedPrice } from "@/lib/priceEstimates";
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
    MessageCircle,
    Send,
    Sparkles,
    Lock,
    X,
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
    ExternalLink,
    Minus,
    Plus,
    Share2,
    Info,
    ChevronDown,
    ChevronUp,
    AlertTriangle,
} from "lucide-react";
import { logUserEvent } from "@/lib/logUserEvent";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useToast } from "@/components/Toast";
import { ShareModal } from "@/components/ShareModal"; // Added
import { DietaryConflictModal } from "@/components/DietaryConflictModal";
import { checkPromptForConflicts, getCompliantDiets, type ConflictResult, type FamilyMemberRestrictions } from "@/lib/sensitivityMapping";

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
    cookTimeRange?: {
        min: number;
        max: number;
    };
    estimatedCost?: number;
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
    dietRestrictions?: {
        hasActiveNote?: boolean;
        blockedIngredients?: string[];
        blockedGroups?: string[];
    };
    dislikedFoods?: string[];
    isPremium?: boolean;
    shoppingPreference?: "kroger" | "instacart";
};

type ThreadMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: string;
};

type MealThreadReply = {
    reply: string;
    action: "no_change" | "update_meal" | "new_meal_variant";
    updatedMeal?: SavedMeal;
};

export default function SavedMealDetailPage() {
    const router = useRouter();
    const params = useParams();
    const mealId = params.mealId as string;
    const { showToast } = useToast();

    const [user, setUser] = useState<User | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [meal, setMeal] = useState<SavedMeal | null>(null);
    const [loadingMeal, setLoadingMeal] = useState(true);
    const [adjustedServings, setAdjustedServings] = useState<number | null>(null);

    const [addingToList, setAddingToList] = useState(false);
    const [addingToInstacart, setAddingToInstacart] = useState(false);
    const [selectedIngredients, setSelectedIngredients] = useState<Set<number>>(new Set());
    const [failedIngredientImages, setFailedIngredientImages] = useState<Set<number>>(new Set());
    const [krogerConnected, setKrogerConnected] = useState(false);
    const [krogerStoreSet, setKrogerStoreSet] = useState(false);
    const [prefs, setPrefs] = useState<UserPrefs | null>(null);
    const [showShareModal, setShowShareModal] = useState(false);

    // Lazy loading Kroger enrichment state
    const [enrichingKroger, setEnrichingKroger] = useState(false);
    const [hasEnrichedKroger, setHasEnrichedKroger] = useState(false);

    // Meal chat state
    const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
    const [threadInput, setThreadInput] = useState("");
    const [sendingThread, setSendingThread] = useState(false);
    const [threadError, setThreadError] = useState<string | null>(null);
    const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

    // Dietary conflict checking state
    const [familyMemberRestrictions, setFamilyMemberRestrictions] = useState<FamilyMemberRestrictions[]>([]);
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [detectedConflicts, setDetectedConflicts] = useState<ConflictResult["conflicts"]>([]);
    const [pendingThreadMessage, setPendingThreadMessage] = useState<string>("");

    // Ingredient modal state for swap functionality
    const [selectedIngredientIndex, setSelectedIngredientIndex] = useState<number | null>(null);
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
    const [swappingIngredient, setSwappingIngredient] = useState(false);
    const [expandedNutritionId, setExpandedNutritionId] = useState<string | null>(null);
    const [nutritionData, setNutritionData] = useState<Record<string, {
        loading: boolean;
        data: {
            calories: number | null;
            protein: number | null;
            totalCarbohydrates: number | null;
            totalFat: number | null;
            sodium: number | null;
            sugars: number | null;
            servingSize: string | null;
        } | null;
    }>>({});
    const [currentProductNutrition, setCurrentProductNutrition] = useState<{
        loading: boolean;
        productId: string | null;
        data: {
            calories: number | null;
            protein: number | null;
            totalCarbohydrates: number | null;
            totalFat: number | null;
            sodium: number | null;
            sugars: number | null;
            servingSize: string | null;
        } | null;
    }>({ loading: false, productId: null, data: null });

    // Random color for back button
    const backButtonColor = useMemo(() => getRandomAccentColor(), []);

    // Calculate compliant diets based on ingredients
    const compliantDiets = useMemo(() => {
        if (!meal) return [];
        return getCompliantDiets(meal.ingredients);
    }, [meal]);

    // Serving adjustment calculations
    const currentServings = adjustedServings ?? meal?.servings ?? 1;
    const servingMultiplier = meal ? currentServings / meal.servings : 1;

    // Scale ingredient quantity strings (e.g., "2 cups" -> "4 cups")
    const scaleQuantity = (quantity: string, multiplier: number): string => {
        if (multiplier === 1) return quantity;

        // Match numbers (including fractions like 1/2, decimals like 1.5)
        const match = quantity.match(/^([\d./]+)\s*(.*)$/);
        if (!match) return quantity;

        const [, numPart, rest] = match;
        let value: number;

        // Handle fractions like "1/2"
        if (numPart.includes('/')) {
            const [num, denom] = numPart.split('/').map(Number);
            value = num / denom;
        } else {
            value = parseFloat(numPart);
        }

        if (isNaN(value)) return quantity;

        const scaled = value * multiplier;

        // Format nicely - use fractions for common values, otherwise round to 2 decimals
        const formatNumber = (n: number): string => {
            // Round to avoid floating point issues
            const rounded = Math.round(n * 100) / 100;

            // Check for common fractions
            const fractions: Record<string, string> = {
                '0.25': '1/4', '0.33': '1/3', '0.5': '1/2',
                '0.67': '2/3', '0.75': '3/4'
            };

            const whole = Math.floor(rounded);
            const frac = rounded - whole;
            const fracKey = frac.toFixed(2);

            if (frac === 0) return whole.toString();
            if (whole === 0 && fractions[fracKey]) return fractions[fracKey];
            if (whole > 0 && fractions[fracKey]) return `${whole} ${fractions[fracKey]}`;

            // Otherwise show decimal, trimmed
            return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1).replace(/\.0$/, '');
        };

        return `${formatNumber(scaled)} ${rest}`.trim();
    };

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                router.push("/login");
                return;
            }

            setUser(firebaseUser);

            // Fetch user prefs to check Kroger connection and premium status
            try {
                const userRef = doc(db, "users", firebaseUser.uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    const data = userSnap.data() as UserPrefs;
                    setPrefs(data);
                    setKrogerConnected(Boolean(data.krogerLinked));
                    setKrogerStoreSet(Boolean(data.defaultKrogerLocationId));

                    // Load family member restrictions for conflict checking
                    try {
                        const membersQuery = query(
                            collection(db, "users", firebaseUser.uid, "familyMembers"),
                            where("isActive", "==", true)
                        );
                        const membersSnap = await getDocs(membersQuery);
                        const memberRestrictions: FamilyMemberRestrictions[] = [];

                        membersSnap.forEach((docSnap) => {
                            const memberData = docSnap.data();
                            if (memberData.name) {
                                memberRestrictions.push({
                                    name: memberData.name,
                                    allergies: memberData.allergiesAndSensitivities?.allergies || [],
                                    sensitivities: memberData.allergiesAndSensitivities?.sensitivities || [],
                                    dietType: memberData.dietType,
                                    blockedIngredients: memberData.dietRestrictions?.blockedIngredients || [],
                                    blockedGroups: memberData.dietRestrictions?.blockedGroups || [],
                                    dislikes: memberData.dislikedFoods || []
                                });
                            }
                        });
                        setFamilyMemberRestrictions(memberRestrictions);
                    } catch (err) {
                        console.error("Error loading family members", err);
                    }
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

    // Lazy load Kroger enrichment when viewing saved meal (only if Kroger is connected)
    useEffect(() => {
        if (!user || !meal || !krogerConnected || !krogerStoreSet || hasEnrichedKroger) return;

        // Check if any ingredient already has Kroger data (already enriched)
        const alreadyEnriched = meal.ingredients.some(ing => ing.krogerProductId);
        if (alreadyEnriched) {
            setHasEnrichedKroger(true);
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
                    // Update the meal with enriched ingredients
                    const updatedMeal = {
                        ...meal,
                        ingredients: data.ingredients,
                    };
                    setMeal(updatedMeal);

                    // Optionally persist the enriched data to Firestore
                    try {
                        const mealRef = doc(db, "savedMeals", user.uid, "meals", meal.id);
                        await setDoc(mealRef, {
                            ...updatedMeal,
                            savedAt: meal.savedAt || serverTimestamp(),
                        });
                    } catch (persistErr) {
                        console.error("Error persisting enriched meal:", persistErr);
                    }
                }
            } catch (err) {
                console.error("Error enriching ingredients with Kroger data:", err);
            } finally {
                setEnrichingKroger(false);
                setHasEnrichedKroger(true);
            }
        };

        enrichIngredients();
    }, [user, meal, krogerConnected, krogerStoreSet, hasEnrichedKroger]);

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
            showToast("Please select at least one ingredient to add.", "error");
            return;
        }

        try {
            setAddingToList(true);

            const itemsCol = collection(db, "shoppingLists", user.uid, "items");
            const ingredientsToAdd = meal.ingredients.filter((_, idx) => selectedIngredients.has(idx));

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
                const writes = itemsToAdd.map((ing) =>
                    addDoc(itemsCol, {
                        name: ing.name,
                        quantity: scaleQuantity(ing.quantity, servingMultiplier),
                        count: 1,
                        mealId: meal.id,
                        mealName: meal.name,
                        mealImageUrl: meal.imageUrl ?? null,
                        checked: false,
                        createdAt: serverTimestamp(),
                        krogerProductId: ing.krogerProductId ?? null,
                        productName: ing.productName ?? null,
                        productImageUrl: ing.productImageUrl ?? null,
                        productSize: ing.productSize ?? null,
                        productAisle: ing.productAisle ?? null,
                        price: typeof ing.price === "number" ? ing.price : null,
                        soldBy: ing.soldBy ?? null,
                        stockLevel: ing.stockLevel ?? null,
                    })
                );

                await Promise.all(writes);
            }

            // Build appropriate message
            const addedCount = itemsToAdd.length;
            const updatedCount = itemsToUpdate.length;

            if (addedCount > 0 && updatedCount > 0) {
                showToast(`Added ${addedCount} item${addedCount !== 1 ? "s" : ""}, updated ${updatedCount} item${updatedCount !== 1 ? "s" : ""}.`, "success");
                hapticSuccess();
            } else if (addedCount > 0 && skippedStaples > 0) {
                showToast(`Added ${addedCount} item${addedCount !== 1 ? "s" : ""}, skipped ${skippedStaples} already in list.`, "success");
                hapticSuccess();
            } else if (addedCount > 0) {
                showToast(`Added ${addedCount} item${addedCount !== 1 ? "s" : ""} to your shopping list.`, "success");
                hapticSuccess();
            } else if (updatedCount > 0) {
                showToast(`Updated quantities for ${updatedCount} item${updatedCount !== 1 ? "s" : ""}.`, "success");
                hapticSuccess();
            } else if (skippedStaples > 0) {
                showToast(`All items already in your shopping list.`, "info");
            }
        } catch (err) {
            console.error("Error adding to shopping list", err);
            showToast("Something went wrong adding items to your list.", "error");
            hapticError();
        } finally {
            setAddingToList(false);
        }
    };

    const handleAddToInstacart = async () => {
        if (!user || !meal) return;
        if (selectedIngredients.size === 0) {
            showToast("Please select at least one ingredient to add.", "error");
            return;
        }

        setAddingToInstacart(true);

        try {
            const ingredientsToAdd = meal.ingredients.filter((_, idx) => selectedIngredients.has(idx));
            const cartItems = ingredientsToAdd.map((ing, idx) => ({
                id: `${meal.id}-${idx}`,
                name: ing.name,
                quantity: scaleQuantity(ing.quantity, servingMultiplier),
                count: 1,
            }));

            const res = await fetch("/api/instacart/link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: cartItems,
                    title: meal.name,
                    imageUrl: meal.imageUrl,
                    instructions: meal.steps, // Include recipe cooking instructions
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                showToast(data.error || "Failed to generate Instacart link.", "error");
                hapticError();
                return;
            }

            // Open Instacart in a new tab
            if (data.url) {
                if (isCapacitor()) {
                    await Browser.open({ url: data.url });
                } else {
                    window.open(data.url, "_blank");
                }
                showToast("Opening Instacart...", "success");
                hapticSuccess();

                logUserEvent(user.uid, {
                    type: "added_to_instacart",
                    mealId: meal.id,
                }).catch((err) => {
                    console.error("Failed to log added_to_instacart event:", err);
                });
            }
        } catch (err) {
            console.error("Error adding to Instacart:", err);
            showToast("Something went wrong. Please try again.", "error");
            hapticError();
        } finally {
            setAddingToInstacart(false);
        }
    };

    const formatSavedAt = (ts: any) => {
        const d = ts?.toDate?.() || new Date();
        const date = d.toLocaleDateString([], { month: "long", day: "numeric" });
        const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        return `${date} at ${time}`;
    };

    // Actually send the thread message (called after conflict check passes or user proceeds)
    const sendThreadMessage = async (messageText: string) => {
        if (!meal || !user) return;

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

        try {
            const historyForApi = threadMessages.slice(-10).map((msg) => ({
                role: msg.role,
                content: msg.content,
            }));

            const res = await fetch("/api/meal-thread", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    meal,
                    prefs: prefs || undefined,
                    message: messageText,
                    history: historyForApi,
                    originalPrompt: meal.prompt || undefined,
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

            // Stream text animation
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

            // Update meal if changes were made
            if (
                data.action !== "no_change" &&
                data.updatedMeal &&
                typeof data.updatedMeal === "object"
            ) {
                const updatedMeal = data.updatedMeal;
                setMeal(updatedMeal);

                // Persist to Firestore
                if (user) {
                    const mealRef = doc(db, "savedMeals", user.uid, "meals", meal.id);
                    await setDoc(mealRef, {
                        ...updatedMeal,
                        prompt: meal.prompt || null,
                        savedAt: meal.savedAt || serverTimestamp(),
                    });
                }

                // Re-select all ingredients after update
                setSelectedIngredients(new Set(updatedMeal.ingredients.map((_, idx) => idx)));
            }
        } catch (err) {
            console.error("Error in /api/meal-thread", err);
            setThreadError("Something went wrong updating this meal.");
        } finally {
            setSendingThread(false);
        }
    };

    // Handle send button click - check for conflicts first
    const handleSendThreadMessage = () => {
        if (!meal || !threadInput.trim()) return;

        // Premium-only feature
        if (!prefs?.isPremium) {
            setShowUpgradePrompt(true);
            return;
        }

        const messageText = threadInput.trim();

        // Check for dietary conflicts
        const conflictResult = checkPromptForConflicts(
            messageText,
            prefs?.allergiesAndSensitivities?.allergies || [],
            prefs?.allergiesAndSensitivities?.sensitivities || [],
            prefs?.dietType,
            prefs?.dietRestrictions?.blockedIngredients || [],
            prefs?.dietRestrictions?.blockedGroups || [],
            prefs?.dislikedFoods || [],
            familyMemberRestrictions
        );

        if (conflictResult.hasConflict) {
            // Store the message and show conflict modal
            setPendingThreadMessage(messageText);
            setDetectedConflicts(conflictResult.conflicts);
            setShowConflictModal(true);
            return;
        }

        // No conflicts, send immediately
        sendThreadMessage(messageText);
    };

    // Handle proceeding despite conflicts
    const handleProceedWithConflicts = () => {
        setShowConflictModal(false);
        if (pendingThreadMessage) {
            sendThreadMessage(pendingThreadMessage);
            setPendingThreadMessage("");
        }
    };

    const handleShowSwapOptions = async () => {
        if (!meal || !user || selectedIngredientIndex === null) return;

        // Check if Kroger is connected
        if (!krogerConnected || !krogerStoreSet) {
            showToast("Connect your Kroger account to swap products.", "error");
            return;
        }

        const ing = meal.ingredients[selectedIngredientIndex];
        if (!ing) return;

        setLoadingSwapSuggestions(true);
        setSwapAlternatives(null);
        setExpandedNutritionId(null);
        setNutritionData({});

        try {
            const res = await authFetch("/api/swap-suggestions", {
                method: "POST",
                body: JSON.stringify({
                    ingredientName: ing.name,
                    currentProductId: ing.krogerProductId,
                    searchTerm: ing.name,
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

    // Fetch nutrition for the currently selected ingredient
    useEffect(() => {
        const fetchCurrentNutrition = async () => {
            if (selectedIngredientIndex === null || !meal) {
                setCurrentProductNutrition({ loading: false, productId: null, data: null });
                return;
            }

            const ing = meal.ingredients[selectedIngredientIndex];
            if (!ing?.krogerProductId) {
                setCurrentProductNutrition({ loading: false, productId: null, data: null });
                return;
            }

            // Already fetched for this product
            if (currentProductNutrition.productId === ing.krogerProductId && currentProductNutrition.data) {
                return;
            }

            setCurrentProductNutrition({ loading: true, productId: ing.krogerProductId, data: null });

            try {
                const locationId = prefs?.defaultKrogerLocationId;
                const url = locationId
                    ? `/api/kroger/product/${ing.krogerProductId}?locationId=${locationId}`
                    : `/api/kroger/product/${ing.krogerProductId}`;

                const res = await authFetch(url);
                const data = await res.json();

                if (res.ok && data.nutrition) {
                    setCurrentProductNutrition({
                        loading: false,
                        productId: ing.krogerProductId,
                        data: {
                            calories: data.nutrition.calories,
                            protein: data.nutrition.protein,
                            totalCarbohydrates: data.nutrition.totalCarbohydrates,
                            totalFat: data.nutrition.totalFat,
                            sodium: data.nutrition.sodium,
                            sugars: data.nutrition.sugars,
                            servingSize: data.nutrition.servingSize,
                        }
                    });
                } else {
                    setCurrentProductNutrition({ loading: false, productId: ing.krogerProductId, data: null });
                }
            } catch (err) {
                console.error("Error fetching current product nutrition:", err);
                setCurrentProductNutrition({ loading: false, productId: ing.krogerProductId, data: null });
            }
        };

        fetchCurrentNutrition();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedIngredientIndex, meal]);

    const fetchProductNutrition = async (productId: string) => {
        // Toggle off if already expanded
        if (expandedNutritionId === productId) {
            setExpandedNutritionId(null);
            return;
        }

        setExpandedNutritionId(productId);

        // Already fetched
        if (nutritionData[productId]?.data) {
            return;
        }

        // Set loading
        setNutritionData(prev => ({
            ...prev,
            [productId]: { loading: true, data: null }
        }));

        try {
            const locationId = prefs?.defaultKrogerLocationId;
            const url = locationId
                ? `/api/kroger/product/${productId}?locationId=${locationId}`
                : `/api/kroger/product/${productId}`;

            const res = await authFetch(url);
            const data = await res.json();

            if (res.ok && data.nutrition) {
                setNutritionData(prev => ({
                    ...prev,
                    [productId]: {
                        loading: false,
                        data: {
                            calories: data.nutrition.calories,
                            protein: data.nutrition.protein,
                            totalCarbohydrates: data.nutrition.totalCarbohydrates,
                            totalFat: data.nutrition.totalFat,
                            sodium: data.nutrition.sodium,
                            sugars: data.nutrition.sugars,
                            servingSize: data.nutrition.servingSize,
                        }
                    }
                }));
            } else {
                setNutritionData(prev => ({
                    ...prev,
                    [productId]: { loading: false, data: null }
                }));
            }
        } catch (err) {
            console.error("Error fetching nutrition:", err);
            setNutritionData(prev => ({
                ...prev,
                [productId]: { loading: false, data: null }
            }));
        }
    };

    const handleSelectSwap = async (product: {
        krogerProductId: string;
        name: string;
        imageUrl?: string;
        price?: number;
        size?: string;
        aisle?: string;
    }) => {
        if (!meal || !user || selectedIngredientIndex === null) return;

        setSwappingIngredient(true);

        // Create updated ingredients array with the swap
        const updatedIngredients = [...meal.ingredients];
        const oldIngredient = updatedIngredients[selectedIngredientIndex];

        // Keep the original ingredient name but update the Kroger product
        updatedIngredients[selectedIngredientIndex] = {
            ...oldIngredient,
            // Update Kroger product data
            krogerProductId: product.krogerProductId,
            productName: product.name,
            productImageUrl: product.imageUrl,
            productSize: product.size,
            productAisle: product.aisle,
            price: product.price,
        };

        const updatedMeal: SavedMeal = {
            ...meal,
            ingredients: updatedIngredients,
        };

        setMeal(updatedMeal);

        // Persist to Firestore
        try {
            const mealRef = doc(db, "savedMeals", user.uid, "meals", meal.id);
            await setDoc(mealRef, {
                ...updatedMeal,
                savedAt: meal.savedAt || serverTimestamp(),
            });
        } catch (err) {
            console.error("Error persisting swapped meal:", err);
        }

        showToast(`Swapped to ${product.name}!`, "success");

        // Log the swap event
        logUserEvent(user.uid, {
            type: "ingredient_swapped",
            mealId: meal.id,
            oldIngredient: oldIngredient.productName || oldIngredient.name,
            newIngredient: product.name,
        }).catch((err) => {
            console.error("Failed to log ingredient_swapped event:", err);
        });

        // Close modals
        setShowSwapOptions(false);
        setSwapAlternatives(null);
        setExpandedNutritionId(null);
        setNutritionData({});
        setSelectedIngredientIndex(null);
        setSwappingIngredient(false);
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
            <div className="bg-white border-b border-gray-100 px-6 pt-safe-4 pb-4 sticky sticky-safe z-20">
                <div className="max-w-3xl mx-auto">
                    <button
                        onClick={() => router.push("/saved-meals")}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:opacity-80"
                        style={{
                            backgroundColor: `${backButtonColor.primary}15`,
                            color: backButtonColor.dark,
                        }}
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-medium">Back to saved meals</span>
                    </button>
                </div>
            </div>

            {/* Hero Section - Image Left, Content Right */}
            <div className="px-6 py-6">
                <div className="max-w-3xl mx-auto">
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-4">
                        {/* Thumbnail - Left */}
                        <div className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 rounded-xl overflow-hidden">
                            <MealImage
                                src={meal.imageUrl}
                                alt={meal.name}
                                className="w-full h-full"
                                isPremium={Boolean(prefs?.isPremium)}
                            />
                        </div>

                        {/* Content - Right */}
                        <div className="flex-1 flex flex-col min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="inline-block px-2 py-0.5 bg-gray-100 rounded-md text-xs font-medium text-gray-600 capitalize">
                                    {meal.mealType}
                                </span>
                                <div className="w-5 h-5 bg-[#4A90E2] rounded-full flex items-center justify-center">
                                    <Bookmark className="w-2.5 h-2.5 text-white fill-white" />
                                </div>
                                {meal.cookTimeRange && (
                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-sky-50 border border-sky-200 rounded-full">
                                        <Clock className="w-3 h-3 text-sky-600" />
                                        <span className="text-[10px] font-medium text-sky-700">{meal.cookTimeRange.min}-{meal.cookTimeRange.max}m</span>
                                    </div>
                                )}
                                {compliantDiets.map(diet => (
                                    <span key={diet} className="inline-block px-2 py-0.5 bg-pink-50 border border-pink-200 rounded-full text-xs font-medium text-pink-700 capitalize">
                                        {diet}
                                    </span>
                                ))}
                            </div>
                            <h1 className="text-lg sm:text-xl font-medium text-gray-900 mb-1">{meal.name}</h1>
                            <p className="text-sm text-gray-500">{meal.description}</p>
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
                        <div className="grid grid-cols-4 gap-4">
                            <div className="text-center">
                                <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <Flame className="w-6 h-6 text-orange-500" />
                                </div>
                                <div className="text-lg font-medium text-gray-900">{Math.round(meal.macros.calories * servingMultiplier)}</div>
                                <div className="text-xs text-gray-500">kcal</div>
                            </div>
                            <div className="text-center">
                                {prefs?.dietType === "vegetarian" || prefs?.dietType === "vegan" ? (
                                    <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-2">
                                        <Bean className="w-6 h-6 text-emerald-500" />
                                    </div>
                                ) : (
                                    <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-2">
                                        <Beef className="w-6 h-6 text-blue-500" />
                                    </div>
                                )}
                                <div className="text-lg font-medium text-gray-900">{Math.round(meal.macros.protein * servingMultiplier)}g</div>
                                <div className="text-xs text-gray-500">Protein</div>
                            </div>
                            <div className="text-center" title={`${Math.round(meal.macros.carbs * servingMultiplier)}g total carbs - ${Math.round((meal.macros.fiber ?? 0) * servingMultiplier)}g fiber`}>
                                <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <Wheat className="w-6 h-6 text-amber-500" />
                                </div>
                                <div className="text-lg font-medium text-gray-900">{Math.max(0, Math.round((meal.macros.carbs - (meal.macros.fiber ?? 0)) * servingMultiplier))}g</div>
                                <div className="text-xs text-gray-500">Net Carbs</div>
                            </div>
                            <div className="text-center">
                                <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <Droplet className="w-6 h-6 text-purple-500" />
                                </div>
                                <div className="text-lg font-medium text-gray-900">{Math.round(meal.macros.fat * servingMultiplier)}g</div>
                                <div className="text-xs text-gray-500">Fat</div>
                            </div>
                        </div>
                    </div>

                    {/* Servings Card */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-gray-400" />
                                <span className="text-sm font-medium text-gray-900">Servings</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setAdjustedServings(Math.max(1, currentServings - 1))}
                                    disabled={currentServings <= 1}
                                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                                >
                                    <Minus className="w-4 h-4 text-gray-600" />
                                </button>
                                <span className="text-lg font-semibold text-gray-900 w-6 text-center">{currentServings}</span>
                                <button
                                    onClick={() => setAdjustedServings(Math.min(20, currentServings + 1))}
                                    disabled={currentServings >= 20}
                                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                                >
                                    <Plus className="w-4 h-4 text-gray-600" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Ask AI Section - Premium Only */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <div className="flex items-center gap-2">
                                <MessageCircle className="w-5 h-5 text-[#4A90E2]" />
                                <h3 className="font-medium text-gray-900">Ask AI</h3>
                            </div>
                            <div className="flex items-center gap-1 px-2 py-1 bg-violet-100 rounded-full">
                                <Sparkles className="w-3 h-3 text-violet-600" />
                                <span className="text-xs font-medium text-violet-700">Premium</span>
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">
                            Swap ingredients, make it dairy-free, lower sodium, change servings, or create a variant.
                        </p>

                        {prefs?.isPremium ? (
                            <>
                                {threadMessages.length > 0 && (
                                    <div className="max-h-60 overflow-y-auto mb-4 space-y-2 p-3 bg-gray-50 rounded-xl">
                                        {threadMessages.map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                            >
                                                <div
                                                    className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${msg.role === "user"
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
                            </>
                        ) : (
                            <button
                                onClick={() => setShowUpgradePrompt(true)}
                                className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                            >
                                <Lock className="w-4 h-4" />
                                <span>Upgrade to edit saved meals</span>
                            </button>
                        )}
                    </div>

                    {/* Ingredients */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <h3 className="font-medium text-gray-900">
                                    Ingredients ({selectedIngredients.size} of {meal.ingredients.length} selected)
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
                                {selectedIngredients.size === meal.ingredients.length ? "Deselect all" : "Select all"}
                            </button>
                        </div>
                        {prefs?.shoppingPreference !== "instacart" && krogerConnected && (
                            <p className="text-xs text-gray-500 mb-4">Tap an ingredient to view details or swap it. Uncheck items you already have in your pantry.</p>
                        )}
                        {prefs?.shoppingPreference === "instacart" && (
                            <p className="text-xs text-gray-500 mb-4 italic">* Estimated prices may vary by store. Uncheck items you already have in your pantry.</p>
                        )}
                        <ul className="space-y-3">
                            {meal.ingredients.map((ing, idx) => (
                                <li
                                    key={idx}
                                    className={`flex items-center gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0 transition-opacity ${!selectedIngredients.has(idx) ? "opacity-50" : ""
                                        }`}
                                >
                                    {/* Clickable area for opening modal - only when Kroger is connected */}
                                    <div
                                        onClick={() => prefs?.shoppingPreference !== "instacart" && krogerConnected && setSelectedIngredientIndex(idx)}
                                        className={`flex items-center gap-3 flex-1 min-w-0 ${prefs?.shoppingPreference !== "instacart" && krogerConnected ? "cursor-pointer" : ""}`}
                                    >
                                        {prefs?.shoppingPreference !== "instacart" && krogerConnected && ing.productImageUrl ? (
                                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={ing.productImageUrl}
                                                    alt={ing.productName || ing.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ) : !failedIngredientImages.has(idx) ? (
                                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={getIngredientImageUrl(ing.name)}
                                                    alt={ing.name}
                                                    className="w-full h-full object-cover"
                                                    onError={() => setFailedIngredientImages(prev => new Set(prev).add(idx))}
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
                                                {prefs?.shoppingPreference !== "instacart" && krogerConnected && ing.stockLevel && ing.stockLevel !== "HIGH" && (
                                                    <span className={`inline-block ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap align-middle ${ing.stockLevel === "LOW"
                                                        ? "bg-amber-100 text-amber-700"
                                                        : "bg-red-100 text-red-700"
                                                        }`}>
                                                        {ing.stockLevel === "LOW" ? "Low Stock" : "Out of Stock"}
                                                    </span>
                                                )}
                                            </div>
                                            {/* Kroger users see full product details */}
                                            {prefs?.shoppingPreference !== "instacart" && krogerConnected && (
                                                <div className="text-sm text-gray-500">
                                                    {ing.productSize || scaleQuantity(ing.quantity, servingMultiplier)}
                                                    {ing.productAisle && ` • ${ing.productAisle}`}
                                                    {typeof ing.price === "number" && (
                                                        <span className="text-[#4A90E2]"> • ${ing.price.toFixed(2)}{ing.soldBy === "WEIGHT" ? "/lb" : ""}</span>
                                                    )}
                                                </div>
                                            )}
                                            {/* Estimated price range for Instacart users or Kroger users without linked account/store */}
                                            {(!krogerConnected || !krogerStoreSet || prefs?.shoppingPreference === "instacart") && (() => {
                                                const hasKrogerPrice = typeof ing.price === "number";
                                                const estimate = hasKrogerPrice
                                                    ? { min: ing.price!, max: ing.price! * 1.15, soldByWeight: ing.soldBy === "WEIGHT" }
                                                    : getEstimatedPrice(ing.name);
                                                const suffix = estimate.soldByWeight ? "/lb" : "";
                                                return (
                                                    <div className="text-sm text-gray-500">
                                                        Est. ${estimate.min.toFixed(2)} - ${estimate.max.toFixed(2)}{suffix}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                    {/* Swap button - only for Kroger users with connected accounts */}
                                    {prefs?.shoppingPreference !== "instacart" && krogerConnected && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // Clear previous swap state when selecting a new ingredient
                                                setSwapAlternatives(null);
                                                setShowSwapOptions(false);
                                                setExpandedNutritionId(null);
                                                setNutritionData({});
                                                setSelectedIngredientIndex(idx);
                                            }}
                                            className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                            title="Swap product"
                                        >
                                            <RefreshCw className="w-4 h-4 text-gray-400 hover:text-[#4A90E2]" />
                                        </button>
                                    )}
                                    {/* Checkbox for selection */}
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleIngredient(idx);
                                        }}
                                        className="flex-shrink-0 cursor-pointer p-1"
                                    >
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedIngredients.has(idx)
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

                    {/* Recipe Measurements */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <PencilRuler className="w-5 h-5 text-gray-400" />
                            <h3 className="font-medium text-gray-900">
                                Recipe Measurements <span className="text-gray-500 text-sm font-normal">(for {currentServings} serving{currentServings !== 1 ? 's' : ''})</span>
                            </h3>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {meal.ingredients.map((ing, idx) => (
                                <div key={idx} className="text-sm text-gray-600">
                                    <span className="font-medium text-gray-900">{scaleQuantity(ing.quantity, servingMultiplier)}</span>
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

                        {/* Instacart Button - show for Instacart preference users */
                        }
                        {
                            process.env.NEXT_PUBLIC_ENABLE_INSTACART === 'true' && prefs?.shoppingPreference === "instacart" && (
                                <button
                                    onClick={handleAddToInstacart}
                                    disabled={addingToInstacart || selectedIngredients.size === 0}
                                    className="w-full py-4 bg-[#003D29] text-[#FAF1E5] rounded-2xl shadow-lg hover:shadow-xl hover:bg-[#004D35] transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {addingToInstacart ? (
                                        <>
                                            <div className="w-[22px] h-[22px] border-2 border-[#FAF1E5]/30 border-t-[#FAF1E5] rounded-full animate-spin" />
                                            <span>Opening Instacart...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Image src={InstacartCarrot} alt="Instacart" className="w-[22px] h-[22px]" />
                                            <span>Get Recipe Ingredients</span>
                                        </>
                                    )}
                                </button>
                            )
                        }

                        {/* Share Button */}
                        <button
                            onClick={() => setShowShareModal(true)}
                            className="w-full py-4 bg-white border border-[#4A90E2] text-[#4A90E2] rounded-2xl hover:bg-blue-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <Share2 className="w-5 h-5" />
                            <span>Share this meal</span>
                        </button>
                    </div>

                </div>
            </div>

            {/* Upgrade Prompt Modal */}
            {showUpgradePrompt && (
                <UpgradePrompt
                    feature="meal_chat"
                    onClose={() => setShowUpgradePrompt(false)}
                    reason="voluntary"
                />
            )}

            {/* Share Modal */}
            {meal && user && (
                <ShareModal
                    isOpen={showShareModal}
                    onClose={() => setShowShareModal(false)}
                    meal={meal}
                    userId={user?.uid}
                />
            )}

            {/* Dietary Conflict Modal */}
            <DietaryConflictModal
                isOpen={showConflictModal}
                onClose={() => {
                    setShowConflictModal(false);
                    setPendingThreadMessage("");
                }}
                onProceed={handleProceedWithConflicts}
                conflicts={detectedConflicts}
                prompt={pendingThreadMessage}
            />

            {/* Ingredient Detail Modal */}
            {selectedIngredientIndex !== null && meal.ingredients[selectedIngredientIndex] && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
                    <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <h3 className="font-medium text-gray-900">Ingredient Details</h3>
                            <button
                                onClick={() => {
                                    setSelectedIngredientIndex(null);
                                    setShowSwapOptions(false);
                                    setSwapAlternatives(null);
                                }}
                                disabled={loadingSwapSuggestions || swappingIngredient}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {(() => {
                                const ing = meal.ingredients[selectedIngredientIndex];
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
                                        ) : !failedIngredientImages.has(selectedIngredientIndex) ? (
                                            <div className="w-full aspect-square max-w-[200px] mx-auto rounded-xl overflow-hidden bg-gray-100">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={getIngredientImageUrl(ing.name)}
                                                    alt={ing.name}
                                                    className="w-full h-full object-cover"
                                                    onError={() => setFailedIngredientImages(prev => new Set(prev).add(selectedIngredientIndex))}
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
                                                        {ing.productSize || scaleQuantity(ing.quantity, servingMultiplier)}
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
                                                    <span className={`text-sm font-medium ${ing.stockLevel === "HIGH"
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

                                        {/* Nutrition Info */}
                                        {krogerConnected && ing.krogerProductId && (
                                            <div className="bg-gray-50 rounded-xl p-4">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Info className="w-4 h-4 text-gray-500" />
                                                    <span className="text-sm font-medium text-gray-700">Nutrition Facts</span>
                                                </div>
                                                {currentProductNutrition.loading ? (
                                                    <div className="flex items-center justify-center py-4">
                                                        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                                                        <span className="ml-2 text-sm text-gray-500">Loading...</span>
                                                    </div>
                                                ) : currentProductNutrition.data ? (
                                                    <div className="space-y-2">
                                                        {currentProductNutrition.data.servingSize && (
                                                            <div className="text-xs text-gray-500 mb-2">
                                                                Serving: {currentProductNutrition.data.servingSize}
                                                            </div>
                                                        )}
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {currentProductNutrition.data.calories !== null && (
                                                                <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                                                                    <div className="text-base font-semibold text-gray-900">{currentProductNutrition.data.calories}</div>
                                                                    <div className="text-xs text-gray-500">Cal</div>
                                                                </div>
                                                            )}
                                                            {currentProductNutrition.data.protein !== null && (
                                                                <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                                                                    <div className="text-base font-semibold text-gray-900">{currentProductNutrition.data.protein}g</div>
                                                                    <div className="text-xs text-gray-500">Protein</div>
                                                                </div>
                                                            )}
                                                            {currentProductNutrition.data.totalCarbohydrates !== null && (
                                                                <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                                                                    <div className="text-base font-semibold text-gray-900">{currentProductNutrition.data.totalCarbohydrates}g</div>
                                                                    <div className="text-xs text-gray-500">Carbs</div>
                                                                </div>
                                                            )}
                                                            {currentProductNutrition.data.totalFat !== null && (
                                                                <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                                                                    <div className="text-base font-semibold text-gray-900">{currentProductNutrition.data.totalFat}g</div>
                                                                    <div className="text-xs text-gray-500">Fat</div>
                                                                </div>
                                                            )}
                                                            {currentProductNutrition.data.sodium !== null && (
                                                                <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                                                                    <div className="text-base font-semibold text-gray-900">{currentProductNutrition.data.sodium}mg</div>
                                                                    <div className="text-xs text-gray-500">Sodium</div>
                                                                </div>
                                                            )}
                                                            {currentProductNutrition.data.sugars !== null && (
                                                                <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                                                                    <div className="text-base font-semibold text-gray-900">{currentProductNutrition.data.sugars}g</div>
                                                                    <div className="text-xs text-gray-500">Sugar</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-gray-500 text-center py-2">
                                                        Nutrition info not available
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Selection Toggle */}
                                        <div
                                            onClick={() => toggleIngredient(selectedIngredientIndex)}
                                            className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer"
                                        >
                                            <span className="text-sm text-gray-700">Include in shopping list</span>
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedIngredients.has(selectedIngredientIndex)
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
                                    <div className="space-y-2 max-h-80 overflow-y-auto">
                                        {swapAlternatives.map((product) => (
                                            <div
                                                key={product.krogerProductId}
                                                className="border rounded-xl overflow-hidden bg-gray-50 border-gray-200"
                                            >
                                                <div className="p-3 flex items-center gap-3">
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
                                                </div>
                                                {/* Action buttons */}
                                                <div className="flex border-t border-gray-200/50">
                                                    <button
                                                        onClick={() => fetchProductNutrition(product.krogerProductId)}
                                                        className="flex-1 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100/50 flex items-center justify-center gap-1 border-r border-gray-200/50"
                                                    >
                                                        {nutritionData[product.krogerProductId]?.loading ? (
                                                            <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                                                        ) : (
                                                            <Info className="w-3 h-3" />
                                                        )}
                                                        Nutrition
                                                        {expandedNutritionId === product.krogerProductId ? (
                                                            <ChevronUp className="w-3 h-3" />
                                                        ) : (
                                                            <ChevronDown className="w-3 h-3" />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => handleSelectSwap(product)}
                                                        disabled={swappingIngredient}
                                                        className="flex-1 py-2 text-xs font-medium text-[#4A90E2] hover:bg-[#4A90E2]/10 flex items-center justify-center gap-1 disabled:opacity-50"
                                                    >
                                                        <RefreshCw className="w-3 h-3" />
                                                        Swap
                                                    </button>
                                                </div>
                                                {/* Nutrition panel */}
                                                {expandedNutritionId === product.krogerProductId && (
                                                    <div className="px-3 pb-3 pt-2 border-t border-gray-200/50 bg-white/50">
                                                        {nutritionData[product.krogerProductId]?.loading ? (
                                                            <div className="text-xs text-gray-500 text-center py-2">Loading nutrition...</div>
                                                        ) : nutritionData[product.krogerProductId]?.data ? (
                                                            <div className="space-y-1">
                                                                {nutritionData[product.krogerProductId].data?.servingSize && (
                                                                    <div className="text-[10px] text-gray-500 mb-2">
                                                                        Serving: {nutritionData[product.krogerProductId].data?.servingSize}
                                                                    </div>
                                                                )}
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    {nutritionData[product.krogerProductId].data?.calories !== null && (
                                                                        <div className="text-center p-1.5 bg-gray-100 rounded-lg">
                                                                            <div className="text-xs font-semibold text-gray-900">{nutritionData[product.krogerProductId].data?.calories}</div>
                                                                            <div className="text-[10px] text-gray-500">Cal</div>
                                                                        </div>
                                                                    )}
                                                                    {nutritionData[product.krogerProductId].data?.protein !== null && (
                                                                        <div className="text-center p-1.5 bg-gray-100 rounded-lg">
                                                                            <div className="text-xs font-semibold text-gray-900">{nutritionData[product.krogerProductId].data?.protein}g</div>
                                                                            <div className="text-[10px] text-gray-500">Protein</div>
                                                                        </div>
                                                                    )}
                                                                    {nutritionData[product.krogerProductId].data?.totalCarbohydrates !== null && (
                                                                        <div className="text-center p-1.5 bg-gray-100 rounded-lg">
                                                                            <div className="text-xs font-semibold text-gray-900">{nutritionData[product.krogerProductId].data?.totalCarbohydrates}g</div>
                                                                            <div className="text-[10px] text-gray-500">Carbs</div>
                                                                        </div>
                                                                    )}
                                                                    {nutritionData[product.krogerProductId].data?.totalFat !== null && (
                                                                        <div className="text-center p-1.5 bg-gray-100 rounded-lg">
                                                                            <div className="text-xs font-semibold text-gray-900">{nutritionData[product.krogerProductId].data?.totalFat}g</div>
                                                                            <div className="text-[10px] text-gray-500">Fat</div>
                                                                        </div>
                                                                    )}
                                                                    {nutritionData[product.krogerProductId].data?.sodium !== null && (
                                                                        <div className="text-center p-1.5 bg-gray-100 rounded-lg">
                                                                            <div className="text-xs font-semibold text-gray-900">{nutritionData[product.krogerProductId].data?.sodium}mg</div>
                                                                            <div className="text-[10px] text-gray-500">Sodium</div>
                                                                        </div>
                                                                    )}
                                                                    {nutritionData[product.krogerProductId].data?.sugars !== null && (
                                                                        <div className="text-center p-1.5 bg-gray-100 rounded-lg">
                                                                            <div className="text-xs font-semibold text-gray-900">{nutritionData[product.krogerProductId].data?.sugars}g</div>
                                                                            <div className="text-[10px] text-gray-500">Sugar</div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-xs text-gray-500 text-center py-2">Nutrition info not available</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowSwapOptions(false);
                                            setSwapAlternatives(null);
                                            setExpandedNutritionId(null);
                                            setNutritionData({});
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
