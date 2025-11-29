"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { logUserEvent } from "@/lib/logUserEvent";

type MealsMeta = {
    usedDoctorInstructions?: boolean;
    blockedIngredientsFromDoctor?: string[];
    blockedGroupsFromDoctor?: string[];
};

type MealsApiResponse = {
    meals?: any[];
    meta?: MealsMeta;
    error?: string;
    message?: string;
};

export default function PromptPage() {
    const router = useRouter();

    const [user, setUser] = useState<User | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [name, setName] = useState("");
    const [userPrefs, setUserPrefs] = useState<any>(null);

    const [prompt, setPrompt] = useState("");
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                router.push("/login");
            } else {
                setUser(firebaseUser);

                // Load their preferences (name, diet, allergies, sensitivities)
                const ref = doc(db, "users", firebaseUser.uid);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data();
                    setName(data.name || "");
                    setUserPrefs(data);
                }
            }
            setLoadingUser(false);
        });

        return () => unsub();
    }, [router]);

    const handleSubmit = async () => {
        const trimmed = prompt.trim();

        if (!trimmed) {
            setMessage("Please enter what kind of meals you want.");
            return;
        }

        if (!user) {
            setMessage("Please log in again to generate meals.");
            return;
        }

        setMessage("");
        setSubmitting(true);

        try {
            const res = await fetch("/api/meals", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    prompt: trimmed,
                    prefs: userPrefs, // name, dietType, allergies, sensitivities
                    uid: user.uid, // 🔹 used on the server for learning profile & doctor note
                }),
            });

            const data = (await res.json()) as MealsApiResponse;

            if (!res.ok) {
                if (
                    data?.error === "NOT_FOOD_REQUEST" ||
                    data?.error === "OUT_OF_DOMAIN"
                ) {
                    // Use the friendly message from the API if present
                    setMessage(
                        data.message ||
                        "CartSense can only help with meals, recipes, nutrition and grocery planning. Try something like “heart-healthy dinners with chicken” or “high-protein lunches under 600 calories”.",
                    );

                    // Reset the text field so they start fresh
                    setPrompt("");
                } else {
                    // Generic error
                    setMessage(
                        data.error || data.message || "Failed to generate meals.",
                    );
                }

                return;
            }

            // data.meals is the array returned by /api/meals
            const meals = data.meals || [];

            // 💾 Store meals + meta in sessionStorage
            // (old code stored just the array; now we store an object)
            const payloadToStore = {
                meals,
                meta: data.meta,
            };

            sessionStorage.setItem(
                "generatedMeals",
                JSON.stringify(payloadToStore),
            );

            // 🔹 Learning: log prompt_submitted (non-blocking)
            logUserEvent(user.uid, {
                type: "prompt_submitted",
                prompt: trimmed,
                // we can later add usedDoctorInstructions: data.meta?.usedDoctorInstructions
            }).catch((err) => {
                console.error("Failed to log prompt_submitted event:", err);
            });

            // Only pass the prompt in the URL (for display on /meals)
            router.push(`/meals?prompt=${encodeURIComponent(trimmed)}`);
        } catch (err: any) {
            console.error(err);
            setMessage("Error connecting to meals API");
        } finally {
            setSubmitting(false);
        }
    };

    if (loadingUser) {
        return (
            <div style={{ padding: "2rem" }}>
                <p>Loading…</p>
            </div>
        );
    }

    return (
        <div style={{ padding: "2rem", maxWidth: 600, position: "relative" }}>
            <h1>Hello {name ? name : "there"} 👋</h1>

            <p style={{ marginTop: "0.5rem" }}>
                What kind of meals do you want CartSense to create for you
                today?
            </p>

            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: Give me heart-healthy meals with chicken, low sodium, easy to cook…"
                style={{
                    width: "100%",
                    height: "120px",
                    padding: "0.75rem",
                    marginTop: "1rem",
                    fontSize: "16px",
                }}
                disabled={submitting}
            />

            <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                    marginTop: "1rem",
                    padding: "0.75rem 1rem",
                    opacity: submitting ? 0.7 : 1,
                    cursor: submitting ? "default" : "pointer",
                }}
            >
                {submitting ? "Generating…" : "Generate Meals"}
            </button>

            {message && (
                <p
                    style={{
                        marginTop: "1rem",
                        color: "red",
                        whiteSpace: "pre-line",
                    }}
                >
                    {message}
                </p>
            )}

            {/* Simple loading overlay with a wheel */}
            {submitting && (
                <>
                    <div
                        style={{
                            position: "fixed",
                            inset: 0,
                            background: "rgba(0,0,0,0.2)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 50,
                        }}
                    >
                        <div style={{ textAlign: "center" }}>
                            <div
                                style={{
                                    width: "40px",
                                    height: "40px",
                                    borderRadius: "50%",
                                    border: "4px solid #e5e7eb",
                                    borderTopColor: "#111827",
                                    margin: "0 auto 0.75rem",
                                    animation: "spin 0.9s linear infinite",
                                }}
                            />
                            <p>Generating meals for you…</p>
                        </div>
                    </div>

                    {/* Inline keyframes for the spinner */}
                    <style jsx>{`
                        @keyframes spin {
                            from {
                                transform: rotate(0deg);
                            }
                            to {
                                transform: rotate(360deg);
                            }
                        }
                    `}</style>
                </>
            )}
        </div>
    );
}
