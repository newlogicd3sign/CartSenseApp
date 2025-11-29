// app/(app)/doctor-note/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

type DoctorNoteParsed = {
    blockedIngredients: string[];
    blockedGroups: string[];
    summaryText: string;
};

export default function DoctorNotePage() {
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<DoctorNoteParsed | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [consentChecked, setConsentChecked] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) {
            setFile(null);
            setPreviewUrl(null);
            setResult(null);
            return;
        }
        setFile(f);
        setResult(null);
        setError(null);

        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") {
                setPreviewUrl(reader.result);
            }
        };
        reader.readAsDataURL(f);
    };

    const handleAnalyze = async () => {
        try {
            setError(null);
            setSaveMessage(null);

            if (!file || !previewUrl) {
                setError("Please select a photo of your diet instructions first.");
                return;
            }

            if (!consentChecked) {
                setError("Please confirm the consent checkbox before continuing.");
                return;
            }

            setLoading(true);

            const res = await fetch("/api/doctor-note", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ imageDataUrl: previewUrl }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                const message = data?.error || "Failed to analyze diet instructions.";
                setError(message);
                setLoading(false);
                return;
            }

            const raw = await res.json();

            // Normalize API response to our shape
            const parsed: DoctorNoteParsed = {
                blockedIngredients: raw.blockedIngredients ?? [],
                blockedGroups:
                    raw.blockedGroups ??
                    raw.blockedFoodGroups ?? // backward compatibility
                    [],
                summaryText:
                    raw.summaryText ??
                    raw.instructionsSummary ?? // backward compatibility
                    "",
            };

            setResult(parsed);
        } catch (err) {
            console.error(err);
            setError("Something went wrong analyzing the note.");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveToProfile = async () => {
        try {
            setError(null);
            setSaveMessage(null);

            if (!result) {
                setError("No parsed diet instructions to save.");
                return;
            }

            const user = auth.currentUser;
            if (!user) {
                setError("You must be signed in to save diet instructions.");
                router.push("/account");
                return;
            }

            setSaving(true);

            const userRef = doc(db, "users", user.uid);

            await setDoc(
                userRef,
                {
                    doctorDietInstructions: {
                        hasActiveNote: true,
                        sourceType: "photo",
                        summaryText: result.summaryText,
                        blockedIngredients: result.blockedIngredients,
                        blockedGroups: result.blockedGroups,
                        updatedAt: serverTimestamp(),
                    },
                },
                { merge: true },
            );

            setSaveMessage("Diet instructions saved to your profile.");
        } catch (err) {
            console.error(err);
            setError("Failed to save diet instructions.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
            <header className="space-y-2">
                <h1 className="text-2xl font-semibold">Diet Instructions</h1>
                <p className="text-sm text-gray-500">
                    Upload a photo of your doctor’s diet instructions. CartSense will extract
                    foods to avoid and use them to help block future meal suggestions. This
                    feature is for personal wellness only and does not provide medical advice.
                </p>
            </header>

            <section className="space-y-4">
                <div className="flex flex-col gap-3">
                    <label className="text-sm font-medium">
                        Upload diet instructions (photo or screenshot)
                    </label>

                    <input
                        type="file"
                        accept="image/*"
                        // This tells many mobile browsers "use the camera" as the default
                        capture="environment"
                        onChange={handleFileChange}
                        className="block w-full text-sm"
                    />

                    {previewUrl && (
                        <div className="relative mt-2 h-64 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={previewUrl}
                                alt="Diet instructions preview"
                                className="h-full w-full object-contain"
                            />
                        </div>
                    )}

                    <div className="mt-3 flex items-start gap-2">
                        <input
                            id="diet-consent"
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-gray-300"
                            checked={consentChecked}
                            onChange={(e) => setConsentChecked(e.target.checked)}
                        />
                        <label
                            htmlFor="diet-consent"
                            className="text-xs text-gray-600 leading-tight"
                        >
                            I understand that CartSense is not a medical provider and this
                            feature is for personal meal filtering only. I won’t use this
                            app as a substitute for professional medical advice, diagnosis,
                            or treatment.
                        </label>
                    </div>

                    <button
                        type="button"
                        onClick={handleAnalyze}
                        disabled={!file || loading || !consentChecked}
                        className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading ? "Analyzing..." : "Analyze diet instructions"}
                    </button>
                </div>
            </section>

            {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-md">
                    {error}
                </p>
            )}

            {result && (
                <section className="space-y-4 border-t border-gray-100 pt-4">
                    <h2 className="text-lg font-semibold">Parsed diet instructions</h2>

                    <div className="space-y-3">
                        <div>
                            <h3 className="text-sm font-medium">Blocked ingredients</h3>
                            {result.blockedIngredients.length === 0 ? (
                                <p className="text-sm text-gray-500">
                                    No specific ingredients identified.
                                </p>
                            ) : (
                                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                                    {result.blockedIngredients.map((item) => (
                                        <li key={item}>{item}</li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div>
                            <h3 className="text-sm font-medium">
                                Blocked food groups / patterns
                            </h3>
                            {result.blockedGroups.length === 0 ? (
                                <p className="text-sm text-gray-500">
                                    No broad food groups identified.
                                </p>
                            ) : (
                                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                                    {result.blockedGroups.map((item) => (
                                        <li key={item}>{item}</li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div>
                            <h3 className="text-sm font-medium">Summary from note</h3>
                            <p className="mt-1 text-sm text-gray-700">
                                {result.summaryText || "No summary provided."}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleSaveToProfile}
                            disabled={saving}
                            className="inline-flex items-center justify-center rounded-md border border-transparent bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {saving ? "Saving..." : "Save diet instructions"}
                        </button>
                        {saveMessage && (
                            <p className="text-xs text-emerald-700">{saveMessage}</p>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}
