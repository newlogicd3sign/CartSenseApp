"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
    doc,
    getDoc,
    collection,
    getDocs,
    addDoc,
    updateDoc,
    writeBatch,
    serverTimestamp,
    setDoc,
} from "firebase/firestore";
import {
    User as UserIcon,
    Mail,
    Heart,
    AlertTriangle,
    FileText,
    ShoppingCart,
    MapPin,
    Search,
    CheckCircle,
    AlertCircle,
    ChevronRight,
    Edit3,
    X,
    Trash2,
    Plus,
    ExternalLink,
    LogOut,
    Zap,
} from "lucide-react";
import { signOut } from "firebase/auth";

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

type DoctorDietInstructions = {
    hasActiveNote?: boolean;
    sourceType?: "photo" | "manual";
    summaryText?: string;
    blockedIngredients?: string[];
    blockedGroups?: string[];
    updatedAt?: any;
};

type UserPrefsDoc = {
    name?: string;
    dietType?: string;
    allergiesAndSensitivities?: {
        allergies?: string[];
        sensitivities?: string[];
    };
    defaultKrogerLocationId?: string | null;
    krogerLinked?: boolean;
    doctorDietInstructions?: DoctorDietInstructions | null;
    monthlyPromptCount?: number;
    promptPeriodStart?: any;
    isPremium?: boolean;
};

const FREE_TIER_MONTHLY_LIMIT = 10;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type UserLocation = {
    id: string;
    krogerLocationId: string;
    name: string;
    addressLine1?: string;
    city?: string;
    state?: string;
    zip?: string;
    isDefault: boolean;
};

type KrogerLocationSearchResult = {
    locationId: string;
    name: string;
    addressLine1: string;
    city: string;
    state: string;
    zipCode: string;
};

export default function AccountPage() {
    const router = useRouter();

    const [user, setUser] = useState<User | null>(null);
    const [userDoc, setUserDoc] = useState<UserPrefsDoc | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [locations, setLocations] = useState<UserLocation[]>([]);
    const [loadingLocations, setLoadingLocations] = useState(true);

    const [savingLocation, setSavingLocation] = useState(false);
    const [locationMessage, setLocationMessage] = useState<string | null>(null);

    const [zipSearch, setZipSearch] = useState("");
    const [storeResults, setStoreResults] = useState<KrogerLocationSearchResult[]>([]);
    const [searchingStores, setSearchingStores] = useState(false);
    const [storeSearchError, setStoreSearchError] = useState<string | null>(null);

    const [editingDietAllergies, setEditingDietAllergies] = useState(false);
    const [selectedDietType, setSelectedDietType] = useState("");
    const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
    const [selectedSensitivities, setSelectedSensitivities] = useState<string[]>([]);
    const [savingDietAllergies, setSavingDietAllergies] = useState(false);
    const [dietAllergiesMessage, setDietAllergiesMessage] = useState<string | null>(null);

    const [removingDoctorNote, setRemovingDoctorNote] = useState(false);
    const [doctorNoteMessage, setDoctorNoteMessage] = useState<string | null>(null);

    const [krogerMessage, setKrogerMessage] = useState<string | null>(null);
    const [krogerMessageType, setKrogerMessageType] = useState<"success" | "error">("success");
    const searchParams = useSearchParams();

    const formatDoctorUpdatedAt = (value?: any) => {
        if (!value) return "";
        let date: Date | null = null;

        if (value && typeof value === "object" && typeof value.toDate === "function") {
            date = value.toDate();
        } else if (typeof value === "string") {
            date = new Date(value);
        }

        if (!date || Number.isNaN(date.getTime())) return "";
        return date.toLocaleDateString();
    };

    useEffect(() => {
        const krogerLinked = searchParams.get("kroger_linked");
        const krogerError = searchParams.get("kroger_error");

        if (krogerLinked === "success") {
            setKrogerMessage("Your Kroger account has been linked successfully!");
            setKrogerMessageType("success");
            setUserDoc((prev) => (prev ? { ...prev, krogerLinked: true } : { krogerLinked: true }));
            router.replace("/account");
        } else if (krogerError) {
            const errorMessages: Record<string, string> = {
                oauth_denied: "You declined to link your Kroger account.",
                missing_params: "Missing parameters from Kroger. Please try again.",
                state_mismatch: "Security verification failed. Please try again.",
                invalid_state: "Invalid session. Please try again.",
                token_exchange_failed: "Failed to connect to Kroger. Please try again.",
                server_error: "An unexpected error occurred. Please try again.",
            };
            setKrogerMessage(errorMessages[krogerError] || "Failed to link Kroger account.");
            setKrogerMessageType("error");
            router.replace("/account");
        }
    }, [searchParams, router]);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                router.push("/login");
                return;
            }

            setUser(firebaseUser);

            try {
                const userRef = doc(db, "users", firebaseUser.uid);
                const snap = await getDoc(userRef);
                if (snap.exists()) {
                    setUserDoc(snap.data() as UserPrefsDoc);
                } else {
                    setUserDoc(null);
                }
            } catch (err) {
                console.error("Error loading user doc", err);
                setUserDoc(null);
            } finally {
                setLoadingUser(false);
            }
        });

        return () => unsub();
    }, [router]);

    useEffect(() => {
        if (!user) return;

        const loadLocations = async () => {
            setLoadingLocations(true);
            try {
                const locCol = collection(db, "krogerLocations", user.uid, "locations");
                const snap = await getDocs(locCol);

                const locs: UserLocation[] = [];
                snap.forEach((d) => {
                    const data = d.data() as any;
                    locs.push({
                        id: d.id,
                        krogerLocationId: data.krogerLocationId,
                        name: data.name,
                        addressLine1: data.addressLine1 ?? undefined,
                        city: data.city ?? undefined,
                        state: data.state ?? undefined,
                        zip: data.zip ?? undefined,
                        isDefault: Boolean(data.isDefault),
                    });
                });

                setLocations(locs);
            } catch (err) {
                console.error("Error loading locations", err);
                setLocations([]);
            } finally {
                setLoadingLocations(false);
            }
        };

        void loadLocations();
    }, [user]);

    const handleSetDefault = async (loc: UserLocation) => {
        if (!user) return;

        try {
            setLocationMessage(null);

            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                defaultKrogerLocationId: loc.krogerLocationId,
            });

            const batch = writeBatch(db);
            const locCol = collection(db, "krogerLocations", user.uid, "locations");
            for (const l of locations) {
                const ref = doc(locCol, l.id);
                batch.update(ref, { isDefault: l.id === loc.id });
            }
            await batch.commit();

            setLocations((prev) =>
                prev.map((l) => ({
                    ...l,
                    isDefault: l.id === loc.id,
                }))
            );
            setUserDoc((prev) =>
                prev
                    ? { ...prev, defaultKrogerLocationId: loc.krogerLocationId }
                    : { defaultKrogerLocationId: loc.krogerLocationId }
            );

            setLocationMessage("Default store updated.");
        } catch (err) {
            console.error("Error setting default location", err);
            setLocationMessage("Could not update default store.");
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

    const handleUseStoreFromSearch = async (store: KrogerLocationSearchResult) => {
        if (!user) return;

        try {
            setSavingLocation(true);
            setLocationMessage(null);

            const locCol = collection(db, "krogerLocations", user.uid, "locations");

            const isFirstLocation = locations.length === 0;

            const docRef = await addDoc(locCol, {
                krogerLocationId: store.locationId,
                name: store.name,
                addressLine1: store.addressLine1 || null,
                city: store.city || null,
                state: store.state || null,
                zip: store.zipCode || null,
                isDefault: true,
                createdAt: serverTimestamp(),
            });

            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                defaultKrogerLocationId: store.locationId,
            });

            const newLocation: UserLocation = {
                id: docRef.id,
                krogerLocationId: store.locationId,
                name: store.name,
                addressLine1: store.addressLine1 || undefined,
                city: store.city || undefined,
                state: store.state || undefined,
                zip: store.zipCode || undefined,
                isDefault: true,
            };

            setLocations((prev) => [
                ...prev.map((loc) => ({ ...loc, isDefault: false })),
                newLocation,
            ]);
            setUserDoc((prev) =>
                prev
                    ? { ...prev, defaultKrogerLocationId: store.locationId }
                    : { defaultKrogerLocationId: store.locationId }
            );

            setStoreResults([]);
            setZipSearch("");

            setLocationMessage(
                isFirstLocation
                    ? `${store.name} saved as your default store.`
                    : `${store.name} saved and set as default.`
            );
        } catch (err) {
            console.error("Error saving location", err);
            setLocationMessage("Something went wrong saving this location.");
        } finally {
            setSavingLocation(false);
        }
    };

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

    const handleEditDietAllergies = () => {
        setSelectedDietType(userDoc?.dietType ?? "");
        setSelectedAllergies(userDoc?.allergiesAndSensitivities?.allergies ?? []);
        setSelectedSensitivities(userDoc?.allergiesAndSensitivities?.sensitivities ?? []);
        setDietAllergiesMessage(null);
        setEditingDietAllergies(true);
    };

    const handleCancelEditDietAllergies = () => {
        setEditingDietAllergies(false);
        setDietAllergiesMessage(null);
    };

    const handleSaveDietAllergies = async () => {
        if (!user) return;

        try {
            setSavingDietAllergies(true);
            setDietAllergiesMessage(null);

            const userRef = doc(db, "users", user.uid);
            await setDoc(
                userRef,
                {
                    dietType: selectedDietType || null,
                    allergiesAndSensitivities: {
                        allergies: selectedAllergies,
                        sensitivities: selectedSensitivities,
                    },
                },
                { merge: true }
            );

            setUserDoc((prev) => ({
                ...prev,
                dietType: selectedDietType || undefined,
                allergiesAndSensitivities: {
                    allergies: selectedAllergies,
                    sensitivities: selectedSensitivities,
                },
            }));

            setEditingDietAllergies(false);
            setDietAllergiesMessage("Dietary preferences updated.");
        } catch (err) {
            console.error("Error saving dietary preferences", err);
            setDietAllergiesMessage("Could not save changes.");
        } finally {
            setSavingDietAllergies(false);
        }
    };

    const handleRemoveDoctorInstructions = async () => {
        if (!user) return;

        try {
            setRemovingDoctorNote(true);
            setDoctorNoteMessage(null);

            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                doctorDietInstructions: null,
            });

            setUserDoc((prev) =>
                prev ? { ...prev, doctorDietInstructions: null } : prev
            );

            setDoctorNoteMessage("Diet instructions removed.");
        } catch (err) {
            console.error("Error removing diet instructions", err);
            setDoctorNoteMessage("Could not remove diet instructions.");
        } finally {
            setRemovingDoctorNote(false);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        router.push("/login");
    };

    const getDietLabel = (value: string | undefined) => {
        if (!value) return null;
        const opt = DIET_OPTIONS.find((o) => o.value === value);
        return opt?.label ?? value;
    };

    const doctor = (userDoc?.doctorDietInstructions ?? null) as DoctorDietInstructions | null;
    const hasDoctorNote = Boolean(doctor?.hasActiveNote);

    if (loadingUser) {
        return (
            <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-3 border-gray-200 border-t-[#4A90E2] rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-500">Loading your account...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center">
                <p className="text-gray-500">Redirecting to login...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafb]">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 px-6 py-6">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-[#4A90E2] to-[#357ABD] rounded-full flex items-center justify-center">
                            <UserIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl lg:text-2xl text-gray-900">
                                {userDoc?.name || "Account"}
                            </h1>
                            <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
                <div className="max-w-3xl mx-auto space-y-4">
                    {/* Usage Card - Free Tier */}
                    {!userDoc?.isPremium && (() => {
                        // Calculate monthly prompt count and days until reset
                        let monthlyCount = userDoc?.monthlyPromptCount ?? 0;
                        let daysUntilReset = 30;

                        if (userDoc?.promptPeriodStart) {
                            const startDate = typeof userDoc.promptPeriodStart.toDate === "function"
                                ? userDoc.promptPeriodStart.toDate()
                                : new Date(userDoc.promptPeriodStart);
                            const now = new Date();

                            if (now.getTime() - startDate.getTime() >= THIRTY_DAYS_MS) {
                                // Period expired
                                monthlyCount = 0;
                                daysUntilReset = 30;
                            } else {
                                const resetDate = new Date(startDate.getTime() + THIRTY_DAYS_MS);
                                daysUntilReset = Math.max(0, Math.ceil((resetDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
                            }
                        }

                        return (
                            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                <div className="px-5 py-4 border-b border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                                            <Zap className="w-5 h-5 text-purple-500" />
                                        </div>
                                        <div>
                                            <h2 className="font-medium text-gray-900">Monthly Usage</h2>
                                            <p className="text-xs text-gray-500">Free tier meal generations</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="px-5 py-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm text-gray-700">Meal generations used</span>
                                        <span className="text-sm font-medium text-gray-900">
                                            {monthlyCount} / {FREE_TIER_MONTHLY_LIMIT}
                                        </span>
                                    </div>
                                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${
                                                monthlyCount >= FREE_TIER_MONTHLY_LIMIT
                                                    ? "bg-red-500"
                                                    : monthlyCount >= FREE_TIER_MONTHLY_LIMIT * 0.8
                                                    ? "bg-amber-500"
                                                    : "bg-purple-500"
                                            }`}
                                            style={{ width: `${Math.min((monthlyCount / FREE_TIER_MONTHLY_LIMIT) * 100, 100)}%` }}
                                        />
                                    </div>
                                    {monthlyCount >= FREE_TIER_MONTHLY_LIMIT ? (
                                        <p className="text-sm text-red-600 mt-3">
                                            You've used all free prompts for this month. Resets in {daysUntilReset} day{daysUntilReset !== 1 ? "s" : ""}.
                                        </p>
                                    ) : monthlyCount >= FREE_TIER_MONTHLY_LIMIT * 0.8 ? (
                                        <p className="text-sm text-amber-600 mt-3">
                                            {FREE_TIER_MONTHLY_LIMIT - monthlyCount} generation{FREE_TIER_MONTHLY_LIMIT - monthlyCount !== 1 ? "s" : ""} remaining. Resets in {daysUntilReset} day{daysUntilReset !== 1 ? "s" : ""}.
                                        </p>
                                    ) : (
                                        <p className="text-sm text-gray-500 mt-3">
                                            {FREE_TIER_MONTHLY_LIMIT - monthlyCount} generation{FREE_TIER_MONTHLY_LIMIT - monthlyCount !== 1 ? "s" : ""} remaining. Resets in {daysUntilReset} day{daysUntilReset !== 1 ? "s" : ""}.
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Diet & Allergies Card */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                                    <Heart className="w-5 h-5 text-emerald-500" />
                                </div>
                                <div>
                                    <h2 className="font-medium text-gray-900">Diet & Allergies</h2>
                                    <p className="text-xs text-gray-500">Personalize your meal suggestions</p>
                                </div>
                            </div>
                            {!editingDietAllergies && (
                                <button
                                    onClick={handleEditDietAllergies}
                                    className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
                                >
                                    <Edit3 className="w-4 h-4 text-gray-400" />
                                </button>
                            )}
                        </div>

                        <div className="px-5 py-4">
                            {!editingDietAllergies ? (
                                <div className="space-y-3">
                                    <div>
                                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Diet Focus</span>
                                        <p className="text-sm text-gray-900 mt-0.5">
                                            {getDietLabel(userDoc?.dietType) || "Not set"}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Allergies</span>
                                        <p className="text-sm text-gray-900 mt-0.5">
                                            {userDoc?.allergiesAndSensitivities?.allergies?.length
                                                ? userDoc.allergiesAndSensitivities.allergies.join(", ")
                                                : "None"}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sensitivities</span>
                                        <p className="text-sm text-gray-900 mt-0.5">
                                            {userDoc?.allergiesAndSensitivities?.sensitivities?.length
                                                ? userDoc.allergiesAndSensitivities.sensitivities.join(", ")
                                                : "None"}
                                        </p>
                                    </div>
                                    {dietAllergiesMessage && (
                                        <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg">
                                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                                            <span className="text-sm text-emerald-700">{dietAllergiesMessage}</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">Diet Focus</label>
                                        <select
                                            value={selectedDietType}
                                            onChange={(e) => setSelectedDietType(e.target.value)}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:border-[#4A90E2] focus:outline-none"
                                        >
                                            <option value="">None</option>
                                            {DIET_OPTIONS.map((opt) => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">Allergies</label>
                                        <div className="flex flex-wrap gap-2">
                                            {ALLERGY_OPTIONS.map((item) => (
                                                <button
                                                    key={item}
                                                    type="button"
                                                    onClick={() => toggleAllergy(item)}
                                                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                                        selectedAllergies.includes(item)
                                                            ? "bg-[#4A90E2] text-white"
                                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                    }`}
                                                >
                                                    {item}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">Sensitivities</label>
                                        <div className="flex flex-wrap gap-2">
                                            {SENSITIVITY_OPTIONS.map((item) => (
                                                <button
                                                    key={item}
                                                    type="button"
                                                    onClick={() => toggleSensitivity(item)}
                                                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                                        selectedSensitivities.includes(item)
                                                            ? "bg-[#4A90E2] text-white"
                                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                    }`}
                                                >
                                                    {item}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={() => void handleSaveDietAllergies()}
                                            disabled={savingDietAllergies}
                                            className="flex-1 py-3 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white rounded-xl font-medium disabled:opacity-70"
                                        >
                                            {savingDietAllergies ? "Saving..." : "Save Changes"}
                                        </button>
                                        <button
                                            onClick={handleCancelEditDietAllergies}
                                            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Diet Instructions Card */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-blue-500" />
                                </div>
                                <div>
                                    <h2 className="font-medium text-gray-900">Diet Instructions</h2>
                                    <p className="text-xs text-gray-500">From your healthcare provider</p>
                                </div>
                            </div>
                            {hasDoctorNote && (
                                <button
                                    onClick={() => router.push("/doctor-note")}
                                    className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
                                >
                                    <Edit3 className="w-4 h-4 text-gray-400" />
                                </button>
                            )}
                        </div>

                        <div className="px-5 py-4">
                            {!hasDoctorNote ? (
                                <div>
                                    <p className="text-sm text-gray-500 mb-4">
                                        Upload your doctor's diet instructions to automatically filter meal suggestions.
                                    </p>
                                    <button
                                        onClick={() => router.push("/doctor-note")}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-[#4A90E2]/10 text-[#4A90E2] rounded-xl text-sm font-medium hover:bg-[#4A90E2]/20 transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span>Add Diet Instructions</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                                        <span className="text-sm font-medium text-emerald-700">Active</span>
                                        {doctor?.updatedAt && (
                                            <span className="text-xs text-gray-400">
                                                • Updated {formatDoctorUpdatedAt(doctor.updatedAt)}
                                            </span>
                                        )}
                                    </div>

                                    {doctor?.summaryText && (
                                        <p className="text-sm text-gray-600">{doctor.summaryText}</p>
                                    )}

                                    {doctor?.blockedIngredients && doctor.blockedIngredients.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {doctor.blockedIngredients.map((item) => (
                                                <span
                                                    key={item}
                                                    className="px-2 py-1 bg-red-50 text-red-700 rounded-lg text-xs"
                                                >
                                                    {item}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <button
                                        onClick={() => void handleRemoveDoctorInstructions()}
                                        disabled={removingDoctorNote}
                                        className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span>{removingDoctorNote ? "Removing..." : "Remove"}</span>
                                    </button>

                                    {doctorNoteMessage && (
                                        <p className="text-sm text-gray-500">{doctorNoteMessage}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Kroger Account Card */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#0056a3]/10 rounded-xl flex items-center justify-center">
                                    <ShoppingCart className="w-5 h-5 text-[#0056a3]" />
                                </div>
                                <div>
                                    <h2 className="font-medium text-gray-900">Kroger Account</h2>
                                    <p className="text-xs text-gray-500">Connect to add items to cart</p>
                                </div>
                            </div>
                        </div>

                        <div className="px-5 py-4">
                            {userDoc?.krogerLinked ? (
                                <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl">
                                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                                    <span className="text-sm text-emerald-700">Your Kroger account is linked</span>
                                </div>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (user) {
                                            window.location.href = `/api/kroger/auth?userId=${user.uid}`;
                                        }
                                    }}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-[#0056a3] text-white rounded-xl text-sm font-medium hover:bg-[#004080] transition-colors"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    <span>Link Kroger Account</span>
                                </button>
                            )}

                            {krogerMessage && (
                                <div
                                    className={`mt-3 flex items-center gap-2 p-3 rounded-xl ${
                                        krogerMessageType === "success"
                                            ? "bg-emerald-50"
                                            : "bg-red-50"
                                    }`}
                                >
                                    {krogerMessageType === "success" ? (
                                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                                    ) : (
                                        <AlertCircle className="w-5 h-5 text-red-500" />
                                    )}
                                    <span
                                        className={`text-sm ${
                                            krogerMessageType === "success"
                                                ? "text-emerald-700"
                                                : "text-red-700"
                                        }`}
                                    >
                                        {krogerMessage}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Shopping Locations Card */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                                    <MapPin className="w-5 h-5 text-orange-500" />
                                </div>
                                <div>
                                    <h2 className="font-medium text-gray-900">Shopping Locations</h2>
                                    <p className="text-xs text-gray-500">Your preferred Kroger stores</p>
                                </div>
                            </div>
                        </div>

                        <div className="px-5 py-4 space-y-4">
                            {/* Existing locations */}
                            {loadingLocations ? (
                                <p className="text-sm text-gray-500">Loading locations...</p>
                            ) : locations.length === 0 ? (
                                <p className="text-sm text-gray-500">No stores added yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {locations.map((loc) => (
                                        <div
                                            key={loc.id}
                                            className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                                        >
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-gray-900 text-sm">{loc.name}</span>
                                                    {loc.isDefault && (
                                                        <span className="px-2 py-0.5 bg-[#4A90E2]/10 text-[#4A90E2] rounded text-xs font-medium">
                                                            Default
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    {loc.city && loc.state && `${loc.city}, ${loc.state}`}
                                                </p>
                                            </div>
                                            {!loc.isDefault && (
                                                <button
                                                    onClick={() => void handleSetDefault(loc)}
                                                    className="text-xs text-[#4A90E2] hover:underline"
                                                >
                                                    Set default
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* ZIP Search */}
                            <div className="pt-3 border-t border-gray-100">
                                <label className="text-sm font-medium text-gray-700 mb-2 block">
                                    Find a store by ZIP
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        value={zipSearch}
                                        onChange={(e) => setZipSearch(e.target.value)}
                                        placeholder="Enter ZIP code"
                                        className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:border-[#4A90E2] focus:outline-none"
                                    />
                                    <button
                                        onClick={() => void handleSearchStoresByZip()}
                                        disabled={searchingStores}
                                        className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-70"
                                    >
                                        {searchingStores ? "..." : "Search"}
                                    </button>
                                </div>

                                {storeSearchError && (
                                    <p className="text-sm text-red-500 mt-2">{storeSearchError}</p>
                                )}

                                {storeResults.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {storeResults.map((store) => (
                                            <div
                                                key={store.locationId}
                                                className="flex items-center justify-between p-3 border border-gray-200 rounded-xl"
                                            >
                                                <div>
                                                    <span className="font-medium text-gray-900 text-sm">{store.name}</span>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        {store.addressLine1}, {store.city}, {store.state}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleUseStoreFromSearch(store)}
                                                    disabled={savingLocation}
                                                    className="px-3 py-1.5 bg-[#4A90E2]/10 text-[#4A90E2] rounded-lg text-xs font-medium hover:bg-[#4A90E2]/20 transition-colors disabled:opacity-70"
                                                >
                                                    {savingLocation ? "..." : "Use"}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {locationMessage && (
                                <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg">
                                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                                    <span className="text-sm text-emerald-700">{locationMessage}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Logout Button - Mobile only */}
                    <button
                        onClick={handleLogout}
                        className="lg:hidden w-full py-4 bg-white border border-gray-200 text-red-500 rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
