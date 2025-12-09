"use client";

import { Suspense, useEffect, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, setDoc, getDoc, collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { ArrowRight, AlertCircle, ShoppingCart, MapPin, CheckCircle, ExternalLink, Search } from "lucide-react";
import Image from "next/image";
import CartSenseLogo from "@/app/CartSenseLogo.svg";
import { getRandomAccentColor, getStoreBrand, type AccentColor } from "@/lib/utils";
import { useToast } from "@/components/Toast";

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

type KrogerLocationSearchResult = {
    locationId: string;
    name: string;
    addressLine1: string;
    city: string;
    state: string;
    zipCode: string;
};

const TOTAL_STEPS = 6;

function SetupPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToast();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const [step, setStep] = useState(1);
    const [name, setName] = useState("");
    const [dietType, setDietType] = useState("");
    const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
    const [selectedSensitivities, setSelectedSensitivities] = useState<string[]>([]);
    const [selectedDislikedFoods, setSelectedDislikedFoods] = useState<string[]>([]);
    const [customDislikedFood, setCustomDislikedFood] = useState("");
    const [saving, setSaving] = useState(false);
    const [accentColor, setAccentColor] = useState<AccentColor>({ primary: "#3b82f6", dark: "#2563eb" });

    // Kroger state
    const [krogerLinked, setKrogerLinked] = useState(false);

    // Store selection state
    const [zipSearch, setZipSearch] = useState("");
    const [storeResults, setStoreResults] = useState<KrogerLocationSearchResult[]>([]);
    const [searchingStores, setSearchingStores] = useState(false);
    const [storeSearchError, setStoreSearchError] = useState<string | null>(null);
    const [selectedStore, setSelectedStore] = useState<KrogerLocationSearchResult | null>(null);
    const [savingStore, setSavingStore] = useState(false);

    useEffect(() => {
        setAccentColor(getRandomAccentColor());

        // Restore form data from localStorage (survives OAuth redirect)
        const savedFormData = localStorage.getItem("setupFormData");
        if (savedFormData) {
            try {
                const data = JSON.parse(savedFormData);
                if (data.name) setName(data.name);
                if (data.dietType) setDietType(data.dietType);
                if (data.selectedAllergies) setSelectedAllergies(data.selectedAllergies);
                if (data.selectedSensitivities) setSelectedSensitivities(data.selectedSensitivities);
                if (data.selectedDislikedFoods) setSelectedDislikedFoods(data.selectedDislikedFoods);
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
            selectedAllergies,
            selectedSensitivities,
            selectedDislikedFoods,
        };
        localStorage.setItem("setupFormData", JSON.stringify(formData));
    }, [name, dietType, selectedAllergies, selectedSensitivities, selectedDislikedFoods]);

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
                setStep(6); // Kroger linking step
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
        if (step < TOTAL_STEPS) setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    const handleLinkKroger = async () => {
        if (!user) return;

        // Save preferences to Firestore BEFORE redirecting to OAuth
        // This ensures data isn't lost during the redirect (especially in incognito)
        try {
            const dataToSave = {
                name: name.trim(),
                dietType,
                allergiesAndSensitivities: {
                    allergies: selectedAllergies,
                    sensitivities: selectedSensitivities,
                },
                dislikedFoods: selectedDislikedFoods,
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
        window.location.href = `/api/kroger/auth?userId=${user.uid}&returnTo=setup&step=6`;
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

            setSelectedStore(store);
        } catch (err) {
            console.error("Error saving store:", err);
            setStoreSearchError("Failed to save store. Please try again.");
        } finally {
            setSavingStore(false);
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
            allergiesAndSensitivities: {
                allergies: selectedAllergies,
                sensitivities: selectedSensitivities,
            },
            dislikedFoods: selectedDislikedFoods,
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
                        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
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
                                                className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                                                    selectedDislikedFoods.includes(item)
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

                            {/* Step 5: Select Store (moved before Kroger linking) */}
                            {step === 5 && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="font-medium text-gray-900 mb-1">Choose Your Store</h2>
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

                            {/* Step 6: Link Kroger Account (now shows store-specific branding) */}
                            {step === 6 && (() => {
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
                                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-6">
                                            <div className="flex items-center gap-4 mb-4">
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
                                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
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
                            {step < TOTAL_STEPS ? (
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
