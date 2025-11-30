"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import {
    FileText,
    Upload,
    Camera,
    CheckCircle,
    AlertCircle,
    ShieldCheck,
    X,
    Ban,
    FileSearch,
    Save,
} from "lucide-react";

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

            const parsed: DoctorNoteParsed = {
                blockedIngredients: raw.blockedIngredients ?? [],
                blockedGroups:
                    raw.blockedGroups ??
                    raw.blockedFoodGroups ??
                    [],
                summaryText:
                    raw.summaryText ??
                    raw.instructionsSummary ??
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
                { merge: true }
            );

            setSaveMessage("Diet instructions saved to your profile.");
        } catch (err) {
            console.error(err);
            setError("Failed to save diet instructions.");
        } finally {
            setSaving(false);
        }
    };

    const clearFile = () => {
        setFile(null);
        setPreviewUrl(null);
        setResult(null);
        setError(null);
        setSaveMessage(null);
    };

    return (
        <div className="min-h-screen bg-[#f8fafb]">
            {/* Header */}
            <div className="bg-gradient-to-br from-[#4A90E2] to-[#357ABD] px-6 pt-8 pb-12 lg:pt-12 lg:pb-16">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                            <FileText className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-white/80 text-sm font-medium">Health Support</span>
                    </div>
                    <h1 className="text-2xl lg:text-3xl font-medium text-white mb-2">
                        Diet Instructions
                    </h1>
                    <p className="text-white/80 text-base">
                        Upload your doctor's diet instructions to help filter meal suggestions.
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="px-6 -mt-6">
                <div className="max-w-2xl mx-auto space-y-6">
                    {/* Upload Card */}
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        {!previewUrl ? (
                            <div className="space-y-4">
                                <label
                                    htmlFor="file-upload"
                                    className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-[#4A90E2]/50 hover:bg-[#4A90E2]/5 transition-colors"
                                >
                                    <div className="w-12 h-12 bg-[#4A90E2]/10 rounded-full flex items-center justify-center mb-3">
                                        <Upload className="w-6 h-6 text-[#4A90E2]" />
                                    </div>
                                    <span className="text-sm font-medium text-gray-900 mb-1">
                                        Upload diet instructions
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        Photo or screenshot (PNG, JPG)
                                    </span>
                                </label>
                                <input
                                    id="file-upload"
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />

                                <div className="flex items-center gap-3 text-sm text-gray-500">
                                    <Camera className="w-4 h-4" />
                                    <span>On mobile, you can use your camera directly</span>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="relative">
                                    <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-100">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={previewUrl}
                                            alt="Diet instructions preview"
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                    <button
                                        onClick={clearFile}
                                        className="absolute top-2 right-2 w-8 h-8 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Consent Checkbox */}
                                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                                    <input
                                        id="diet-consent"
                                        type="checkbox"
                                        checked={consentChecked}
                                        onChange={(e) => setConsentChecked(e.target.checked)}
                                        className="mt-1 h-4 w-4 rounded border-gray-300 text-[#4A90E2] focus:ring-[#4A90E2]"
                                    />
                                    <label
                                        htmlFor="diet-consent"
                                        className="text-xs text-gray-600 leading-relaxed"
                                    >
                                        I understand that CartSense is not a medical provider and this
                                        feature is for personal meal filtering only. I won't use this
                                        app as a substitute for professional medical advice, diagnosis,
                                        or treatment.
                                    </label>
                                </div>

                                {/* Analyze Button */}
                                <button
                                    onClick={handleAnalyze}
                                    disabled={!file || loading || !consentChecked}
                                    className="w-full py-4 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Analyzing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <FileSearch className="w-5 h-5" />
                                            <span>Analyze Diet Instructions</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-100 rounded-xl">
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    {/* Results */}
                    {result && (
                        <div className="space-y-4">
                            {/* Summary Card */}
                            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                                    <h3 className="font-medium text-gray-900">Analysis Complete</h3>
                                </div>

                                {result.summaryText && (
                                    <div className="p-4 bg-[#4A90E2]/5 border border-[#4A90E2]/20 rounded-xl mb-4">
                                        <p className="text-sm text-gray-700">{result.summaryText}</p>
                                    </div>
                                )}

                                {/* Blocked Ingredients */}
                                <div className="mb-4">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                        <Ban className="w-4 h-4 text-red-500" />
                                        Blocked Ingredients
                                    </h4>
                                    {result.blockedIngredients.length === 0 ? (
                                        <p className="text-sm text-gray-500">
                                            No specific ingredients identified.
                                        </p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {result.blockedIngredients.map((item) => (
                                                <span
                                                    key={item}
                                                    className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm"
                                                >
                                                    {item}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Blocked Food Groups */}
                                <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                        <Ban className="w-4 h-4 text-orange-500" />
                                        Blocked Food Groups
                                    </h4>
                                    {result.blockedGroups.length === 0 ? (
                                        <p className="text-sm text-gray-500">
                                            No broad food groups identified.
                                        </p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {result.blockedGroups.map((item) => (
                                                <span
                                                    key={item}
                                                    className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-sm"
                                                >
                                                    {item}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Save Button */}
                            <button
                                onClick={handleSaveToProfile}
                                disabled={saving}
                                className="w-full py-4 bg-emerald-500 text-white rounded-2xl shadow-lg hover:bg-emerald-600 transition-colors active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        <span>Save to My Profile</span>
                                    </>
                                )}
                            </button>

                            {/* Save Success Message */}
                            {saveMessage && (
                                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                                    <span className="text-sm text-emerald-700">{saveMessage}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Info Card */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <h3 className="font-medium text-gray-900 mb-3">How it works</h3>
                        <ul className="space-y-3">
                            {[
                                "Upload a photo of your doctor's diet instructions",
                                "Our AI extracts foods and groups to avoid",
                                "Save to your profile to filter future meal suggestions",
                                "Meals will automatically exclude blocked items",
                            ].map((step, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-[#4A90E2]/10 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium text-[#4A90E2]">
                                        {i + 1}
                                    </div>
                                    <span className="text-sm text-gray-600">{step}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Disclaimer */}
                    <div className="flex items-start gap-2 px-1 pb-6">
                        <ShieldCheck className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-gray-400">
                            This feature is for personal wellness only and does not constitute
                            medical advice. Always consult with your healthcare provider.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
