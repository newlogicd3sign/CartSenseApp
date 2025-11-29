"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

const ALLERGY_OPTIONS = [
    "Dairy",
    "Eggs",
    "Fish",
    "Shellfish",
    "Peanuts",
    "Tree Nuts",
    "Wheat / Gluten",
    "Soy",
    "Sesame",
];

const SENSITIVITY_OPTIONS = [
    "Lactose",
    "Gluten sensitivity",
    "Artificial sweeteners",
    "Added sugars",
    "High-sodium foods",
    "Spicy foods",
    "Red meat",
    "Corn syrup",
    "MSG",
];

export default function SetupPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const [name, setName] = useState("");
    const [dietType, setDietType] = useState("");
    const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
    const [selectedSensitivities, setSelectedSensitivities] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (firebaseUser) => {
            if (!firebaseUser) {
                router.push("/login");
            } else {
                setUser(firebaseUser);
            }
            setLoading(false);
        });

        return () => unsub();
    }, [router]);

    const toggleAllergy = (item: string) => {
        setSelectedAllergies((prev) =>
            prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
        );
    };

    const toggleSensitivity = (item: string) => {
        setSelectedSensitivities((prev) =>
            prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
        );
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setSaving(true);
        setMessage(null);

        try {
            await setDoc(
                doc(db, "users", user.uid),
                {
                    name: name.trim(),
                    dietType,
                    allergiesAndSensitivities: {
                        allergies: selectedAllergies,
                        sensitivities: selectedSensitivities,
                    },
                },
                { merge: true }
            );

            // Go straight to prompt after saving
            router.push("/prompt");
        } catch (err: any) {
            setMessage(err.message || "Failed to save");
            setSaving(false);
        }
    };

    const handleSkip = () => {
        // Just go to prompt without saving anything
        router.push("/prompt");
    };

    if (loading) return <div style={{ padding: "2rem" }}>Loading…</div>;

    return (
        <div style={{ padding: "2rem", maxWidth: 600 }}>
            <h1>CartSense Setup</h1>
            <p style={{ marginTop: "0.5rem" }}>
                Tell us a little about you so we can personalize your meals.
                You can also skip this and set it up later.
            </p>

            <form onSubmit={handleSubmit} style={{ marginTop: "1.5rem" }}>
                {/* Name */}
                <div style={{ marginBottom: "1.5rem" }}>
                    <label><strong>Your Name</strong></label><br />
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Nicholas"
                        style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
                    />
                </div>

                {/* Diet */}
                <div style={{ marginBottom: "1.5rem" }}>
                    <label><strong>Diet focus</strong></label><br />
                    <select
                        value={dietType}
                        onChange={(e) => setDietType(e.target.value)}
                        style={{ width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
                    >
                        <option value="">Select…</option>
                        <option value="heart_healthy">Heart healthy</option>
                        <option value="low_sodium">Low sodium</option>
                        <option value="high_protein">High protein</option>
                        <option value="low_saturated_fat">Low saturated fat</option>
                        <option value="general_healthy">General healthy eating</option>
                    </select>
                </div>

                {/* Allergies */}
                <div style={{ marginBottom: "1.5rem" }}>
                    <label><strong>Allergies</strong></label>
                    <div style={{ marginTop: "0.5rem" }}>
                        {ALLERGY_OPTIONS.map((item) => (
                            <label key={item} style={{ display: "block", marginBottom: "0.4rem" }}>
                                <input
                                    type="checkbox"
                                    checked={selectedAllergies.includes(item)}
                                    onChange={() => toggleAllergy(item)}
                                />{" "}
                                {item}
                            </label>
                        ))}
                    </div>
                </div>

                {/* Sensitivities */}
                <div style={{ marginBottom: "1.5rem" }}>
                    <label><strong>Sensitivities</strong></label>
                    <div style={{ marginTop: "0.5rem" }}>
                        {SENSITIVITY_OPTIONS.map((item) => (
                            <label key={item} style={{ display: "block", marginBottom: "0.4rem" }}>
                                <input
                                    type="checkbox"
                                    checked={selectedSensitivities.includes(item)}
                                    onChange={() => toggleSensitivity(item)}
                                />{" "}
                                {item}
                            </label>
                        ))}
                    </div>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                    <button
                        type="submit"
                        disabled={saving}
                        style={{ padding: "0.5rem 1rem" }}
                    >
                        {saving ? "Saving…" : "Save & continue"}
                    </button>

                    <button
                        type="button"
                        onClick={handleSkip}
                        style={{ padding: "0.5rem 1rem", background: "transparent", border: "1px solid #ccc" }}
                    >
                        Skip for now
                    </button>
                </div>
            </form>

            {message && (
                <p style={{ marginTop: "1rem" }}>{message}</p>
            )}
        </div>
    );
}
