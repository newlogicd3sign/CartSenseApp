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

type Ingredient = {
    name: string;
    quantity: string;
    category?: string;
    aisle?: string;
    price?: number;
    // Kroger enrichment (all optional)
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

    // Auth
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                router.push("/login");
                return;
            }

            setUser(firebaseUser);
            setLoadingUser(false);
        });

        return () => unsub();
    }, [router]);

    // Load saved meal from Firestore
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

    const handleAddToShoppingList = async () => {
        if (!user || !meal) return;

        try {
            setAddingToList(true);
            setAddMessage(null);

            const itemsCol = collection(db, "shoppingLists", user.uid, "items");

            const writes = meal.ingredients.map((ing) =>
                addDoc(itemsCol, {
                    name: ing.name,
                    quantity: ing.quantity,
                    mealId: meal.id,
                    mealName: meal.name,
                    checked: false,
                    createdAt: serverTimestamp(),

                    // NEW: Kroger metadata (all optional)
                    krogerProductId: ing.krogerProductId ?? null,
                    productName: ing.productName ?? null,
                    productImageUrl: ing.productImageUrl ?? null,
                    productSize: ing.productSize ?? null,
                    productAisle: ing.productAisle ?? null,
                    price: typeof ing.price === "number" ? ing.price : null,
                }),
            );


            await Promise.all(writes);

            setAddMessage(
                `Added ${meal.ingredients.length} items to your shopping list.`,
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
        return `${date} • ${time}`;
    };

    if (loadingUser || loadingMeal) {
        return (
            <div style={{ padding: "2rem" }}>
                <p>Loading your saved meal…</p>
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
                <p>Couldn’t find that saved meal.</p>
                <button
                    onClick={() => router.push("/saved-meals")}
                    style={{
                        marginTop: "1rem",
                        padding: "0.5rem 1rem",
                        borderRadius: "999px",
                        border: "1px solid #d1d5db",
                        fontSize: "0.85rem",
                        background: "#f9fafb",
                    }}
                >
                    Back to saved meals
                </button>
            </div>
        );
    }

    const netCarbs = meal.macros.carbs;

    return (
        <div style={{ padding: "2rem", maxWidth: 800 }}>
            <button
                onClick={() => router.push("/saved-meals")}
                style={{
                    marginBottom: "1.5rem",
                    padding: "0.4rem 0.9rem",
                    borderRadius: "999px",
                    border: "1px solid #d1d5db",
                    fontSize: "0.85rem",
                    background: "#f9fafb",
                }}
            >
                ← Back to saved meals
            </button>

            <p style={{ fontSize: "0.8rem", textTransform: "uppercase" }}>
                {meal.mealType}
            </p>
            <h1 style={{ margin: "0.25rem 0 0.5rem" }}>{meal.name}</h1>
            <p style={{ fontSize: "0.95rem", marginBottom: "0.75rem" }}>
                {meal.description}
            </p>

            {meal.savedAt && (
                <p
                    style={{
                        fontSize: "0.85rem",
                        color: "#6b7280",
                        marginBottom: "0.75rem",
                    }}
                >
                    Saved {formatSavedAt(meal.savedAt)}
                </p>
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

            {/* Prompt context */}
            {meal.prompt && (
                <div
                    style={{
                        marginBottom: "1.5rem",
                        padding: "0.75rem 1rem",
                        background: "#f3f4f6",
                        borderRadius: "8px",
                        fontSize: "0.9rem",
                    }}
                >
                    <strong>Your original request:</strong>
                    <br />
                    {meal.prompt}
                </div>
            )}

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
                                flexDirection: "column",
                                padding: "0.4rem 0",
                                borderBottom:
                                    idx === meal.ingredients.length - 1
                                        ? "none"
                                        : "1px solid #f3f4f6",
                            }}
                        >
                            <div style={{ fontWeight: 500 }}>{ing.name}</div>
                            <div
                                style={{
                                    fontSize: "0.85rem",
                                    color: "#4b5563",
                                }}
                            >
                                {ing.quantity}
                                {ing.category ? ` • ${ing.category}` : ""}
                                {ing.aisle ? ` • Aisle ${ing.aisle}` : ""}
                                {typeof ing.price === "number"
                                    ? ` • $${ing.price.toFixed(2)}`
                                    : ""}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Cooking Steps */}
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

            {/* Actions */}
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
        </div>
    );
}
