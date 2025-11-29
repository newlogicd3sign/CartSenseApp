"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

type Ingredient = {
    name: string;
    quantity: string;
    category?: string; // Pantry / Produce / Dairy, etc.
    aisle?: string; // optional for future Kroger mapping
    price?: number; // optional
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

    // 🖼 NEW: hero image for this meal
    imageUrl?: string;
};

type MealsMeta = {
    usedDoctorInstructions?: boolean;
    blockedIngredientsFromDoctor?: string[];
    blockedGroupsFromDoctor?: string[];
};

// What we now store in sessionStorage under "generatedMeals"
type StoredMealsPayload =
    | {
    meals: Meal[];
    meta?: MealsMeta;
}
    | Meal[]; // backward-compat for old sessions

export default function MealsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const promptFromUrl = searchParams.get("prompt") || "";

    const [user, setUser] = useState<User | null>(null);
    const [prefs, setPrefs] = useState<any>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [meals, setMeals] = useState<Meal[]>([]);
    const [mealsMeta, setMealsMeta] = useState<MealsMeta | null>(null);
    const [loadingMeals, setLoadingMeals] = useState(true);

    // 1️⃣ Load user + preferences
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                router.push("/login");
                return;
            }

            setUser(firebaseUser);

            const ref = doc(db, "users", firebaseUser.uid);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                setPrefs(snap.data());
            }

            setLoadingUser(false);
        });

        return () => unsub();
    }, [router]);

    // 2️⃣ Load meals from sessionStorage (NOT from URL)
    useEffect(() => {
        if (!user || !prefs) return;

        setLoadingMeals(true);

        try {
            const stored = sessionStorage.getItem("generatedMeals");
            if (!stored) {
                setMeals([]);
                setMealsMeta(null);
            } else {
                const parsed: StoredMealsPayload = JSON.parse(stored);

                if (Array.isArray(parsed)) {
                    // Old shape: just an array of meals
                    setMeals(parsed);
                    setMealsMeta(null);
                } else {
                    setMeals(parsed.meals ?? []);
                    setMealsMeta(parsed.meta ?? null);
                }
            }
        } catch (err) {
            console.error("Failed to parse meals from sessionStorage", err);
            setMeals([]);
            setMealsMeta(null);
        }

        setLoadingMeals(false);
    }, [user, prefs]); // 👈 fixed-size deps: always [user, prefs]

    if (loadingUser) {
        return (
            <div style={{ padding: "2rem" }}>
                <p>Loading your CartSense profile…</p>
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

    const displayedPrompt =
        promptFromUrl && promptFromUrl.trim().length > 0
            ? decodeURIComponent(promptFromUrl)
            : "No prompt provided.";

    const doctorApplied = Boolean(mealsMeta?.usedDoctorInstructions);
    const blockedIngredients = mealsMeta?.blockedIngredientsFromDoctor || [];
    const blockedGroups = mealsMeta?.blockedGroupsFromDoctor || [];

    return (
        <div style={{ padding: "2rem", maxWidth: 800 }}>
            <h1>Meals for {prefs?.name || user.email}</h1>

            <p style={{ marginTop: "0.5rem" }}>
                Based on your diet focus{" "}
                <strong>{prefs?.dietType || "not set yet"}</strong>
                {prefs?.allergiesAndSensitivities &&
                    prefs.allergiesAndSensitivities.allergies?.length > 0 && (
                        <>
                            {" "}
                            and avoiding{" "}
                            <strong>
                                {prefs.allergiesAndSensitivities.allergies.join(", ")}
                            </strong>
                        </>
                    )}
                .
            </p>

            <div
                style={{
                    marginTop: "1rem",
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

            {/* Doctor note indicator + details */}
            {doctorApplied && (
                <div style={{ marginTop: "0.75rem" }}>
                    {/* Pill */}
                    <div
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.4rem",
                            padding: "0.25rem 0.75rem",
                            borderRadius: "999px",
                            border: "1px solid #0f766e",
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
                        Doctor note applied
                    </div>

                    {(blockedIngredients.length > 0 || blockedGroups.length > 0) && (
                        <div
                            style={{
                                marginTop: "0.5rem",
                                border: "1px solid #d1fae5",
                                background: "#ecfdf5",
                                borderRadius: "0.75rem",
                                padding: "0.75rem 1rem",
                                fontSize: "0.8rem",
                                color: "#047857",
                            }}
                        >
                            <p style={{ margin: 0, marginBottom: "0.3rem" }}>
                                These meals were filtered using your doctor’s diet
                                instructions.
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
                </div>
            )}

            {loadingMeals ? (
                <div style={{ marginTop: "2rem" }}>
                    <p>Generating meals for you…</p>
                </div>
            ) : meals.length === 0 ? (
                <div style={{ marginTop: "2rem" }}>
                    <p>
                        No meals were generated. Try going back and submitting a new
                        prompt.
                    </p>
                </div>
            ) : (
                <div style={{ marginTop: "2rem", display: "grid", gap: "1rem" }}>
                    {meals.map((meal) => {
                        const heroSrc =
                            meal.imageUrl ??
                            "https://placehold.co/800x450?text=Meal+Image";

                        return (
                            <div
                                key={meal.id}
                                style={{
                                    border: "1px solid #e5e7eb",
                                    borderRadius: "12px",
                                    padding: "0", // image sits flush, content gets its own padding
                                    overflow: "hidden",
                                    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.12)",
                                }}
                            >
                                {/* 🖼 Hero image */}
                                <div
                                    style={{
                                        width: "100%",
                                        aspectRatio: "4 / 3",
                                        background: "#e5e7eb",
                                        overflow: "hidden",
                                    }}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={heroSrc}
                                        alt={meal.name}
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                            display: "block",
                                        }}
                                    />
                                </div>

                                {/* Card content */}
                                <div
                                    style={{
                                        padding: "1rem 1.25rem",
                                    }}
                                >
                                    <p
                                        style={{
                                            fontSize: "0.8rem",
                                            textTransform: "uppercase",
                                        }}
                                    >
                                        {meal.mealType}
                                    </p>
                                    <h2
                                        style={{
                                            margin: "0.25rem 0 0.5rem",
                                        }}
                                    >
                                        {meal.name}
                                    </h2>
                                    <p
                                        style={{
                                            fontSize: "0.9rem",
                                            marginBottom: "0.75rem",
                                        }}
                                    >
                                        {meal.description}
                                    </p>

                                    {/* High-level macros row */}
                                    <div
                                        style={{
                                            display: "flex",
                                            gap: "1rem",
                                            fontSize: "0.85rem",
                                            marginBottom: "0.75rem",
                                        }}
                                    >
                                        <span>🔥 {meal.macros.calories} kcal</span>
                                        <span>🥩 {meal.macros.protein}g protein</span>
                                        <span>🍚 {meal.macros.carbs}g carbs</span>
                                        <span>🫒 {meal.macros.fat}g fat</span>
                                    </div>

                                    <button
                                        onClick={() =>
                                            router.push(
                                                `/meals/${meal.id}?prompt=${encodeURIComponent(
                                                    displayedPrompt,
                                                )}`,
                                            )
                                        }
                                        style={{
                                            padding: "0.4rem 0.9rem",
                                            borderRadius: "999px",
                                            border: "1px solid #111827",
                                            fontSize: "0.85rem",
                                            marginBottom: 0,
                                            cursor: "pointer",
                                            background: "#ffffff",
                                        }}
                                    >
                                        View meal
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <button
                style={{
                    marginTop: "2rem",
                    padding: "0.5rem 1rem",
                    borderRadius: "999px",
                    border: "1px solid #d1d5db",
                    fontSize: "0.85rem",
                    background: "#f9fafb",
                    cursor: "pointer",
                }}
                onClick={() => router.push("/prompt")}
            >
                Back to prompt
            </button>
        </div>
    );
}
