"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import {
    ShoppingCart,
    User as UserIcon,
    Heart,
    AlertTriangle,
    ArrowRight,
    AlertCircle,
    Sparkles,
} from "lucide-react";

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

const DIET_OPTIONS = [
    { value: "heart_healthy", label: "Heart healthy" },
    { value: "low_sodium", label: "Low sodium" },
    { value: "high_protein", label: "High protein" },
    { value: "low_saturated_fat", label: "Low saturated fat" },
    { value: "general_healthy", label: "General healthy eating" },
];

export default function SetupPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const [step, setStep] = useState(1);
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

            router.push("/prompt");
        } catch (err: any) {
            setMessage(err.message || "Failed to save");
            setSaving(false);
        }
    };

    const handleSkip = () => {
        router.push("/prompt");
    };

    const nextStep = () => {
        if (step < 3) setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-3 border-gray-200 border-t-[#4A90E2] rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-500">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafb]">
            {/* Header */}
            <div className="bg-gradient-to-br from-[#4A90E2] to-[#357ABD] px-6 pt-10 pb-14">
                <div className="max-w-[428px] mx-auto">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                            <ShoppingCart className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-2xl font-medium text-white">CartSense</span>
                    </div>
                    <h1 className="text-2xl font-medium text-white mb-2">
                        Let's personalize your experience
                    </h1>
                    <p className="text-white/80">
                        Help us tailor meal suggestions to your preferences.
                    </p>

                    {/* Progress Steps */}
                    <div className="flex items-center gap-2 mt-6">
                        {[1, 2, 3].map((s) => (
                            <div
                                key={s}
                                className={`h-1.5 flex-1 rounded-full transition-colors ${
                                    s <= step ? "bg-white" : "bg-white/30"
                                }`}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="px-6 -mt-6">
                <div className="max-w-[428px] mx-auto">
                    <form onSubmit={handleSubmit}>
                        <div className="bg-white rounded-2xl shadow-lg p-6 min-h-[340px]">
                            {/* Step 1: Name & Diet */}
                            {step === 1 && (
                                <div className="space-y-5">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-[#4A90E2]/10 rounded-xl flex items-center justify-center">
                                            <UserIcon className="w-5 h-5 text-[#4A90E2]" />
                                        </div>
                                        <div>
                                            <h2 className="font-medium text-gray-900">About You</h2>
                                            <p className="text-xs text-gray-500">Basic information</p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Your Name
                                        </label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Enter your name"
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#4A90E2] focus:outline-none transition-colors"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Diet Focus
                                        </label>
                                        <select
                                            value={dietType}
                                            onChange={(e) => setDietType(e.target.value)}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:border-[#4A90E2] focus:outline-none transition-colors"
                                        >
                                            <option value="">Select your diet focus...</option>
                                            {DIET_OPTIONS.map((opt) => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Allergies */}
                            {step === 2 && (
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                                            <AlertTriangle className="w-5 h-5 text-red-500" />
                                        </div>
                                        <div>
                                            <h2 className="font-medium text-gray-900">Allergies</h2>
                                            <p className="text-xs text-gray-500">Select any that apply</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {ALLERGY_OPTIONS.map((item) => (
                                            <button
                                                key={item}
                                                type="button"
                                                onClick={() => toggleAllergy(item)}
                                                className={`px-4 py-2 rounded-xl text-sm transition-all ${
                                                    selectedAllergies.includes(item)
                                                        ? "bg-red-500 text-white"
                                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                }`}
                                            >
                                                {item}
                                            </button>
                                        ))}
                                    </div>

                                    {selectedAllergies.length === 0 && (
                                        <p className="text-sm text-gray-400 mt-4">
                                            No allergies? Just tap Continue.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Step 3: Sensitivities */}
                            {step === 3 && (
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                                            <Heart className="w-5 h-5 text-orange-500" />
                                        </div>
                                        <div>
                                            <h2 className="font-medium text-gray-900">Sensitivities</h2>
                                            <p className="text-xs text-gray-500">Foods to avoid or limit</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {SENSITIVITY_OPTIONS.map((item) => (
                                            <button
                                                key={item}
                                                type="button"
                                                onClick={() => toggleSensitivity(item)}
                                                className={`px-4 py-2 rounded-xl text-sm transition-all ${
                                                    selectedSensitivities.includes(item)
                                                        ? "bg-orange-500 text-white"
                                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                }`}
                                            >
                                                {item}
                                            </button>
                                        ))}
                                    </div>

                                    {selectedSensitivities.length === 0 && (
                                        <p className="text-sm text-gray-400 mt-4">
                                            No sensitivities? Just tap Finish Setup.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Error Message */}
                        {message && (
                            <div className="flex items-start gap-2 mt-4 p-3 bg-red-50 border border-red-100 rounded-xl">
                                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-600">{message}</p>
                            </div>
                        )}

                        {/* Navigation Buttons */}
                        <div className="mt-4 space-y-3">
                            {step < 3 ? (
                                <button
                                    type="button"
                                    onClick={nextStep}
                                    className="w-full py-4 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <span>Continue</span>
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="w-full py-4 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-5 h-5" />
                                            <span>Finish Setup</span>
                                        </>
                                    )}
                                </button>
                            )}

                            <div className="flex gap-3">
                                {step > 1 && (
                                    <button
                                        type="button"
                                        onClick={prevStep}
                                        className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                                    >
                                        Back
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleSkip}
                                    className={`${step > 1 ? "flex-1" : "w-full"} py-3 bg-white border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 transition-colors`}
                                >
                                    Skip for now
                                </button>
                            </div>
                        </div>
                    </form>

                    {/* Info Text */}
                    <p className="text-center text-sm text-gray-400 mt-6 px-4 pb-6">
                        You can always update these preferences later in your account settings.
                    </p>
                </div>
            </div>
        </div>
    );
}
