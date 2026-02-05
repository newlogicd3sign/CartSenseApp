"use client";

import { Suspense, useEffect, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Browser } from "@capacitor/browser";
import { auth, db } from "@/lib/firebaseClient";

// Check if running in Capacitor
const isCapacitor = () => {
    if (typeof window === "undefined") return false;
    return (window as any).Capacitor?.isNativePlatform?.() ?? false;
};
import { authFetch } from "@/lib/authFetch";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, setDoc, getDoc, collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { ArrowRight, AlertCircle, ShoppingCart, MapPin, CheckCircle, ExternalLink, Search, Store } from "lucide-react";
import Image from "next/image";
import CartSenseLogo from "@/app/CartSenseLogo.svg";
import InstacartCarrot from "@/app/🥕 Instacart Logos/Logos - Carrot/RGB/PNG/Instacart_Carrot.png";
import { getRandomAccentColor, getStoreBrand, type AccentColor } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { warmLocationInBackground } from "@/lib/product-engine/krogerWarm";

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

const COMMON_DISLIKED_FOODS = [
    "Cilantro",
    "Mushrooms",
    "Olives",
    "Anchovies",
    "Blue cheese",
    "Liver",
    "Brussels sprouts",
    "Beets",
    "Eggplant",
    "Tofu",
    "Coconut",
    "Pickles",
];

const DIET_OPTIONS = [
    { value: "general_healthy", label: "General healthy eating" },
    { value: "vegetarian", label: "Vegetarian" },
    { value: "vegan", label: "Vegan" },
    { value: "keto", label: "Keto / Low carb" },
    { value: "paleo", label: "Paleo" },
    { value: "mediterranean", label: "Mediterranean" },
    { value: "pescatarian", label: "Pescatarian" },
    { value: "high_protein", label: "High protein" },
    { value: "low_sodium", label: "Low sodium" },
    { value: "heart_healthy", label: "Heart healthy" },
    { value: "diabetic_friendly", label: "Diabetic friendly" },
    { value: "whole30", label: "Whole30" },
    { value: "gluten_free", label: "Gluten free" },
    { value: "dairy_free", label: "Dairy free" },
];

const COOKING_EXPERIENCE_OPTIONS = [
    { value: "beginner", label: "Beginner", description: "New to cooking, prefer simple recipes" },
    { value: "intermediate", label: "Intermediate", description: "Comfortable with most recipes" },
    { value: "advanced", label: "Advanced", description: "Enjoy complex techniques and recipes" },
];

type KrogerLocationSearchResult = {
    locationId: string;
    name: string;
    addressLine1: string;
    city: string;
    state: string;
    zipCode: string;
};

type InstacartRetailer = {
    retailer_key: string;
    name: string;
    retailer_logo_url: string;
};

const SHOPPING_PREFERENCE_OPTIONS = [
    ...(process.env.NEXT_PUBLIC_ENABLE_INSTACART === 'true' ? [{
        value: "instacart",
        label: "Instacart",
        description: "Shop from multiple stores with delivery",
        pros: [
            "Shop from Costco, Walmart, local grocers & more",
            "Same-day delivery available",
            "No store account linking required",
        ],
    }] : []),
    {
        value: "kroger",
        label: "Kroger Direct",
        description: "Link your Kroger account for the best experience",
        pros: [
            "See real-time pricing from your local store",
            "Add items directly to your Kroger cart",
            "Check product availability at your store",
        ],
    },
];

const TOTAL_STEPS = 7;
const ENABLE_INSTACART = process.env.NEXT_PUBLIC_ENABLE_INSTACART === 'true';
const VISIBLE_STEPS = ENABLE_INSTACART ? 7 : 6;

function SetupPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToast();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const [step, setStep] = useState(1);
    const [name, setName] = useState("");
    const [dietType, setDietType] = useState("");
    const [cookingExperience, setCookingExperience] = useState("");
    const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
    const [selectedSensitivities, setSelectedSensitivities] = useState<string[]>([]);
    const [selectedDislikedFoods, setSelectedDislikedFoods] = useState<string[]>([]);
    const [customDislikedFood, setCustomDislikedFood] = useState("");
    const [customAllergy, setCustomAllergy] = useState("");
    const [customSensitivity, setCustomSensitivity] = useState("");
    const [saving, setSaving] = useState(false);
    const [accentColor, setAccentColor] = useState<AccentColor>({ primary: "#3b82f6", dark: "#2563eb" });
    const [shoppingPreference, setShoppingPreference] = useState<"kroger" | "instacart">("kroger");

    // Kroger state
    const [krogerLinked, setKrogerLinked] = useState(false);

    // Store selection state (Kroger)
    const [zipSearch, setZipSearch] = useState("");
    const [storeResults, setStoreResults] = useState<KrogerLocationSearchResult[]>([]);
    const [searchingStores, setSearchingStores] = useState(false);
    const [storeSearchError, setStoreSearchError] = useState<string | null>(null);
    const [selectedStore, setSelectedStore] = useState<KrogerLocationSearchResult | null>(null);
    const [savingStore, setSavingStore] = useState(false);

    // Instacart retailer selection state
    const [instacartZipSearch, setInstacartZipSearch] = useState("");
    const [instacartRetailers, setInstacartRetailers] = useState<InstacartRetailer[]>([]);
    const [searchingInstacartRetailers, setSearchingInstacartRetailers] = useState(false);
    const [instacartSearchError, setInstacartSearchError] = useState<string | null>(null);
    const [selectedInstacartRetailer, setSelectedInstacartRetailer] = useState<InstacartRetailer | null>(null);
    const [savingInstacartRetailer, setSavingInstacartRetailer] = useState(false);

    useEffect(() => {
        setAccentColor(getRandomAccentColor());

        // Restore form data from localStorage (survives OAuth redirect)
        const savedFormData = localStorage.getItem("setupFormData");
        if (savedFormData) {
            try {
                const data = JSON.parse(savedFormData);
                if (data.name) setName(data.name);
                if (data.dietType) setDietType(data.dietType);
                if (data.cookingExperience) setCookingExperience(data.cookingExperience);
                if (data.selectedAllergies) setSelectedAllergies(data.selectedAllergies);
                if (data.selectedSensitivities) setSelectedSensitivities(data.selectedSensitivities);
                if (data.selectedDislikedFoods) setSelectedDislikedFoods(data.selectedDislikedFoods);
                if (data.shoppingPreference) setShoppingPreference(data.shoppingPreference);
                console.log("Restored form data from localStorage:", data);
            } catch (e) {
                console.error("Failed to restore form data:", e);
            }
        }
    }, []);

    // Save form data to localStorage whenever it changes
    useEffect(() => {
        const formData = {
            name,
            dietType,
            cookingExperience,
            selectedAllergies,
            selectedSensitivities,
            selectedDislikedFoods,
            shoppingPreference,
        };
        localStorage.setItem("setupFormData", JSON.stringify(formData));
    }, [name, dietType, cookingExperience, selectedAllergies, selectedSensitivities, selectedDislikedFoods, shoppingPreference]);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                router.push("/login");
                return;
            }

            setUser(firebaseUser);

            // Check if Kroger is already linked
            try {
                const userRef = doc(db, "users", firebaseUser.uid);
                const snap = await getDoc(userRef);
                if (snap.exists()) {
                    const data = snap.data();
                    setKrogerLinked(Boolean(data.krogerLinked));
                }
            } catch (err) {
                console.error("Error checking Kroger status:", err);
            }

            setLoading(false);
        });

        return () => unsub();
    }, [router]);

    // Handle Kroger OAuth callback
    useEffect(() => {
        const krogerLinkedParam = searchParams.get("kroger_linked");
        const krogerError = searchParams.get("kroger_error");
        const returnStep = searchParams.get("step");

        // Get stored store name and clean up
        const storeName = localStorage.getItem("pendingStoreLink") || "Kroger";

        if (krogerLinkedParam === "success") {
            // Restore the selected store from localStorage for proper branding on step 6
            const storedStoreData = localStorage.getItem("pendingStoreData");
            if (storedStoreData) {
                try {
                    const storeData = JSON.parse(storedStoreData) as KrogerLocationSearchResult;
                    setSelectedStore(storeData);
                } catch (e) {
                    console.error("Failed to parse stored store data:", e);
                }
            }
            localStorage.removeItem("pendingStoreLink");
            localStorage.removeItem("pendingStoreData");
            setKrogerLinked(true);
            showToast(`Your ${storeName} account has been linked!`, "success");
            // Stay on Kroger linking step to show success state
            if (returnStep) {
                setStep(parseInt(returnStep, 10));
            } else {
                setStep(7); // Kroger linking step
            }
            router.replace("/setup");
        } else if (krogerError) {
            localStorage.removeItem("pendingStoreLink");
            localStorage.removeItem("pendingStoreData");
            const errorMessages: Record<string, string> = {
                oauth_denied: `You declined to link your ${storeName} account.`,
                missing_params: `Missing parameters from ${storeName}. Please try again.`,
                state_mismatch: "Security verification failed. Please try again.",
                invalid_state: "Invalid session. Please try again.",
                token_exchange_failed: `Failed to connect to ${storeName}. Please try again.`,
                server_error: "An unexpected error occurred. Please try again.",
            };
            showToast(errorMessages[krogerError] || `Failed to link ${storeName} account.`, "error");
            if (returnStep) {
                setStep(parseInt(returnStep, 10));
            }
            router.replace("/setup");
        }
    }, [searchParams, router, showToast]);

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

    const toggleDislikedFood = (item: string) => {
        setSelectedDislikedFoods((prev) =>
            prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
        );
    };

    const addCustomDislikedFood = () => {
        const trimmed = customDislikedFood.trim();
        if (trimmed && !selectedDislikedFoods.includes(trimmed)) {
            setSelectedDislikedFoods((prev) => [...prev, trimmed]);
            setCustomDislikedFood("");
        }
    };

    const addCustomAllergy = () => {
        const trimmed = customAllergy.trim();
        if (trimmed && !selectedAllergies.includes(trimmed)) {
            setSelectedAllergies((prev) => [...prev, trimmed]);
            setCustomAllergy("");
        }
    };

    const addCustomSensitivity = () => {
        const trimmed = customSensitivity.trim();
        if (trimmed && !selectedSensitivities.includes(trimmed)) {
            setSelectedSensitivities((prev) => [...prev, trimmed]);
            setCustomSensitivity("");
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setSaving(true);

        try {
            await setDoc(
                doc(db, "users", user.uid),
                {
                    name: name.trim(),
                    dietType,
                    cookingExperience,
                    allergiesAndSensitivities: {
                        allergies: selectedAllergies,
                        sensitivities: selectedSensitivities,
                    },
                    dislikedFoods: selectedDislikedFoods,
                },
                { merge: true }
            );

            sessionStorage.setItem("animateEntry", "true");
            router.push("/prompt");
        } catch (err: any) {
            showToast(err.message || "Failed to save", "error");
            setSaving(false);
        }
    };

    const handleSkip = () => {
        sessionStorage.setItem("animateEntry", "true");
        router.push("/prompt");
    };

    const nextStep = () => {
        if (step < TOTAL_STEPS) {
            // Skip step 5 (Shopping Preference) if Instacart is disabled
            if (step === 4 && !ENABLE_INSTACART) {
                setStep(6);
            } else {
                setStep(step + 1);
            }
        }
    };

    const prevStep = () => {
        if (step > 1) {
            // Skip step 5 (Shopping Preference) if Instacart is disabled
            if (step === 6 && !ENABLE_INSTACART) {
                setStep(4);
            } else {
                setStep(step - 1);
            }
        }
    };

    const handleLinkKroger = async () => {
        if (!user) return;

        // Save preferences to Firestore BEFORE redirecting to OAuth
        // This ensures data isn't lost during the redirect (especially in incognito)
        try {
            const dataToSave = {
                name: name.trim(),
                dietType,
                cookingExperience,
                allergiesAndSensitivities: {
                    allergies: selectedAllergies,
                    sensitivities: selectedSensitivities,
                },
                dislikedFoods: selectedDislikedFoods,
                shoppingPreference: shoppingPreference || "kroger",
            };

            await setDoc(
                doc(db, "users", user.uid),
                dataToSave,
                { merge: true }
            );
            console.log("Saved preferences before Kroger OAuth redirect");
        } catch (err) {
            console.error("Failed to save preferences before OAuth:", err);
            // Continue anyway - we'll try to save again at the end
        }

        // Save store name and data to localStorage for use after OAuth redirect
        if (selectedStore) {
            const storeBrand = getStoreBrand(selectedStore.name);
            localStorage.setItem("pendingStoreLink", storeBrand.displayName);
            localStorage.setItem("pendingStoreData", JSON.stringify(selectedStore));
        }
        // Redirect to Kroger OAuth with return URL to setup
        const authUrl = `/api/kroger/auth?userId=${user.uid}&returnTo=setup&step=7${isCapacitor() ? '&mobile=true' : ''}`;
        if (isCapacitor()) {
            await Browser.open({ url: `${window.location.origin}${authUrl}` });
        } else {
            window.location.href = authUrl;
        }
    };

    const handleSearchStoresByZip = async () => {
        const zip = zipSearch.trim();
        if (!zip) {
            setStoreSearchError("Please enter a ZIP code.");
            setStoreResults([]);
            return;
        }

        try {
            setSearchingStores(true);
            setStoreSearchError(null);
            setStoreResults([]);

            const res = await fetch(`/api/kroger/locations?zip=${encodeURIComponent(zip)}`);

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                setStoreSearchError(data?.message || "Could not load stores for that ZIP.");
                return;
            }

            const data = (await res.json()) as { locations?: KrogerLocationSearchResult[] };
            const locs = data.locations ?? [];
            setStoreResults(locs);
            if (locs.length === 0) {
                setStoreSearchError("No stores found for that ZIP.");
            }
        } catch (err) {
            console.error("Error searching stores", err);
            setStoreSearchError("Something went wrong searching for stores.");
        } finally {
            setSearchingStores(false);
        }
    };

    const handleSelectStore = async (store: KrogerLocationSearchResult) => {
        if (!user) return;

        try {
            setSavingStore(true);

            // Check if this store already exists
            const locCol = collection(db, "krogerLocations", user.uid, "locations");
            const existingQuery = query(locCol, where("krogerLocationId", "==", store.locationId));
            const existingSnapshot = await getDocs(existingQuery);

            if (!existingSnapshot.empty) {
                showToast(`${store.name} is already in your saved stores.`, "error");
                setSavingStore(false);
                return;
            }

            // Save to krogerLocations collection
            await addDoc(locCol, {
                krogerLocationId: store.locationId,
                name: store.name,
                addressLine1: store.addressLine1 || null,
                city: store.city || null,
                state: store.state || null,
                zip: store.zipCode || null,
                isDefault: true,
                createdAt: serverTimestamp(),
            });

            // Update user's default location
            const userRef = doc(db, "users", user.uid);
            await setDoc(userRef, {
                defaultKrogerLocationId: store.locationId,
            }, { merge: true });

            // Warm cache for the new store in background
            warmLocationInBackground(store.locationId);

            setSelectedStore(store);
        } catch (err) {
            console.error("Error saving store:", err);
            setStoreSearchError("Failed to save store. Please try again.");
        } finally {
            setSavingStore(false);
        }
    };

    const handleSearchInstacartRetailers = async () => {
        const zip = instacartZipSearch.trim();
        if (!zip) {
            setInstacartSearchError("Please enter a ZIP code.");
            setInstacartRetailers([]);
            return;
        }

        try {
            setSearchingInstacartRetailers(true);
            setInstacartSearchError(null);
            setInstacartRetailers([]);

            const res = await fetch(`/api/instacart/retailers?postal_code=${encodeURIComponent(zip)}`);
            const data = await res.json();

            if (!res.ok || !data.success) {
                setInstacartSearchError(data.error || "Could not load retailers for that ZIP.");
                return;
            }

            const retailers = data.retailers || [];
            setInstacartRetailers(retailers);
            if (retailers.length === 0) {
                setInstacartSearchError("No retailers found for that ZIP code.");
            }
        } catch (err) {
            console.error("Error searching Instacart retailers", err);
            setInstacartSearchError("Something went wrong searching for retailers.");
        } finally {
            setSearchingInstacartRetailers(false);
        }
    };

    const handleSelectInstacartRetailer = async (retailer: InstacartRetailer) => {
        if (!user) return;

        try {
            setSavingInstacartRetailer(true);

            // Save to user document
            const userRef = doc(db, "users", user.uid);
            await setDoc(userRef, {
                defaultInstacartRetailer: {
                    retailer_key: retailer.retailer_key,
                    name: retailer.name,
                    retailer_logo_url: retailer.retailer_logo_url || "",
                },
            }, { merge: true });

            setSelectedInstacartRetailer(retailer);
            showToast(`${retailer.name} selected as your default store!`, "success");
        } catch (err) {
            console.error("Error saving Instacart retailer:", err);
            setInstacartSearchError("Failed to save retailer. Please try again.");
        } finally {
            setSavingInstacartRetailer(false);
        }
    };

    const handleFinishSetup = async () => {
        console.log("handleFinishSetup called");
        console.log("user:", user);
        console.log("user.uid:", user?.uid);

        if (!user) {
            showToast("Not logged in. Please log in and try again.", "error");
            return;
        }

        setSaving(true);

        const dataToSave = {
            name: name.trim(),
            dietType,
            cookingExperience,
            allergiesAndSensitivities: {
                allergies: selectedAllergies,
                sensitivities: selectedSensitivities,
            },
            dislikedFoods: selectedDislikedFoods,
            shoppingPreference: shoppingPreference
        };

        console.log("Data to save:", dataToSave);
        console.log("Document path: users/" + user.uid);

        try {
            console.log("Attempting setDoc...");
            await setDoc(
                doc(db, "users", user.uid),
                dataToSave,
                { merge: true }
            );
            console.log("setDoc succeeded!");

            // Clear the saved form data from localStorage
            localStorage.removeItem("setupFormData");

            // Check for pending share claim
            const pendingShareId = localStorage.getItem("pendingShareId");
            if (pendingShareId) {
                try {
                    const claimRes = await authFetch("/api/share/claim", {
                        method: "POST",
                        body: JSON.stringify({ shareId: pendingShareId }),
                    });

                    if (claimRes.ok) {
                        localStorage.removeItem("pendingShareId");
                        showToast("Preferences saved & shared meal added!", "success");
                        sessionStorage.setItem("animateEntry", "true");
                        router.push("/saved-meals");
                        return;
                    } else {
                        console.error("Failed to claim shared meal");
                    }
                } catch (e) {
                    console.error("Error claiming shared meal:", e);
                }
            }

            showToast("Your preferences have been saved!", "success");
            sessionStorage.setItem("animateEntry", "true");
            router.push("/prompt");
        } catch (err: any) {
            console.error("setDoc FAILED:", err);
            console.error("Error code:", err.code);
            console.error("Error message:", err.message);
            showToast(err.message || "Failed to save", "error");
            setSaving(false);
        }
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
                        {Array.from({ length: VISIBLE_STEPS }, (_, i) => i + 1).map((s) => {
                            // Map visual step to logical step
                            // If Instacart disabled, visual step 5 maps to logical step 6, etc.
                            const logicalStep = (!ENABLE_INSTACART && s >= 5) ? s + 1 : s;

                            return (
                                <div
                                    key={s}
                                    className={`h-1 flex-1 rounded-full transition-colors ${logicalStep <= step ? "bg-gray-900" : "bg-gray-200"
                                        }`}
                                />
                            );
                        })}
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

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Cooking Experience
                                        </label>
                                        <div className="space-y-2">
                                            {COOKING_EXPERIENCE_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => setCookingExperience(opt.value)}
                                                    className={`w-full p-3 rounded-lg border text-left transition-all ${cookingExperience === opt.value
                                                        ? "border-gray-900 bg-gray-50"
                                                        : "border-gray-200 hover:border-gray-300"
                                                        }`}
                                                >
                                                    <span className="font-medium text-gray-900">{opt.label}</span>
                                                    <p className="text-sm text-gray-500 mt-0.5">{opt.description}</p>
                                                </button>
                                            ))}
                                        </div>
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
                                                className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all ${selectedAllergies.includes(item)
                                                    ? "bg-gray-900 text-white"
                                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                    }`}
                                            >
                                                {item}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Custom allergy input */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Add your own
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={customAllergy}
                                                onChange={(e) => setCustomAllergy(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        addCustomAllergy();
                                                    }
                                                }}
                                                placeholder="e.g., Sunflower seeds"
                                                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-colors"
                                            />
                                            <button
                                                type="button"
                                                onClick={addCustomAllergy}
                                                disabled={!customAllergy.trim()}
                                                className="px-4 py-2.5 bg-gray-900 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>

                                    {/* Show custom selections */}
                                    {selectedAllergies.filter(a => !ALLERGY_OPTIONS.includes(a)).length > 0 && (
                                        <div>
                                            <p className="text-xs text-gray-500 mb-2">Your additions:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedAllergies
                                                    .filter(a => !ALLERGY_OPTIONS.includes(a))
                                                    .map((item) => (
                                                        <button
                                                            key={item}
                                                            type="button"
                                                            onClick={() => toggleAllergy(item)}
                                                            className="px-4 py-2.5 rounded-full text-sm font-medium bg-gray-900 text-white"
                                                        >
                                                            {item}
                                                        </button>
                                                    ))}
                                            </div>
                                        </div>
                                    )}

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
                                                className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all ${selectedSensitivities.includes(item)
                                                    ? "bg-gray-900 text-white"
                                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                    }`}
                                            >
                                                {item}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Custom sensitivity input */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Add your own
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={customSensitivity}
                                                onChange={(e) => setCustomSensitivity(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        addCustomSensitivity();
                                                    }
                                                }}
                                                placeholder="e.g., Caffeine"
                                                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-colors"
                                            />
                                            <button
                                                type="button"
                                                onClick={addCustomSensitivity}
                                                disabled={!customSensitivity.trim()}
                                                className="px-4 py-2.5 bg-gray-900 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>

                                    {/* Show custom selections */}
                                    {selectedSensitivities.filter(s => !SENSITIVITY_OPTIONS.includes(s)).length > 0 && (
                                        <div>
                                            <p className="text-xs text-gray-500 mb-2">Your additions:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedSensitivities
                                                    .filter(s => !SENSITIVITY_OPTIONS.includes(s))
                                                    .map((item) => (
                                                        <button
                                                            key={item}
                                                            type="button"
                                                            onClick={() => toggleSensitivity(item)}
                                                            className="px-4 py-2.5 rounded-full text-sm font-medium bg-gray-900 text-white"
                                                        >
                                                            {item}
                                                        </button>
                                                    ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectedSensitivities.length === 0 && (
                                        <p className="text-sm text-gray-400">
                                            No sensitivities? Just tap Continue.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Step 4: Food Dislikes */}
                            {step === 4 && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="font-medium text-gray-900 mb-1">Food Dislikes</h2>
                                        <p className="text-sm text-gray-500">Foods you'd rather not see in meals</p>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {COMMON_DISLIKED_FOODS.map((item) => (
                                            <button
                                                key={item}
                                                type="button"
                                                onClick={() => toggleDislikedFood(item)}
                                                className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all ${selectedDislikedFoods.includes(item)
                                                    ? "bg-gray-900 text-white"
                                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                    }`}
                                            >
                                                {item}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Custom food input */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Add your own
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={customDislikedFood}
                                                onChange={(e) => setCustomDislikedFood(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        addCustomDislikedFood();
                                                    }
                                                }}
                                                placeholder="e.g., Onions"
                                                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-colors"
                                            />
                                            <button
                                                type="button"
                                                onClick={addCustomDislikedFood}
                                                disabled={!customDislikedFood.trim()}
                                                className="px-4 py-2.5 bg-gray-900 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>

                                    {/* Show custom selections */}
                                    {selectedDislikedFoods.filter(f => !COMMON_DISLIKED_FOODS.includes(f)).length > 0 && (
                                        <div>
                                            <p className="text-xs text-gray-500 mb-2">Your additions:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedDislikedFoods
                                                    .filter(f => !COMMON_DISLIKED_FOODS.includes(f))
                                                    .map((item) => (
                                                        <button
                                                            key={item}
                                                            type="button"
                                                            onClick={() => toggleDislikedFood(item)}
                                                            className="px-4 py-2.5 rounded-full text-sm font-medium bg-gray-900 text-white"
                                                        >
                                                            {item}
                                                        </button>
                                                    ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectedDislikedFoods.length === 0 && (
                                        <p className="text-sm text-gray-400">
                                            No dislikes? Just tap Continue.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Step 5: Shopping Preference */}
                            {step === 5 && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="font-medium text-gray-900 mb-1">How do you prefer to shop?</h2>
                                        <p className="text-sm text-gray-500">Choose how you&apos;d like to add ingredients to your cart</p>
                                    </div>

                                    <div className="space-y-4">
                                        {SHOPPING_PREFERENCE_OPTIONS.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => setShoppingPreference(option.value as "kroger" | "instacart")}
                                                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${shoppingPreference === option.value
                                                    ? "border-gray-900 bg-gray-50"
                                                    : "border-gray-200 hover:border-gray-300"
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <div>
                                                        <h3 className="font-semibold text-gray-900">{option.label}</h3>
                                                        <p className="text-sm text-gray-500">{option.description}</p>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${shoppingPreference === option.value
                                                        ? "border-gray-900 bg-gray-900"
                                                        : "border-gray-300"
                                                        }`}>
                                                        {shoppingPreference === option.value && (
                                                            <div className="w-2 h-2 bg-white rounded-full" />
                                                        )}
                                                    </div>
                                                </div>
                                                <ul className="space-y-1.5 mt-3">
                                                    {option.pros.map((pro, idx) => (
                                                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                                                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                                            <span>{pro}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </button>
                                        ))}
                                    </div>

                                    <p className="text-sm text-gray-400 text-center">
                                        You can change this preference later in settings.
                                    </p>
                                </div>
                            )}

                            {/* Step 6: Select Store (only for Kroger preference) */}
                            {step === 6 && shoppingPreference === "kroger" && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="font-medium text-gray-900 mb-1">Choose Your Kroger Brand Store</h2>
                                        <p className="text-sm text-gray-500">
                                            Find your local store for pricing and availability
                                        </p>
                                    </div>

                                    {selectedStore ? (
                                        <div className="bg-green-50 border border-green-100 rounded-xl p-6">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                                </div>
                                                <div>
                                                    <h3 className="font-medium text-green-900">{selectedStore.name}</h3>
                                                    <p className="text-sm text-green-700">
                                                        {selectedStore.addressLine1}
                                                    </p>
                                                    <p className="text-sm text-green-700">
                                                        {selectedStore.city}, {selectedStore.state} {selectedStore.zipCode}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedStore(null)}
                                                className="mt-4 text-sm text-green-700 underline hover:text-green-800"
                                            >
                                                Choose a different store
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div>
                                                {/* Marquee for supported stores */}
                                                <div className="mb-6 rounded-xl border border-gray-200 overflow-hidden relative bg-gray-50/50">
                                                    {/* Right Gradient Mask only - to ensure first item (Kroger) is visible at start */}
                                                    <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-gray-50/50 to-transparent z-10" />

                                                    <div className="flex overflow-hidden w-full py-3">
                                                        <div className="flex animate-scroll gap-3 min-w-full items-center">
                                                            {[
                                                                "Kroger", "King Soopers", "Ralphs", "City Market", "Fred Meyer", "Smith's", "Fry's", "QFC",
                                                                "Harris Teeter", "Pick 'n Save", "Mariano's", "Food 4 Less",
                                                                "Baker's", "Dillons"
                                                            ].map((store, i) => (
                                                                <div key={`store-marquee-${i}`} className="flex-shrink-0 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-700 shadow-sm whitespace-nowrap">
                                                                    {store}
                                                                </div>
                                                            ))}
                                                            {/* Duplicate for seamless loop */}
                                                            {[
                                                                "Kroger", "King Soopers", "Ralphs", "City Market", "Fred Meyer", "Smith's", "Fry's", "QFC",
                                                                "Harris Teeter", "Pick 'n Save", "Mariano's", "Food 4 Less",
                                                                "Baker's", "Dillons"
                                                            ].map((store, i) => (
                                                                <div key={`store-marquee-dup-${i}`} className="flex-shrink-0 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-700 shadow-sm whitespace-nowrap">
                                                                    {store}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Search by ZIP Code
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={zipSearch}
                                                        onChange={(e) => setZipSearch(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                e.preventDefault();
                                                                handleSearchStoresByZip();
                                                            }
                                                        }}
                                                        placeholder="Enter ZIP code"
                                                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-colors"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleSearchStoresByZip}
                                                        disabled={searchingStores}
                                                        className="p-2.5 bg-gray-900 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0"
                                                        aria-label="Search"
                                                    >
                                                        {searchingStores ? (
                                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        ) : (
                                                            <Search className="w-5 h-5" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>

                                            {storeSearchError && (
                                                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                                                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                                    <p className="text-sm text-red-600">{storeSearchError}</p>
                                                </div>
                                            )}

                                            {storeResults.length > 0 && (
                                                <div className="space-y-2 max-h-[240px] overflow-y-auto">
                                                    {storeResults.map((store) => (
                                                        <button
                                                            key={store.locationId}
                                                            type="button"
                                                            onClick={() => handleSelectStore(store)}
                                                            disabled={savingStore}
                                                            className="w-full p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-left transition-colors disabled:opacity-50"
                                                        >
                                                            <div className="flex items-start gap-3">
                                                                <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                                                                <div>
                                                                    <p className="font-medium text-gray-900">{store.name}</p>
                                                                    <p className="text-sm text-gray-500">
                                                                        {store.addressLine1}
                                                                    </p>
                                                                    <p className="text-sm text-gray-500">
                                                                        {store.city}, {store.state} {store.zipCode}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}

                                    <p className="text-sm text-gray-400 text-center">
                                        This step is optional. You can set your store later in settings.
                                    </p>
                                </div>
                            )}

                            {/* Step 6: Instacart retailer selection (for Instacart preference) */}
                            {step === 6 && shoppingPreference === "instacart" && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="font-medium text-gray-900 mb-1">Choose Your Preferred Store</h2>
                                        <p className="text-sm text-gray-500">Select a default store for Instacart shopping (optional)</p>
                                    </div>

                                    {selectedInstacartRetailer ? (
                                        <div className="bg-[#003D29]/5 border border-[#003D29]/20 rounded-xl p-6">
                                            <div className="flex items-start gap-3">
                                                {selectedInstacartRetailer.retailer_logo_url ? (
                                                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-white flex-shrink-0 border border-gray-100">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={selectedInstacartRetailer.retailer_logo_url}
                                                            alt={selectedInstacartRetailer.name}
                                                            className="w-full h-full object-contain"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="w-14 h-14 rounded-lg bg-[#003D29]/10 flex items-center justify-center flex-shrink-0">
                                                        <Store className="w-7 h-7 text-[#003D29]" />
                                                    </div>
                                                )}
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle className="w-5 h-5 text-[#003D29]" />
                                                        <h3 className="font-medium text-[#003D29]">{selectedInstacartRetailer.name}</h3>
                                                    </div>
                                                    <p className="text-sm text-[#003D29]/70 mt-1">
                                                        This store will be pre-selected when you shop with Instacart
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedInstacartRetailer(null)}
                                                className="mt-4 text-sm text-[#003D29]/70 hover:text-[#003D29] underline"
                                            >
                                                Choose a different store
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Info box */}
                                            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                                                <p className="text-xs font-medium text-blue-800 mb-1">Popular Instacart Retailers</p>
                                                <p className="text-xs text-blue-700 leading-relaxed">
                                                    Costco, Walmart, Target, Safeway, Kroger, Publix, Albertsons, Sprouts, and many more local grocers
                                                </p>
                                            </div>

                                            {/* ZIP Search */}
                                            <div>
                                                <label className="text-sm font-medium text-gray-700 mb-2 block">
                                                    Search by ZIP Code
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={instacartZipSearch}
                                                        onChange={(e) => setInstacartZipSearch(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                e.preventDefault();
                                                                void handleSearchInstacartRetailers();
                                                            }
                                                        }}
                                                        placeholder="Enter ZIP code"
                                                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:border-[#003D29] focus:ring-1 focus:ring-[#003D29] focus:outline-none transition-colors"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleSearchInstacartRetailers()}
                                                        disabled={searchingInstacartRetailers}
                                                        className="p-2.5 bg-[#003D29] text-white rounded-lg disabled:opacity-70 flex items-center justify-center flex-shrink-0"
                                                        aria-label="Search"
                                                    >
                                                        {searchingInstacartRetailers ? (
                                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        ) : (
                                                            <Search className="w-5 h-5" />
                                                        )}
                                                    </button>
                                                </div>

                                                {instacartSearchError && (
                                                    <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg mt-3">
                                                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                                        <p className="text-sm text-red-600">{instacartSearchError}</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Search Results */}
                                            {instacartRetailers.length > 0 && (
                                                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                                        Available Retailers ({instacartRetailers.length})
                                                    </p>
                                                    {instacartRetailers.map((retailer) => (
                                                        <button
                                                            key={retailer.retailer_key}
                                                            type="button"
                                                            onClick={() => void handleSelectInstacartRetailer(retailer)}
                                                            disabled={savingInstacartRetailer}
                                                            className="w-full p-3 bg-gray-50 hover:bg-[#003D29]/5 border border-gray-200 hover:border-[#003D29]/30 rounded-lg text-left transition-colors disabled:opacity-50 flex items-center gap-3"
                                                        >
                                                            {retailer.retailer_logo_url ? (
                                                                <div className="w-10 h-10 rounded-lg overflow-hidden bg-white flex-shrink-0 border border-gray-100">
                                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                    <img
                                                                        src={retailer.retailer_logo_url}
                                                                        alt={retailer.name}
                                                                        className="w-full h-full object-contain"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                                    <Store className="w-5 h-5 text-gray-400" />
                                                                </div>
                                                            )}
                                                            <span className="font-medium text-gray-900">{retailer.name}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}

                                    <p className="text-sm text-gray-400 text-center">
                                        This is optional. You can always change your store later or choose a different one when shopping.
                                    </p>
                                </div>
                            )}

                            {/* Step 7: Link Kroger Account (only for Kroger preference) */}
                            {step === 7 && shoppingPreference === "kroger" && (() => {
                                const storeBrand = selectedStore ? getStoreBrand(selectedStore.name) : { displayName: "Kroger", tagline: "Kroger Family of Stores" };
                                const isGenericKroger = !selectedStore;
                                return (
                                    <div className="space-y-6">
                                        <div>
                                            <h2 className="font-medium text-gray-900 mb-1">
                                                {isGenericKroger ? "Connect Your Store Account" : `Connect Your ${storeBrand.displayName} Account`}
                                            </h2>
                                            <p className="text-sm text-gray-500">Link your account to add items directly to your cart</p>
                                        </div>

                                        {krogerLinked ? (
                                            <div className="bg-green-50 border border-green-100 rounded-xl p-6 text-center">
                                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                                </div>
                                                <h3 className="font-medium text-green-900 mb-1">{storeBrand.displayName} Connected</h3>
                                                <p className="text-sm text-green-700">Your account is linked and ready to use.</p>
                                            </div>
                                        ) : (
                                            <div className="bg-gray-50 border border-gray-100 rounded-xl p-6 overflow-hidden relative">
                                                <div className="flex items-center gap-4 mb-6 relative z-10">
                                                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                                        <ShoppingCart className="w-6 h-6 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-medium text-gray-900">
                                                            {isGenericKroger ? "Kroger Family of Stores" : storeBrand.displayName}
                                                        </h3>
                                                        <p className="text-sm text-gray-500">{storeBrand.tagline}</p>
                                                    </div>
                                                </div>

                                                {/* Show supported stores when no specific store selected */}
                                                {isGenericKroger && (
                                                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                                        <p className="text-xs font-medium text-blue-800 mb-2">Supported stores include:</p>
                                                        <p className="text-xs text-blue-700 leading-relaxed">
                                                            Kroger, Ralphs, Fred Meyer, King Soopers, Fry&apos;s, Smith&apos;s, Dillons, QFC, Harris Teeter, Pick &apos;n Save, Mariano&apos;s, Food 4 Less, City Market, Baker&apos;s, and more
                                                        </p>
                                                    </div>
                                                )}

                                                <ul className="space-y-2 mb-4 text-sm text-gray-600">
                                                    <li className="flex items-center gap-2">
                                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                                        <span>See real product prices</span>
                                                    </li>
                                                    <li className="flex items-center gap-2">
                                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                                        <span>Add items directly to your {isGenericKroger ? "store" : storeBrand.displayName} cart</span>
                                                    </li>
                                                    <li className="flex items-center gap-2">
                                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                                        <span>Get product availability at your store</span>
                                                    </li>
                                                </ul>
                                                <button
                                                    type="button"
                                                    onClick={handleLinkKroger}
                                                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 relative z-10"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                    <span>Connect {isGenericKroger ? "Store" : storeBrand.displayName} Account</span>
                                                </button>
                                            </div>
                                        )}

                                        <p className="text-sm text-gray-400 text-center">
                                            This step is optional. You can link your account later in settings.
                                        </p>
                                    </div>
                                );
                            })()}

                        </div>

                        {/* Navigation Buttons */}
                        <div className="mt-8 space-y-3">
                            {/* Instacart users finish at step 6, Kroger users finish at step 7 */}
                            {((shoppingPreference === "instacart" && step < 6) || (shoppingPreference === "kroger" && step < TOTAL_STEPS)) ? (
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
                                    type="button"
                                    onClick={handleFinishSetup}
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

export default function SetupPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
            </div>
        }>
            <SetupPageContent />
        </Suspense>
    );
}
