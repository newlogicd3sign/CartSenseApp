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
};

export default function SavedMealsPage() {
    const router = useRouter();

    const [user, setUser] = useState<User | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [meals, setMeals] = useState<SavedMeal[]>([]);
    const [loadingMeals, setLoadingMeals] = useState(true);

    // Auth
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

    // Subscribe to saved meals
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
            },
        );

        return () => unsub();
    }, [user]);

    const handleRemoveMeal = async (mealId: string) => {
        if (!user) return;

        try {
            await deleteDoc(doc(db, "savedMeals", user.uid, "meals", mealId));
            // Optional: you *could* log a "meal_removed" event here later if we add that type
        } catch (err) {
            console.error("Error deleting saved meal", err);
        }
    };

    const handleViewMeal = async (mealId: string) => {
        // 🔹 Log that the user intentionally viewed this saved meal
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

    const formatSavedAt = (ts: any) => {
        const d = ts?.toDate?.() || new Date();
        const date = d.toLocaleDateString([], { month: "long", day: "numeric" });
        const time = d.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
        });
        return `${date} • ${time}`;
    };

    if (loadingUser || loadingMeals) {
        return (
            <div style={{ padding: "2rem" }}>
                <p>Loading your saved meals…</p>
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

    return (
        <div style={{ padding: "2rem", maxWidth: 900 }}>
            <h1>Saved Meals</h1>
            <p
                style={{
                    marginTop: "0.5rem",
                    color: "#4b5563",
                    fontSize: "0.95rem",
                }}
            >
                Meals you’ve saved to cook again later.
            </p>

            {meals.length === 0 ? (
                <div style={{ marginTop: "1.5rem" }}>
                    <p>You don’t have any saved meals yet.</p>
                    <button
                        onClick={() => router.push("/prompt")}
                        style={{
                            marginTop: "1rem",
                            padding: "0.5rem 1rem",
                            borderRadius: "999px",
                            border: "1px solid #d1d5db",
                            fontSize: "0.85rem",
                            background: "#f9fafb",
                        }}
                    >
                        Search for meals
                    </button>
                </div>
            ) : (
                <div
                    style={{
                        marginTop: "1.5rem",
                        display: "grid",
                        gap: "1rem",
                    }}
                >
                    {meals.map((meal) => (
                        <div
                            key={meal.id}
                            style={{
                                border: "1px solid #e5e7eb",
                                borderRadius: "12px",
                                padding: "1rem 1.25rem",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    gap: "0.75rem",
                                }}
                            >
                                <div>
                                    <p
                                        style={{
                                            fontSize: "0.8rem",
                                            textTransform: "uppercase",
                                            marginBottom: "0.25rem",
                                        }}
                                    >
                                        {meal.mealType}
                                    </p>
                                    <h2
                                        style={{
                                            margin: "0 0 0.4rem",
                                            fontSize: "1.05rem",
                                        }}
                                    >
                                        {meal.name}
                                    </h2>
                                    <p
                                        style={{
                                            fontSize: "0.9rem",
                                            margin: 0,
                                            color: "#4b5563",
                                        }}
                                    >
                                        {meal.description}
                                    </p>
                                    {meal.savedAt && (
                                        <p
                                            style={{
                                                marginTop: "0.35rem",
                                                fontSize: "0.8rem",
                                                color: "#6b7280",
                                            }}
                                        >
                                            Saved {formatSavedAt(meal.savedAt)}
                                        </p>
                                    )}
                                </div>

                                <button
                                    onClick={() => handleRemoveMeal(meal.id)}
                                    style={{
                                        padding: "0.25rem 0.6rem",
                                        borderRadius: "999px",
                                        border: "1px solid #ef4444",
                                        background: "#fef2f2",
                                        color: "#b91c1c",
                                        fontSize: "0.8rem",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    Remove
                                </button>
                            </div>

                            {/* Macros row */}
                            <div
                                style={{
                                    display: "flex",
                                    gap: "1rem",
                                    fontSize: "0.85rem",
                                    marginTop: "0.75rem",
                                }}
                            >
                                <span>🔥 {meal.macros.calories} kcal</span>
                                <span>🥩 {meal.macros.protein}g protein</span>
                                <span>🍚 {meal.macros.carbs}g carbs</span>
                                <span>🫒 {meal.macros.fat}g fat</span>
                            </div>

                            <div
                                style={{
                                    display: "flex",
                                    gap: "0.5rem",
                                    marginTop: "0.75rem",
                                    flexWrap: "wrap",
                                }}
                            >
                                <button
                                    onClick={() => handleViewMeal(meal.id)}
                                    style={{
                                        padding: "0.4rem 0.9rem",
                                        borderRadius: "999px",
                                        border: "1px solid #111827",
                                        fontSize: "0.85rem",
                                    }}
                                >
                                    View meal
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
