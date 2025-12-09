"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import {
    FileText,
    Upload,
    Camera,
    ShieldCheck,
    X,
    Ban,
    FileSearch,
    Save,
    ArrowLeft,
    Users,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { UpgradePrompt } from "@/components/UpgradePrompt";

type DietRestrictionsParsed = {
    blockedIngredients: string[];
    blockedGroups: string[];
    summaryText: string;
};

function DietRestrictionsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const memberId = searchParams.get("member");
    const { showToast } = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<DietRestrictionsParsed | null>(null);
    const [saving, setSaving] = useState(false);
    const [consentChecked, setConsentChecked] = useState(false);

    // Premium check
    const [loadingUser, setLoadingUser] = useState(true);
    const [isPremium, setIsPremium] = useState(false);

    // Family member name (if uploading for a family member)
    const [memberName, setMemberName] = useState<string | null>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                router.push("/login");
                return;
            }

            try {
                const ref = doc(db, "users", firebaseUser.uid);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    setIsPremium(snap.data().isPremium ?? false);
                }

                // If we have a member ID, load their name
                if (memberId) {
                    const memberRef = doc(db, "users", firebaseUser.uid, "familyMembers", memberId);
                    const memberSnap = await getDoc(memberRef);
                    if (memberSnap.exists()) {
                        setMemberName(memberSnap.data().name || "Family Member");
                    }
                }
            } catch (err) {
                console.error("Error checking premium status", err);
            } finally {
                setLoadingUser(false);
            }
        });

        return () => unsub();
    }, [router, memberId]);

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
            if (!file || !previewUrl) {
                showToast("Please select a photo of your diet instructions first.", "error");
                return;
            }

            if (!consentChecked) {
                showToast("Please confirm the consent checkbox before continuing.", "error");
                return;
            }

            setLoading(true);

            const res = await fetch("/api/diet-restrictions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ imageDataUrl: previewUrl }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                const message = data?.error || "Failed to analyze diet instructions.";
                showToast(message, "error");
                setLoading(false);
                return;
            }

            const raw = await res.json();

            const parsed: DietRestrictionsParsed = {
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
            showToast("Something went wrong analyzing the instructions.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveToProfile = async () => {
        try {
            if (!result) {
                showToast("No parsed diet instructions to save.", "error");
                return;
            }

            const user = auth.currentUser;
            if (!user) {
                showToast("You must be signed in to save diet instructions.", "error");
                router.push("/account");
                return;
            }

            setSaving(true);

            const dietInstructionsData = {
                hasActiveNote: true,
                sourceType: "photo",
                summaryText: result.summaryText,
                blockedIngredients: result.blockedIngredients,
                blockedGroups: result.blockedGroups,
                updatedAt: serverTimestamp(),
            };

            if (memberId) {
                // Save to family member document
                const memberRef = doc(db, "users", user.uid, "familyMembers", memberId);
                await updateDoc(memberRef, {
                    doctorDietInstructions: dietInstructionsData,
                    updatedAt: serverTimestamp(),
                });
                showToast(`Diet instructions saved for ${memberName || "family member"}.`, "success");
            } else {
                // Save to user document
                const userRef = doc(db, "users", user.uid);
                await setDoc(
                    userRef,
                    { doctorDietInstructions: dietInstructionsData },
                    { merge: true }
                );
                showToast("Diet instructions saved to your profile.", "success");
            }
        } catch (err) {
            console.error(err);
            showToast("Failed to save diet instructions.", "error");
        } finally {
            setSaving(false);
        }
    };

    const clearFile = () => {
        setFile(null);
        setPreviewUrl(null);
        setResult(null);
    };

    // Loading state
    if (loadingUser) {
        return (
            <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-3 border-gray-200 border-t-[#4A90E2] rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-500">Loading...</p>
                </div>
            </div>
        );
    }

    // Premium paywall
    if (!isPremium) {
        return (
            <UpgradePrompt
                feature="diet_photo"
                variant="full_page"
                onClose={() => router.back()}
            />
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafb]">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 px-6 py-6">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-200 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${memberId ? "bg-purple-50" : "bg-blue-50"}`}>
                            {memberId ? (
                                <Users className="w-5 h-5 text-purple-500" />
                            ) : (
                                <FileText className="w-5 h-5 text-blue-500" />
                            )}
                        </div>
                        <div>
                            <h1 className="text-xl lg:text-2xl text-gray-900">
                                Diet Restrictions{memberName ? ` for ${memberName}` : ""}
                            </h1>
                            <p className="text-sm text-gray-500">
                                {memberId
                                    ? `Upload diet instructions for ${memberName || "family member"}`
                                    : "Upload your diet instructions"}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
                <div className="max-w-2xl mx-auto space-y-4">
                    {/* Upload Card */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#4A90E2]/10 rounded-xl flex items-center justify-center">
                                    <Upload className="w-5 h-5 text-[#4A90E2]" />
                                </div>
                                <div>
                                    <h2 className="font-medium text-gray-900">Upload Instructions</h2>
                                    <p className="text-xs text-gray-500">Photo or screenshot of your diet instructions</p>
                                </div>
                            </div>
                        </div>

                        <div className="px-5 py-4">
                            {!previewUrl ? (
                                <div className="space-y-4">
                                    <label
                                        htmlFor="file-upload"
                                        className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-[#4A90E2]/50 hover:bg-[#4A90E2]/5 transition-colors"
                                    >
                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                            <Upload className="w-6 h-6 text-gray-400" />
                                        </div>
                                        <span className="text-sm font-medium text-gray-900 mb-1">
                                            Click to upload
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            PNG, JPG up to 10MB
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

                                    <div className="flex items-center gap-2 text-xs text-gray-500">
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
                                            I understand this feature is for personal meal filtering only
                                            and results should be verified for accuracy.
                                        </label>
                                    </div>

                                    {/* Analyze Button */}
                                    <button
                                        onClick={handleAnalyze}
                                        disabled={!file || loading || !consentChecked}
                                        className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Analyzing...</span>
                                            </>
                                        ) : (
                                            <>
                                                <FileSearch className="w-5 h-5" />
                                                <span>Analyze Instructions</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Results */}
                    {result && (
                        <>
                            {/* Summary Card */}
                            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                <div className="px-5 py-4 border-b border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                                            <ShieldCheck className="w-5 h-5 text-emerald-500" />
                                        </div>
                                        <div>
                                            <h2 className="font-medium text-gray-900">Analysis Complete</h2>
                                            <p className="text-xs text-gray-500">Review your extracted diet restrictions</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="px-5 py-4 space-y-4">
                                    {result.summaryText && (
                                        <div className="p-4 bg-gray-50 rounded-xl">
                                            <p className="text-sm text-gray-700">{result.summaryText}</p>
                                        </div>
                                    )}

                                    {/* Blocked Ingredients */}
                                    <div>
                                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                                            <Ban className="w-3.5 h-3.5 text-red-500" />
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
                                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                                            <Ban className="w-3.5 h-3.5 text-orange-500" />
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

                                    {/* Save Button */}
                                    <button
                                        onClick={handleSaveToProfile}
                                        disabled={saving}
                                        className={`w-full py-3 text-white rounded-xl font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${memberId ? "bg-purple-500 hover:bg-purple-600" : "bg-emerald-500 hover:bg-emerald-600"}`}
                                    >
                                        {saving ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-5 h-5" />
                                                <span>{memberId ? `Save for ${memberName || "Family Member"}` : "Save to My Profile"}</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* How it works Card */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100">
                            <h2 className="font-medium text-gray-900">How it works</h2>
                        </div>
                        <div className="px-5 py-4">
                            <ul className="space-y-3">
                                {[
                                    "Upload a photo of your diet instructions",
                                    "Our AI extracts foods and groups to avoid",
                                    "Save to your profile to filter future meal suggestions",
                                    "Meals will automatically exclude blocked items",
                                ].map((step, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium text-gray-600">
                                            {i + 1}
                                        </div>
                                        <span className="text-sm text-gray-600">{step}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Disclaimer */}
                    <div className="flex items-start gap-2 px-1 pb-6">
                        <ShieldCheck className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-gray-400">
                            This feature is for personal meal filtering only. Always verify
                            extracted restrictions for accuracy.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function DietRestrictionsPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-10 h-10 border-3 border-gray-200 border-t-[#4A90E2] rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-gray-500">Loading...</p>
                    </div>
                </div>
            }
        >
            <DietRestrictionsContent />
        </Suspense>
    );
}