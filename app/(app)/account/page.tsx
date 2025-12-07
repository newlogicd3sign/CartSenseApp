"use client";

import { Suspense, useEffect, useState } from "react";
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
    Heart,
    AlertTriangle,
    FileText,
    ShoppingCart,
    CheckCircle,
    AlertCircle,
    Edit3,
    X,
    Trash2,
    Plus,
    ExternalLink,
    LogOut,
    Zap,
    Lock,
    Eye,
    EyeOff,
    Sparkles,
    CreditCard,
} from "lucide-react";
import { signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from "firebase/auth";
import { deleteDoc } from "firebase/firestore";
import { useToast } from "@/components/Toast";
import { getStoreBrand } from "@/lib/utils";

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
    dislikedFoods?: string[];
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

function AccountPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToast();

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
    const [selectedDislikedFoods, setSelectedDislikedFoods] = useState<string[]>([]);
    const [customDislikedFood, setCustomDislikedFood] = useState("");
    const [savingDietAllergies, setSavingDietAllergies] = useState(false);

    const [removingDoctorNote, setRemovingDoctorNote] = useState(false);

    // Kroger profile state
    const [krogerProfile, setKrogerProfile] = useState<{ firstName?: string; lastName?: string } | null>(null);
    const [loadingKrogerProfile, setLoadingKrogerProfile] = useState(false);
    const [unlinkingKroger, setUnlinkingKroger] = useState(false);

    // Password change state
    const [editingPassword, setEditingPassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
    const [passwordMessageType, setPasswordMessageType] = useState<"success" | "error">("success");

    // Delete account state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState("");
    const [showDeletePassword, setShowDeletePassword] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Subscription portal state
    const [loadingPortal, setLoadingPortal] = useState(false);

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
            showToast("Your Kroger account has been linked successfully!", "success");
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
            showToast(errorMessages[krogerError] || "Failed to link Kroger account.", "error");
            router.replace("/account");
        }
    }, [searchParams, router, showToast]);

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

    // Fetch Kroger profile when linked
    useEffect(() => {
        if (!user || !userDoc?.krogerLinked) {
            setKrogerProfile(null);
            return;
        }

        const fetchKrogerProfile = async () => {
            setLoadingKrogerProfile(true);
            try {
                const res = await fetch(`/api/kroger/profile?userId=${user.uid}`);
                if (res.ok) {
                    const data = await res.json();
                    setKrogerProfile(data);
                } else {
                    // If 401, the account was unlinked due to expired tokens
                    if (res.status === 401) {
                        setUserDoc((prev) => prev ? { ...prev, krogerLinked: false } : prev);
                    }
                    setKrogerProfile(null);
                }
            } catch (err) {
                console.error("Error fetching Kroger profile:", err);
                setKrogerProfile(null);
            } finally {
                setLoadingKrogerProfile(false);
            }
        };

        void fetchKrogerProfile();
    }, [user, userDoc?.krogerLinked]);

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

                // Detect stale defaultKrogerLocationId - if user has a defaultKrogerLocationId
                // but no locations in the subcollection, clear it
                if (userDoc?.defaultKrogerLocationId && locs.length === 0) {
                    console.log("Detected stale defaultKrogerLocationId, clearing...");
                    const userRef = doc(db, "users", user.uid);
                    await updateDoc(userRef, {
                        defaultKrogerLocationId: null,
                    });
                    setUserDoc((prev) =>
                        prev ? { ...prev, defaultKrogerLocationId: null } : prev
                    );
                }
                // Also check if defaultKrogerLocationId doesn't match any existing location
                else if (userDoc?.defaultKrogerLocationId && locs.length > 0) {
                    const matchingLoc = locs.find(
                        (loc) => loc.krogerLocationId === userDoc.defaultKrogerLocationId
                    );
                    if (!matchingLoc) {
                        console.log("defaultKrogerLocationId doesn't match any location, updating to first location...");
                        const newDefault = locs[0];
                        const userRef = doc(db, "users", user.uid);
                        await updateDoc(userRef, {
                            defaultKrogerLocationId: newDefault.krogerLocationId,
                        });
                        setUserDoc((prev) =>
                            prev ? { ...prev, defaultKrogerLocationId: newDefault.krogerLocationId } : prev
                        );
                        // Also update the location's isDefault flag
                        const locRef = doc(db, "krogerLocations", user.uid, "locations", newDefault.id);
                        await updateDoc(locRef, { isDefault: true });
                        setLocations((prev) =>
                            prev.map((l) => ({ ...l, isDefault: l.id === newDefault.id }))
                        );
                    }
                }
            } catch (err) {
                console.error("Error loading locations", err);
                setLocations([]);
            } finally {
                setLoadingLocations(false);
            }
        };

        void loadLocations();
    }, [user, userDoc?.defaultKrogerLocationId]);

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

    const handleRemoveStore = async (loc: UserLocation) => {
        if (!user) return;

        try {
            setLocationMessage(null);

            const locRef = doc(db, "krogerLocations", user.uid, "locations", loc.id);
            await deleteDoc(locRef);

            const remainingLocations = locations.filter((l) => l.id !== loc.id);

            // Check if the deleted store was the default (either by isDefault flag or by matching defaultKrogerLocationId)
            const wasDefault = loc.isDefault || loc.krogerLocationId === userDoc?.defaultKrogerLocationId;

            if (wasDefault && remainingLocations.length > 0) {
                const newDefault = remainingLocations[0];
                const userRef = doc(db, "users", user.uid);
                await updateDoc(userRef, {
                    defaultKrogerLocationId: newDefault.krogerLocationId,
                });

                const newDefaultRef = doc(db, "krogerLocations", user.uid, "locations", newDefault.id);
                await updateDoc(newDefaultRef, { isDefault: true });

                setLocations(
                    remainingLocations.map((l, idx) => ({
                        ...l,
                        isDefault: idx === 0,
                    }))
                );
                setUserDoc((prev) =>
                    prev
                        ? { ...prev, defaultKrogerLocationId: newDefault.krogerLocationId }
                        : { defaultKrogerLocationId: newDefault.krogerLocationId }
                );
                setLocationMessage(`${loc.name} removed. ${newDefault.name} is now your default.`);
            } else if (wasDefault || remainingLocations.length === 0) {
                // Clear defaultKrogerLocationId if no stores remain or if default was deleted
                const userRef = doc(db, "users", user.uid);
                await updateDoc(userRef, {
                    defaultKrogerLocationId: null,
                });
                setLocations(remainingLocations);
                setUserDoc((prev) =>
                    prev ? { ...prev, defaultKrogerLocationId: null } : { defaultKrogerLocationId: null }
                );
                setLocationMessage(`${loc.name} removed.`);
            } else {
                setLocations(remainingLocations);
                setLocationMessage(`${loc.name} removed.`);
            }
        } catch (err) {
            console.error("Error removing location", err);
            setLocationMessage("Could not remove store.");
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

        // Check if this store already exists
        const existingStore = locations.find(
            (loc) => loc.krogerLocationId === store.locationId
        );
        if (existingStore) {
            showToast(`${store.name} is already in your saved stores.`, "error");
            return;
        }

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

    const handleEditDietAllergies = () => {
        setSelectedDietType(userDoc?.dietType ?? "");
        setSelectedAllergies(userDoc?.allergiesAndSensitivities?.allergies ?? []);
        setSelectedSensitivities(userDoc?.allergiesAndSensitivities?.sensitivities ?? []);
        setSelectedDislikedFoods(userDoc?.dislikedFoods ?? []);
        setCustomDislikedFood("");
        setEditingDietAllergies(true);
    };

    const handleCancelEditDietAllergies = () => {
        setEditingDietAllergies(false);
    };

    const handleSaveDietAllergies = async () => {
        if (!user) return;

        try {
            setSavingDietAllergies(true);

            const userRef = doc(db, "users", user.uid);
            await setDoc(
                userRef,
                {
                    dietType: selectedDietType || null,
                    allergiesAndSensitivities: {
                        allergies: selectedAllergies,
                        sensitivities: selectedSensitivities,
                    },
                    dislikedFoods: selectedDislikedFoods,
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
                dislikedFoods: selectedDislikedFoods,
            }));

            setEditingDietAllergies(false);
            showToast("Dietary preferences updated.", "success");
        } catch (err) {
            console.error("Error saving dietary preferences", err);
            showToast("Could not save changes.", "error");
        } finally {
            setSavingDietAllergies(false);
        }
    };

    const handleRemoveDoctorInstructions = async () => {
        if (!user) return;

        try {
            setRemovingDoctorNote(true);

            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                doctorDietInstructions: null,
            });

            setUserDoc((prev) =>
                prev ? { ...prev, doctorDietInstructions: null } : prev
            );

            showToast("Diet instructions removed.", "success");
        } catch (err) {
            console.error("Error removing diet instructions", err);
            showToast("Could not remove diet instructions.", "error");
        } finally {
            setRemovingDoctorNote(false);
        }
    };

    const handleUnlinkKroger = async () => {
        if (!user) return;

        try {
            setUnlinkingKroger(true);

            const res = await fetch("/api/kroger/unlink", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.uid }),
            });

            if (res.ok) {
                setUserDoc((prev) => prev ? { ...prev, krogerLinked: false } : prev);
                setKrogerProfile(null);
                showToast("Your Kroger account has been unlinked.", "success");
            } else {
                showToast("Failed to unlink Kroger account. Please try again.", "error");
            }
        } catch (err) {
            console.error("Error unlinking Kroger:", err);
            showToast("Something went wrong. Please try again.", "error");
        } finally {
            setUnlinkingKroger(false);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        router.push("/login");
    };

    const handleManageSubscription = async () => {
        if (!user) return;

        try {
            setLoadingPortal(true);
            const res = await fetch("/api/stripe/portal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uid: user.uid }),
            });

            const data = await res.json();

            if (data.url) {
                window.location.href = data.url;
            } else {
                showToast("Could not open billing portal.", "error");
            }
        } catch (error) {
            console.error("Portal error:", error);
            showToast("Something went wrong. Please try again.", "error");
        } finally {
            setLoadingPortal(false);
        }
    };

    const handleChangePassword = async () => {
        if (!user || !user.email) return;

        // Validation
        if (newPassword.length < 6) {
            setPasswordMessage("New password must be at least 6 characters.");
            setPasswordMessageType("error");
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordMessage("New passwords do not match.");
            setPasswordMessageType("error");
            return;
        }

        try {
            setSavingPassword(true);
            setPasswordMessage(null);

            // Re-authenticate the user first
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);

            // Update the password
            await updatePassword(user, newPassword);

            setPasswordMessage("Password updated successfully.");
            setPasswordMessageType("success");
            setEditingPassword(false);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (error: any) {
            if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
                setPasswordMessage("Current password is incorrect.");
            } else if (error.code === "auth/weak-password") {
                setPasswordMessage("New password is too weak. Please choose a stronger password.");
            } else if (error.code === "auth/requires-recent-login") {
                setPasswordMessage("Please log out and log back in before changing your password.");
            } else {
                setPasswordMessage(error.message || "Failed to change password.");
            }
            setPasswordMessageType("error");
        } finally {
            setSavingPassword(false);
        }
    };

    const handleCancelEditPassword = () => {
        setEditingPassword(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPasswordMessage(null);
    };

    const handleDeleteAccount = async () => {
        if (!user || !user.email) return;

        try {
            setDeletingAccount(true);
            setDeleteError(null);

            // Re-authenticate the user first
            const credential = EmailAuthProvider.credential(user.email, deletePassword);
            await reauthenticateWithCredential(user, credential);

            // Delete user document from Firestore
            await deleteDoc(doc(db, "users", user.uid));

            // Delete the Firebase Auth user
            await deleteUser(user);

            // Redirect to login
            router.push("/login");
        } catch (error: any) {
            if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
                setDeleteError("Incorrect password. Please try again.");
            } else if (error.code === "auth/requires-recent-login") {
                setDeleteError("Please log out and log back in before deleting your account.");
            } else {
                setDeleteError(error.message || "Failed to delete account.");
            }
        } finally {
            setDeletingAccount(false);
        }
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
                    {/* Premium Subscription Card */}
                    {userDoc?.isPremium && (
                        <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl border border-violet-200 overflow-hidden">
                            <div className="px-5 py-4 border-b border-violet-200">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                                        <Sparkles className="w-5 h-5 text-violet-600" />
                                    </div>
                                    <div>
                                        <h2 className="font-medium text-violet-900">Premium Subscription</h2>
                                        <p className="text-xs text-violet-600">You have full access to all features</p>
                                    </div>
                                </div>
                            </div>

                            <div className="px-5 py-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                                    <span className="text-sm text-violet-800">Your subscription is active</span>
                                </div>

                                <button
                                    onClick={() => void handleManageSubscription()}
                                    disabled={loadingPortal}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-70"
                                >
                                    {loadingPortal ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Loading...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CreditCard className="w-4 h-4" />
                                            <span>Manage Subscription</span>
                                        </>
                                    )}
                                </button>
                                <p className="text-xs text-violet-500 mt-3">
                                    Update payment method, view invoices, or cancel subscription
                                </p>
                            </div>
                        </div>
                    )}

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

                                    {/* Upgrade CTA */}
                                    <button
                                        onClick={() => router.push("/upgrade")}
                                        className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-violet-700 hover:to-purple-700 transition-colors"
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        <span>Upgrade to Premium</span>
                                    </button>
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
                                    <div>
                                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Food Dislikes</span>
                                        <p className="text-sm text-gray-900 mt-0.5">
                                            {userDoc?.dislikedFoods?.length
                                                ? userDoc.dislikedFoods.join(", ")
                                                : "None"}
                                        </p>
                                    </div>
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

                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">Food Dislikes</label>
                                        <div className="flex flex-wrap gap-2">
                                            {COMMON_DISLIKED_FOODS.map((item) => (
                                                <button
                                                    key={item}
                                                    type="button"
                                                    onClick={() => toggleDislikedFood(item)}
                                                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                                        selectedDislikedFoods.includes(item)
                                                            ? "bg-[#4A90E2] text-white"
                                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                    }`}
                                                >
                                                    {item}
                                                </button>
                                            ))}
                                        </div>
                                        {/* Custom food input */}
                                        <div className="flex gap-2 mt-3">
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
                                                placeholder="Add custom food..."
                                                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:border-[#4A90E2] focus:outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={addCustomDislikedFood}
                                                disabled={!customDislikedFood.trim()}
                                                className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Add
                                            </button>
                                        </div>
                                        {/* Show custom selections */}
                                        {selectedDislikedFoods.filter(f => !COMMON_DISLIKED_FOODS.includes(f)).length > 0 && (
                                            <div className="mt-3">
                                                <p className="text-xs text-gray-500 mb-2">Your additions:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedDislikedFoods
                                                        .filter(f => !COMMON_DISLIKED_FOODS.includes(f))
                                                        .map((item) => (
                                                            <button
                                                                key={item}
                                                                type="button"
                                                                onClick={() => toggleDislikedFood(item)}
                                                                className="px-3 py-1.5 rounded-lg text-sm bg-[#4A90E2] text-white"
                                                            >
                                                                {item}
                                                            </button>
                                                        ))}
                                                </div>
                                            </div>
                                        )}
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
                                    onClick={() => router.push("/diet-restrictions")}
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
                                        Upload your diet instructions to automatically filter meal suggestions.
                                    </p>
                                    <button
                                        onClick={() => router.push("/diet-restrictions")}
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
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Store & Account Card - Combined */}
                    {(() => {
                        const defaultLocation = locations.find(loc => loc.krogerLocationId === userDoc?.defaultKrogerLocationId);
                        const storeBrand = defaultLocation ? getStoreBrand(defaultLocation.name) : { displayName: "Kroger", tagline: "Kroger Family of Stores" };
                        const isGenericKroger = !defaultLocation;
                        return (
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#0056a3]/10 rounded-xl flex items-center justify-center">
                                    <ShoppingCart className="w-5 h-5 text-[#0056a3]" />
                                </div>
                                <div>
                                    <h2 className="font-medium text-gray-900">
                                        {isGenericKroger ? "Store & Account" : `${storeBrand.displayName} Store & Account`}
                                    </h2>
                                    <p className="text-xs text-gray-500">Choose your store and connect your account to add items directly to your cart</p>
                                </div>
                            </div>
                        </div>

                        <div className="px-5 py-4 space-y-5">
                            {/* Supported stores info when no store selected */}
                            {locations.length === 0 && (
                                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                                    <p className="text-xs font-medium text-blue-800 mb-1">Kroger Family of Stores</p>
                                    <p className="text-xs text-blue-700 leading-relaxed">
                                        Kroger, Ralphs, Fred Meyer, King Soopers, Fry&apos;s, Smith&apos;s, Dillons, QFC, Harris Teeter, Pick &apos;n Save, Mariano&apos;s, Food 4 Less, City Market, Baker&apos;s, and more
                                    </p>
                                </div>
                            )}

                            {/* Step 1: Store Selection */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                        locations.length > 0 ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"
                                    }`}>
                                        {locations.length > 0 ? <CheckCircle className="w-4 h-4" /> : "1"}
                                    </div>
                                    <span className="text-sm font-medium text-gray-900">Choose Your Store</span>
                                </div>

                                {/* Existing locations */}
                                {loadingLocations ? (
                                    <p className="text-sm text-gray-500 ml-8">Loading locations...</p>
                                ) : locations.length === 0 ? (
                                    <p className="text-sm text-gray-500 ml-8">Search below to find and add your store.</p>
                                ) : (
                                    <div className="space-y-2 ml-8">
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
                                                <div className="flex items-center gap-2">
                                                    {!loc.isDefault && (
                                                        <button
                                                            onClick={() => void handleSetDefault(loc)}
                                                            className="text-xs text-[#4A90E2] hover:underline"
                                                        >
                                                            Set default
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => void handleRemoveStore(loc)}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Remove store"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* ZIP Search */}
                                <div className="mt-3 ml-8">
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                                        Find a store by ZIP
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            value={zipSearch}
                                            onChange={(e) => setZipSearch(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    void handleSearchStoresByZip();
                                                }
                                            }}
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
                                    <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg mt-3 ml-8">
                                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                                        <span className="text-sm text-emerald-700">{locationMessage}</span>
                                    </div>
                                )}
                            </div>

                            {/* Divider */}
                            <div className="border-t border-gray-100" />

                            {/* Step 2: Account Linking */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                        userDoc?.krogerLinked ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"
                                    }`}>
                                        {userDoc?.krogerLinked ? <CheckCircle className="w-4 h-4" /> : "2"}
                                    </div>
                                    <span className="text-sm font-medium text-gray-900">Connect Your Account</span>
                                </div>

                                <div className="ml-8">
                                    {userDoc?.krogerLinked ? (
                                        <div className="space-y-3">
                                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full">
                                                <CheckCircle className="w-4 h-4" />
                                                <span className="text-sm font-medium">
                                                    {isGenericKroger ? "Store account linked" : `${storeBrand.displayName} account linked`}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => void handleUnlinkKroger()}
                                                disabled={unlinkingKroger}
                                                className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                                <span>{unlinkingKroger ? "Unlinking..." : `Unlink ${isGenericKroger ? "Store" : storeBrand.displayName} Account`}</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <p className="text-sm text-gray-500">
                                                Link your account to add items directly to your cart and see real prices.
                                            </p>
                                            <button
                                                onClick={() => {
                                                    if (user) {
                                                        window.location.href = `/api/kroger/auth?userId=${user.uid}`;
                                                    }
                                                }}
                                                className="flex items-center gap-2 px-4 py-2.5 bg-[#0056a3] text-white rounded-xl text-sm font-medium hover:bg-[#004080] transition-colors"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                <span>Link {isGenericKroger ? "Store" : storeBrand.displayName} Account</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                        );
                    })()}

                    {/* Password & Security Card */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                                    <Lock className="w-5 h-5 text-gray-500" />
                                </div>
                                <div>
                                    <h2 className="font-medium text-gray-900">Password & Security</h2>
                                    <p className="text-xs text-gray-500">Manage your account security</p>
                                </div>
                            </div>
                            {!editingPassword && (
                                <button
                                    onClick={() => {
                                        setEditingPassword(true);
                                        setPasswordMessage(null);
                                    }}
                                    className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
                                >
                                    <Edit3 className="w-4 h-4 text-gray-400" />
                                </button>
                            )}
                        </div>

                        <div className="px-5 py-4">
                            {!editingPassword ? (
                                <div className="space-y-3">
                                    <div>
                                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Password</span>
                                        <p className="text-sm text-gray-900 mt-0.5">••••••••</p>
                                    </div>
                                    {passwordMessage && (
                                        <div className={`flex items-center gap-2 p-2 rounded-lg ${
                                            passwordMessageType === "success" ? "bg-emerald-50" : "bg-red-50"
                                        }`}>
                                            {passwordMessageType === "success" ? (
                                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                                            ) : (
                                                <AlertCircle className="w-4 h-4 text-red-500" />
                                            )}
                                            <span className={`text-sm ${
                                                passwordMessageType === "success" ? "text-emerald-700" : "text-red-700"
                                            }`}>{passwordMessage}</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Current Password */}
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">Current Password</label>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type={showCurrentPassword ? "text" : "password"}
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                placeholder="Enter current password"
                                                className="w-full pl-11 pr-11 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#4A90E2] focus:outline-none focus:bg-white transition-colors"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* New Password */}
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">New Password</label>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type={showNewPassword ? "text" : "password"}
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder="Enter new password"
                                                className="w-full pl-11 pr-11 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#4A90E2] focus:outline-none focus:bg-white transition-colors"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1.5 ml-1">Must be at least 6 characters</p>
                                    </div>

                                    {/* Confirm New Password */}
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">Confirm New Password</label>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type={showNewPassword ? "text" : "password"}
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="Confirm new password"
                                                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#4A90E2] focus:outline-none focus:bg-white transition-colors"
                                            />
                                        </div>
                                    </div>

                                    {/* Error/Success Message */}
                                    {passwordMessage && (
                                        <div className={`flex items-start gap-2 p-3 rounded-xl ${
                                            passwordMessageType === "success"
                                                ? "bg-emerald-50 border border-emerald-100"
                                                : "bg-red-50 border border-red-100"
                                        }`}>
                                            {passwordMessageType === "success" ? (
                                                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                            ) : (
                                                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                            )}
                                            <p className={`text-sm ${
                                                passwordMessageType === "success" ? "text-emerald-600" : "text-red-600"
                                            }`}>{passwordMessage}</p>
                                        </div>
                                    )}

                                    {/* Buttons */}
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={() => void handleChangePassword()}
                                            disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                                            className="flex-1 py-3 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white rounded-xl font-medium disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {savingPassword ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    <span>Updating...</span>
                                                </>
                                            ) : (
                                                "Update Password"
                                            )}
                                        </button>
                                        <button
                                            onClick={handleCancelEditPassword}
                                            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Delete Account Card */}
                    <div className="bg-white rounded-2xl border border-red-100 overflow-hidden">
                        <div className="px-5 py-4 border-b border-red-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                                    <AlertTriangle className="w-5 h-5 text-red-500" />
                                </div>
                                <div>
                                    <h2 className="font-medium text-gray-900">Delete Account</h2>
                                    <p className="text-xs text-gray-500">Permanently remove your account and data</p>
                                </div>
                            </div>
                        </div>

                        <div className="px-5 py-4">
                            {!showDeleteConfirm ? (
                                <div>
                                    <p className="text-sm text-gray-500 mb-4">
                                        Once you delete your account, there is no going back. All your data will be permanently removed.
                                    </p>
                                    <button
                                        onClick={() => {
                                            setShowDeleteConfirm(true);
                                            setDeletePassword("");
                                            setDeleteError(null);
                                        }}
                                        className="px-4 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors"
                                    >
                                        Delete My Account
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                                        <p className="text-sm text-red-700 font-medium">
                                            Are you sure? This action cannot be undone.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                                            Enter your password to confirm
                                        </label>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type={showDeletePassword ? "text" : "password"}
                                                value={deletePassword}
                                                onChange={(e) => setDeletePassword(e.target.value)}
                                                placeholder="Enter your password"
                                                className="w-full pl-11 pr-11 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-red-400 focus:outline-none focus:bg-white transition-colors"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowDeletePassword(!showDeletePassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                            >
                                                {showDeletePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {deleteError && (
                                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                            <p className="text-sm text-red-600">{deleteError}</p>
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => void handleDeleteAccount()}
                                            disabled={deletingAccount || !deletePassword}
                                            className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:bg-red-700 transition-colors"
                                        >
                                            {deletingAccount ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    <span>Deleting...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Trash2 className="w-4 h-4" />
                                                    <span>Delete Account</span>
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowDeleteConfirm(false);
                                                setDeletePassword("");
                                                setShowDeletePassword(false);
                                                setDeleteError(null);
                                            }}
                                            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
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

export default function AccountPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-10 h-10 border-3 border-gray-200 border-t-[#4A90E2] rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-gray-500">Loading your account...</p>
                    </div>
                </div>
            }
        >
            <AccountPageContent />
        </Suspense>
    );
}
