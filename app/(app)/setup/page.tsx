"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { ArrowRight, AlertCircle } from "lucide-react";
import Image from "next/image";
import CartSenseLogo from "@/app/CartSenseLogo.svg";
import { getRandomAccentColor, type AccentColor } from "@/lib/utils";

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
    const [accentColor, setAccentColor] = useState<AccentColor>({ primary: "#3b82f6", dark: "#2563eb" });

    useEffect(() => {
        setAccentColor(getRandomAccentColor());
    }, []);

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

            sessionStorage.setItem("animateEntry", "true");
            router.push("/prompt");
        } catch (err: any) {
            setMessage(err.message || "Failed to save");
            setSaving(false);
        }
    };

    const handleSkip = () => {
        sessionStorage.setItem("animateEntry", "true");
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
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            <div className="px-6 pt-12 pb-8">
                <div className="max-w-[428px] mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <Image src={CartSenseLogo} alt="CartSense" className="h-8 w-auto mb-8" />
                        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                            Personalize your experience
                        </h1>
                        <p className="text-gray-500">
                            Help us tailor meal suggestions to your preferences.
                        </p>
                    </div>

                    {/* Progress Steps */}
                    <div className="flex items-center gap-2 mb-8">
                        {[1, 2, 3].map((s) => (
                            <div
                                key={s}
                                className={`h-1 flex-1 rounded-full transition-colors ${
                                    s <= step ? "bg-gray-900" : "bg-gray-200"
                                }`}
                            />
                        ))}
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="min-h-[320px]">
                            {/* Step 1: Name & Diet */}
                            {step === 1 && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="font-medium text-gray-900 mb-1">About You</h2>
                                        <p className="text-sm text-gray-500">Basic information</p>
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
                                            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-colors"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Diet Focus
                                        </label>
                                        <select
                                            value={dietType}
                                            onChange={(e) => setDietType(e.target.value)}
                                            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-colors"
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
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="font-medium text-gray-900 mb-1">Allergies</h2>
                                        <p className="text-sm text-gray-500">Select any that apply</p>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {ALLERGY_OPTIONS.map((item) => (
                                            <button
                                                key={item}
                                                type="button"
                                                onClick={() => toggleAllergy(item)}
                                                className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                                                    selectedAllergies.includes(item)
                                                        ? "bg-gray-900 text-white"
                                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                }`}
                                            >
                                                {item}
                                            </button>
                                        ))}
                                    </div>

                                    {selectedAllergies.length === 0 && (
                                        <p className="text-sm text-gray-400">
                                            No allergies? Just tap Continue.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Step 3: Sensitivities */}
                            {step === 3 && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="font-medium text-gray-900 mb-1">Sensitivities</h2>
                                        <p className="text-sm text-gray-500">Foods to avoid or limit</p>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {SENSITIVITY_OPTIONS.map((item) => (
                                            <button
                                                key={item}
                                                type="button"
                                                onClick={() => toggleSensitivity(item)}
                                                className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                                                    selectedSensitivities.includes(item)
                                                        ? "bg-gray-900 text-white"
                                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                }`}
                                            >
                                                {item}
                                            </button>
                                        ))}
                                    </div>

                                    {selectedSensitivities.length === 0 && (
                                        <p className="text-sm text-gray-400">
                                            No sensitivities? Just tap Finish Setup.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Error Message */}
                        {message && (
                            <div className="flex items-start gap-2 mt-6 p-3 bg-red-50 rounded-lg">
                                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-600">{message}</p>
                            </div>
                        )}

                        {/* Navigation Buttons */}
                        <div className="mt-8 space-y-3">
                            {step < 3 ? (
                                <button
                                    type="button"
                                    onClick={nextStep}
                                    className="w-full py-3.5 text-white rounded-xl font-medium hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                    style={{ background: `linear-gradient(to right, ${accentColor.primary}, ${accentColor.dark})` }}
                                >
                                    <span>Continue</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="w-full py-3.5 text-white rounded-xl font-medium hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    style={{ background: `linear-gradient(to right, ${accentColor.primary}, ${accentColor.dark})` }}
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <span>Finish Setup</span>
                                    )}
                                </button>
                            )}

                            <div className="flex gap-3">
                                {step > 1 && (
                                    <button
                                        type="button"
                                        onClick={prevStep}
                                        className="flex-1 py-3 text-gray-600 font-medium hover:text-gray-900 transition-colors"
                                    >
                                        Back
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleSkip}
                                    className={`${step > 1 ? "flex-1" : "w-full"} py-3 text-gray-400 font-medium hover:text-gray-600 transition-colors`}
                                >
                                    Skip for now
                                </button>
                            </div>
                        </div>
                    </form>

                    {/* Info Text */}
                    <p className="text-center text-sm text-gray-400 mt-8">
                        You can always update these preferences later in settings.
                    </p>
                </div>
            </div>
        </div>
    );
}
