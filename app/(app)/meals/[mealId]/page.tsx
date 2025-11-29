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

type Ingredient = {
    name: string;
    quantity: string;
    category?: string;
    aisle?: string;
    price?: number;

    // Kroger enrichment fields
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

    // 🖼 Hero image for this meal
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

// ---- doctor meta (same shape as /meals page) ----
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
    | Meal[]; // backward compat

export default function MealDetailPage(): JSX.Element {
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

    // Kroger flag
    const [krogerConnected, setKrogerConnected] = useState(false);

    // Doctor meta for this generated batch
    const [mealsMeta, setMealsMeta] = useState<MealsMeta | null>(null);

    // Chat state
    const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
    const [threadInput, setThreadInput] = useState("");
    const [sendingThread, setSendingThread] = useState(false);
    const [threadError, setThreadError] = useState<string | null>(null);

    // Learning: track that we've logged a view for this meal
    const [hasLoggedView, setHasLoggedView] = useState(false);

    // 1️⃣ Auth + prefs
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

    // 2️⃣ Load this meal + meta from sessionStorage (NOT from URL)
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

    // 2.5️⃣ Learning: log that this specific generated meal was viewed
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

    // Helper: update meal in state + sessionStorage when AI changes it
    const applyUpdatedMeal = (updatedMeal: Meal) => {
        setMeal(updatedMeal);

        try {
            const stored = sessionStorage.getItem("generatedMeals");
            if (!stored) return;

            const parsed: StoredMealsPayload = JSON.parse(stored);

            // Old shape: Meal[]
            if (Array.isArray(parsed)) {
                const list = [...parsed];
                const idx = list.findIndex((m) => m.id === updatedMeal.id);
                if (idx >= 0) {
                    list[idx] = updatedMeal;
                    sessionStorage.setItem(
                        "generatedMeals",
                        JSON.stringify(list),
                    );
                }
                return;
            }

            // New shape: { meals, meta }
            const list = Array.isArray(parsed.meals) ? [...parsed.meals] : [];
            const idx = list.findIndex((m) => m.id === updatedMeal.id);
            if (idx >= 0) {
                list[idx] = updatedMeal;
                const newPayload = {
                    ...parsed,
                    meals: list,
                };
                sessionStorage.setItem(
                    "generatedMeals",
                    JSON.stringify(newPayload),
                );
            }
        } catch (err) {
            console.error("Error updating generatedMeals in sessionStorage", err);
        }
    };

    // 3️⃣ Add ingredients to shopping list
    const handleAddToShoppingList = async () => {
        if (!user || !meal) return;

        try {
            setAddingToList(true);
            setAddMessage(null);

            const itemsCol = collection(db, "shoppingLists", user.uid, "items");

            await Promise.all(
                meal.ingredients.map((ing) =>
                    addDoc(itemsCol, {
                        name: ing.name,
                        quantity: ing.quantity,
                        mealId: meal.id,
                        mealName: meal.name,
                        checked: false,
                        createdAt: serverTimestamp(),

                        // Only persist Kroger metadata if connected
                        krogerProductId: krogerConnected
                            ? ing.krogerProductId ?? null
                            : null,
                        productName: krogerConnected ? ing.productName ?? null : null,
                        productImageUrl: krogerConnected
                            ? ing.productImageUrl ?? null
                            : null,
                        productSize: krogerConnected ? ing.productSize ?? null : null,
                        productAisle: krogerConnected
                            ? ing.productAisle ?? null
                            : null,
                        price:
                            krogerConnected && typeof ing.price === "number"
                                ? ing.price
                                : null,
                    }),
                ),
            );

            setAddMessage(
                `Added ${meal.ingredients.length} items to your shopping list.`,
            );

            // 🔹 Learning: log that items from this meal were added to shopping list
            logUserEvent(user.uid, {
                type: "added_to_shopping_list",
                mealId: meal.id,
            }).catch((err) => {
                console.error(
                    "Failed to log added_to_shopping_list event:",
                    err,
                );
            });
        } catch (err) {
            console.error("Error adding to shopping list", err);
            setAddMessage("Something went wrong adding items to your list.");
        } finally {
            setAddingToList(false);
        }
    };

    // 4️⃣ Save the whole meal
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

            // 🔹 Learning: log that this meal was saved
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

    // 5️⃣ "Streaming" chat with this meal (frontend-only streaming)
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

        // 🔹 Learning: log that the user sent a thread message about this meal
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

            // Start with an empty assistant message
            const assistantMsg: ThreadMessage = {
                id: assistantId,
                role: "assistant",
                content: "",
                createdAt: new Date().toISOString(),
            };

            setThreadMessages((prev) => [...prev, assistantMsg]);

            // Pseudo-stream the reply text on the client
            let index = 0;
            const step = 3; // characters per tick
            const delay = 20; // ms between ticks

            const intervalId = window.setInterval(() => {
                index += step;
                if (index >= fullReply.length) {
                    index = fullReply.length;
                }

                const partial = fullReply.slice(0, index);

                setThreadMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === assistantId
                            ? { ...msg, content: partial }
                            : msg,
                    ),
                );

                if (index >= fullReply.length) {
                    window.clearInterval(intervalId);
                }
            }, delay);

            // Apply updated meal after we have the reply
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

    // Loading / guard states
    if (loadingUser || loadingMeal) {
        return (
            <div style={{ padding: "2rem" }}>
                <p>Loading your meal…</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div style={{ padding: "2rem" }}>
                <p>Redirecting to login…</p>
            </div>
        );
    }

    if (!meal) {
        return (
            <div style={{ padding: "2rem" }}>
                <p>Couldn’t find that meal.</p>
                <button
                    onClick={() => router.push(`/meals?prompt=${promptParam}`)}
                    style={{
                        marginTop: "1rem",
                        padding: "0.5rem 1rem",
                        borderRadius: "999px",
                        border: "1px solid #d1d5db",
                        fontSize: "0.85rem",
                        background: "#f9fafb",
                    }}
                >
                    Back to your meals
                </button>
            </div>
        );
    }

    const netCarbs = meal.macros.carbs;
    const doctorApplied = Boolean(mealsMeta?.usedDoctorInstructions);
    const blockedIngredients =
        mealsMeta?.blockedIngredientsFromDoctor || [];
    const blockedGroups = mealsMeta?.blockedGroupsFromDoctor || [];

    return (
        <div style={{ padding: "2rem", maxWidth: 800 }}>
            <button
                onClick={() => router.push(`/meals?prompt=${promptParam}`)}
                style={{
                    marginBottom: "1.5rem",
                    padding: "0.4rem 0.9rem",
                    borderRadius: "999px",
                    border: "1px solid #d1d5db",
                    fontSize: "0.85rem",
                    background: "#f9fafb",
                }}
            >
                ← Back to your meals
            </button>

            {/* 🖼 Hero meal image */}
            <div
                style={{
                    width: "100%",
                    borderRadius: "0.75rem",
                    overflow: "hidden",
                    marginBottom: "1rem",
                    maxHeight: 360,
                    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.25)",
                    background: "#e5e7eb",
                }}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={
                        meal.imageUrl ??
                        "https://placehold.co/800x500?text=Meal+Image"
                    }
                    alt={meal.name}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                    }}
                />
            </div>

            <p style={{ fontSize: "0.8rem", textTransform: "uppercase" }}>
                {meal.mealType}
            </p>
            <h1 style={{ margin: "0.25rem 0 0.5rem" }}>{meal.name}</h1>
            <p style={{ fontSize: "0.95rem", marginBottom: "0.75rem" }}>
                {meal.description}
            </p>

            {/* optional doctor note tag under title */}
            {doctorApplied && (
                <div
                    style={{
                        marginBottom: "0.75rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        padding: "0.2rem 0.7rem",
                        borderRadius: "999px",
                        border: "1px solid "#0f766e",
                        background: "#ecfdf5",
                        fontSize: "0.8rem",
                        color: "#0f766e",
                    }}
                >
                    <span
                        style={{
                            width: 6,
                            height: 6,
                            borderRadius: "999px",
                            background: "#0f766e",
                        }}
                    />
                    Generated with your doctor&apos;s instructions
                </div>
            )}

            {/* Macros row */}
            <div
                style={{
                    display: "flex",
                    gap: "1rem",
                    fontSize: "0.85rem",
                    marginBottom: "1rem",
                }}
            >
                <span>🔥 {meal.macros.calories} kcal</span>
                <span>🥩 {meal.macros.protein}g protein</span>
                <span>🍚 {meal.macros.carbs}g carbs</span>
                <span>🫒 {meal.macros.fat}g fat</span>
            </div>

            {/* Prompt context + doctor details */}
            {displayedPrompt && (
                <div
                    style={{
                        marginBottom: "1rem",
                        padding: "0.75rem 1rem",
                        background: "#f3f4f6",
                        borderRadius: "8px",
                        fontSize: "0.9rem",
                    }}
                >
                    <strong>Your request:</strong>
                    <br />
                    {displayedPrompt}
                </div>
            )}

            {doctorApplied &&
                (blockedIngredients.length > 0 || blockedGroups.length > 0) && (
                    <div
                        style={{
                            marginBottom: "1.5rem",
                            border: "1px solid #d1fae5",
                            background: "#ecfdf5",
                            borderRadius: "0.75rem",
                            padding: "0.75rem 1rem",
                            fontSize: "0.8rem",
                            color: "#047857",
                        }}
                    >
                        <p style={{ margin: 0, marginBottom: "0.3rem" }}>
                            This meal was generated while avoiding the items your doctor
                            marked to stay away from.
                        </p>
                        {blockedIngredients.length > 0 && (
                            <p style={{ margin: 0 }}>
                                <strong>Blocked ingredients:</strong>{" "}
                                {blockedIngredients.join(", ")}
                            </p>
                        )}
                        {blockedGroups.length > 0 && (
                            <p style={{ margin: 0 }}>
                                <strong>Blocked groups:</strong>{" "}
                                {blockedGroups.join(", ")}
                            </p>
                        )}
                    </div>
                )}

            {/* 💬 Chat with this meal (near top) */}
            <div
                style={{
                    borderTop: "1px solid #e5e7eb",
                    paddingTop: "1rem",
                    marginTop: "0.5rem",
                    marginBottom: "1rem",
                }}
            >
                <h3 style={{ marginBottom: "0.5rem" }}>
                    Ask CartSense about this meal
                </h3>
                <p
                    style={{
                        fontSize: "0.85rem",
                        color: "#4b5563",
                        marginBottom: "0.5rem",
                    }}
                >
                    Ask to swap ingredients, make it dairy-free, lower sodium,
                    change servings, or turn it into a new variant.
                </p>

                {threadMessages.length > 0 && (
                    <div
                        style={{
                            maxHeight: 260,
                            overflowY: "auto",
                            marginBottom: "0.75rem",
                            padding: "0.5rem",
                            borderRadius: "0.75rem",
                            border: "1px solid #e5e7eb",
                            background: "#f9fafb",
                        }}
                    >
                        {threadMessages.map((msg) => (
                            <div
                                key={msg.id}
                                style={{
                                    marginBottom: "0.5rem",
                                    textAlign:
                                        msg.role === "user" ? "right" : "left",
                                }}
                            >
                                <div
                                    style={{
                                        display: "inline-block",
                                        padding: "0.4rem 0.6rem",
                                        borderRadius: "0.75rem",
                                        fontSize: "0.85rem",
                                        background:
                                            msg.role === "user"
                                                ? "#111827"
                                                : "#e5e7eb",
                                        color:
                                            msg.role === "user"
                                                ? "#ffffff"
                                                : "#111827",
                                    }}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div
                    style={{
                        display: "flex",
                        gap: "0.5rem",
                        alignItems: "center",
                    }}
                >
                    <input
                        type="text"
                        value={threadInput}
                        onChange={(e) => setThreadInput(e.target.value)}
                        placeholder="E.g. make this dairy-free, or swap chicken for ground turkey…"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                if (!sendingThread) {
                                    handleSendThreadMessage();
                                }
                            }
                        }}
                        style={{
                            flex: 1,
                            padding: "0.45rem 0.75rem",
                            borderRadius: "999px",
                            border: "1px solid #d1d5db",
                            fontSize: "0.85rem",
                        }}
                    />
                    <button
                        onClick={handleSendThreadMessage}
                        disabled={sendingThread || !threadInput.trim()}
                        style={{
                            padding: "0.4rem 0.9rem",
                            borderRadius: "999px",
                            border: "1px solid #111827",
                            fontSize: "0.85rem",
                            background: "#111827",
                            color: "#ffffff",
                            opacity:
                                sendingThread || !threadInput.trim() ? 0.6 : 1,
                            cursor:
                                sendingThread || !threadInput.trim()
                                    ? "default"
                                    : "pointer",
                        }}
                    >
                        {sendingThread ? "Thinking…" : "Ask"}
                    </button>
                </div>

                {threadError && (
                    <p
                        style={{
                            marginTop: "0.4rem",
                            fontSize: "0.8rem",
                            color: "#b91c1c",
                        }}
                    >
                        {threadError}
                    </p>
                )}
            </div>

            {/* Nutrition per serving */}
            <div
                style={{
                    borderTop: "1px solid #e5e7eb",
                    paddingTop: "1rem",
                    marginTop: "0.5rem",
                }}
            >
                <h3 style={{ marginBottom: "0.5rem" }}>Nutrition per serving</h3>
                <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                    Servings: {meal.servings}
                </p>
                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "1.5rem",
                        fontSize: "0.9rem",
                    }}
                >
                    <div>
                        <div
                            style={{
                                fontSize: "1.3rem",
                                fontWeight: 600,
                            }}
                        >
                            {meal.macros.calories}
                        </div>
                        <div>kcal</div>
                    </div>
                    <div>
                        <div>{meal.macros.protein}g</div>
                        <div>Protein</div>
                    </div>
                    <div>
                        <div>{netCarbs}g</div>
                        <div>Net Carbs</div>
                    </div>
                    <div>
                        <div>{meal.macros.fat}g</div>
                        <div>Fat</div>
                    </div>
                </div>
            </div>

            {/* Ingredients */}
            <div
                style={{
                    borderTop: "1px solid #e5e7eb",
                    paddingTop: "1rem",
                    marginTop: "1rem",
                }}
            >
                <h3 style={{ marginBottom: "0.5rem" }}>
                    Ingredients ({meal.ingredients.length})
                </h3>
                <ul
                    style={{
                        listStyle: "none",
                        padding: 0,
                        margin: 0,
                    }}
                >
                    {meal.ingredients.map((ing, idx) => (
                        <li
                            key={idx}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                padding: "0.4rem 0",
                                borderBottom:
                                    idx === meal.ingredients.length - 1
                                        ? "none"
                                        : "1px solid #f3f4f6",
                            }}
                        >
                            {/* Left side: text details */}
                            <div style={{ flex: 1 }}>
                                <div
                                    style={{
                                        fontWeight: 500,
                                        fontSize: "0.9rem",
                                    }}
                                >
                                    {ing.name}
                                </div>

                                <div
                                    style={{
                                        fontSize: "0.85rem",
                                        color: "#4b5563",
                                    }}
                                >
                                    {ing.quantity}
                                    {ing.category ? ` • ${ing.category}` : ""}
                                    {krogerConnected && ing.aisle
                                        ? ` • Aisle ${ing.aisle}`
                                        : ""}
                                    {krogerConnected &&
                                    typeof ing.price === "number"
                                        ? ` • $${ing.price.toFixed(2)}`
                                        : ""}
                                </div>

                                {krogerConnected &&
                                    (ing.productAisle ||
                                        ing.productSize ||
                                        typeof ing.price === "number" ||
                                        ing.productName ||
                                        ing.krogerProductId ||
                                        ing.productImageUrl) && (
                                        <div
                                            style={{
                                                marginTop: "0.15rem",
                                                fontSize: "0.8rem",
                                                color: "#6b7280",
                                                display: "flex",
                                                flexWrap: "wrap",
                                                gap: "0.35rem",
                                            }}
                                        >
                                            {ing.productAisle && (
                                                <span>{ing.productAisle}</span>
                                            )}
                                            {ing.productSize && (
                                                <span>{ing.productSize}</span>
                                            )}
                                            {typeof ing.price === "number" && (
                                                <span>
                                                    ${ing.price.toFixed(2)}
                                                </span>
                                            )}
                                            {ing.productName && (
                                                <span
                                                    style={{
                                                        maxWidth: "12rem",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {ing.productName}
                                                </span>
                                            )}
                                            {ing.krogerProductId && (
                                                <a
                                                    href={`https://www.kroger.com/p/${ing.krogerProductId}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    style={{
                                                        textDecoration:
                                                            "underline",
                                                        textUnderlineOffset:
                                                            "2px",
                                                    }}
                                                >
                                                    View at Kroger
                                                </a>
                                            )}
                                        </div>
                                    )}
                            </div>

                            {krogerConnected && ing.productImageUrl && (
                                <div
                                    style={{
                                        width: "3rem",
                                        height: "3rem",
                                        borderRadius: "0.5rem",
                                        overflow: "hidden",
                                        background: "#e5e7eb",
                                        marginLeft: "0.75rem",
                                        flexShrink: 0,
                                    }}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={ing.productImageUrl}
                                        alt={ing.productName || ing.name}
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                        }}
                                    />
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Cooking steps */}
            <div
                style={{
                    borderTop: "1px solid #e5e7eb",
                    paddingTop: "1rem",
                    marginTop: "1rem",
                }}
            >
                <h3 style={{ marginBottom: "0.5rem" }}>Cooking Steps</h3>
                <ol
                    style={{
                        paddingLeft: "1.25rem",
                        margin: 0,
                    }}
                >
                    {meal.steps.map((step, idx) => (
                        <li
                            key={idx}
                            style={{
                                marginBottom: "0.4rem",
                                fontSize: "0.9rem",
                            }}
                        >
                            {step}
                        </li>
                    ))}
                </ol>
            </div>

            {/* CTAs */}
            <div
                style={{
                    borderTop: "1px solid #e5e7eb",
                    paddingTop: "1rem",
                    marginTop: "1rem",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                }}
            >
                <button
                    onClick={handleAddToShoppingList}
                    disabled={addingToList}
                    style={{
                        padding: "0.4rem 0.9rem",
                        borderRadius: "999px",
                        border: "1px solid #111827",
                        fontSize: "0.85rem",
                        opacity: addingToList ? 0.7 : 1,
                        cursor: addingToList ? "default" : "pointer",
                    }}
                >
                    {addingToList
                        ? "Adding…"
                        : `Add ${meal.ingredients.length} items to shopping list`}
                </button>

                <button
                    onClick={handleSaveMeal}
                    disabled={savingMeal}
                    style={{
                        padding: "0.4rem 0.9rem",
                        borderRadius: "999px",
                        border: "1px solid #111827",
                        fontSize: "0.85rem",
                        background: "#111827",
                        color: "#ffffff",
                        opacity: savingMeal ? 0.7 : 1,
                        cursor: savingMeal ? "default" : "pointer",
                    }}
                >
                    {savingMeal ? "Saving…" : "Save meal"}
                </button>
            </div>

            {addMessage && (
                <p
                    style={{
                        marginTop: "0.75rem",
                        fontSize: "0.85rem",
                    }}
                >
                    {addMessage}
                </p>
            )}

            {saveMessage && (
                <p
                    style={{
                        marginTop: "0.25rem",
                        fontSize: "0.85rem",
                    }}
                >
                    {saveMessage}
                </p>
            )}
        </div>
    );
}
