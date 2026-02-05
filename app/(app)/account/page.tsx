"use client";

import Image from "next/image";
import { Browser } from "@capacitor/browser";
import InstacartCarrot from "@/app/🥕 Instacart Logos/Logos - Carrot/RGB/PNG/Instacart_Carrot.png";
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
    Users,
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
    ToggleLeft,
    ToggleRight,
    ChevronDown,
    ChevronUp,
    Search,
    Mail,
    Store,
} from "lucide-react";
import { signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from "firebase/auth";
import { deleteDoc } from "firebase/firestore";
import { useToast } from "@/components/Toast";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Modal } from "@/components/Modal";
import { StoreSearchModal } from "@/components/StoreSearchModal";
import { InstacartRetailerModal, type InstacartRetailer } from "@/components/InstacartRetailerModal";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { getStoreBrand } from "@/lib/utils";
import { warmLocationInBackground } from "@/lib/product-engine/krogerWarm";
import type { FamilyMember } from "@/types/family";

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

type DietRestrictions = {
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
    cookingExperience?: string;
    allergiesAndSensitivities?: {
        allergies?: string[];
        sensitivities?: string[];
    };
    dislikedFoods?: string[];
    defaultKrogerLocationId?: string | null;
    krogerLinked?: boolean;
    shoppingPreference?: "kroger" | "instacart";
    dietRestrictions?: DietRestrictions | null;
    monthlyPromptCount?: number;
    promptPeriodStart?: any;
    isPremium?: boolean;
    planType?: "free" | "individual" | "family";
};

const FREE_TIER_MONTHLY_LIMIT = 10;
const INDIVIDUAL_MONTHLY_LIMIT = 1000;
const FAMILY_MONTHLY_LIMIT = 1500;
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

// Check if running in Capacitor
const isCapacitor = () => {
    if (typeof window === "undefined") return false;
    return (window as any).Capacitor?.isNativePlatform?.() ?? false;
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

    const [editingDietAllergies, setEditingDietAllergies] = useState(false);
    const [selectedDietType, setSelectedDietType] = useState("");
    const [selectedCookingExperience, setSelectedCookingExperience] = useState("");
    const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
    const [selectedSensitivities, setSelectedSensitivities] = useState<string[]>([]);
    const [selectedDislikedFoods, setSelectedDislikedFoods] = useState<string[]>([]);
    const [customDislikedFood, setCustomDislikedFood] = useState("");
    const [customAllergy, setCustomAllergy] = useState("");
    const [customSensitivity, setCustomSensitivity] = useState("");
    const [savingDietAllergies, setSavingDietAllergies] = useState(false);

    const [removingDietRestrictions, setRemovingDoctorNote] = useState(false);

    // Kroger profile state
    const [krogerProfile, setKrogerProfile] = useState<{ firstName?: string; lastName?: string } | null>(null);
    const [loadingKrogerProfile, setLoadingKrogerProfile] = useState(false);
    const [unlinkingKroger, setUnlinkingKroger] = useState(false);

    // Shopping preference state
    const [savingShoppingPreference, setSavingShoppingPreference] = useState(false);

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
    const [deleteEmail, setDeleteEmail] = useState("");
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Family members state
    const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
    const [loadingFamilyMembers, setLoadingFamilyMembers] = useState(true);
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
    const [savingMember, setSavingMember] = useState(false);
    const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
    const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
    const [memberToDelete, setMemberToDelete] = useState<FamilyMember | null>(null);

    // Form state for add/edit member modal
    const [memberName, setMemberName] = useState("");
    const [memberDietType, setMemberDietType] = useState("");
    const [memberAllergies, setMemberAllergies] = useState<string[]>([]);
    const [memberSensitivities, setMemberSensitivities] = useState<string[]>([]);
    const [memberDislikedFoods, setMemberDislikedFoods] = useState<string[]>([]);
    const [memberCustomDislikedFood, setMemberCustomDislikedFood] = useState("");
    const [memberCustomAllergy, setMemberCustomAllergy] = useState("");
    const [memberCustomSensitivity, setMemberCustomSensitivity] = useState("");

    // Subscription portal state
    const [loadingPortal, setLoadingPortal] = useState(false);

    // Store search modal state
    const [showStoreSearchModal, setShowStoreSearchModal] = useState(false);

    // Instacart retailer state
    const [instacartRetailer, setInstacartRetailer] = useState<InstacartRetailer | null>(null);
    const [showInstacartRetailerModal, setShowInstacartRetailerModal] = useState(false);
    const [loadingInstacartRetailer, setLoadingInstacartRetailer] = useState(false);

    // Upgrade modal state for household members
    const [showHouseholdUpgradeModal, setShowHouseholdUpgradeModal] = useState(false);

    const formatDietRestrictionsUpdatedAt = (value?: any) => {
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

    // Load Instacart retailer preference
    useEffect(() => {
        if (!user) return;

        const loadInstacartRetailer = async () => {
            setLoadingInstacartRetailer(true);
            try {
                const token = await user.getIdToken();
                const res = await fetch("/api/instacart/retailer", {
                    headers: {
                        "Authorization": `Bearer ${token}`,
                    },
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.retailer) {
                        setInstacartRetailer(data.retailer);
                    }
                }
            } catch (err) {
                console.error("Error loading Instacart retailer:", err);
            } finally {
                setLoadingInstacartRetailer(false);
            }
        };

        void loadInstacartRetailer();
    }, [user]);

    // Load family members
    useEffect(() => {
        if (!user) return;

        const loadFamilyMembers = async () => {
            setLoadingFamilyMembers(true);
            try {
                const membersCol = collection(db, "users", user.uid, "familyMembers");
                const snap = await getDocs(membersCol);

                const members: FamilyMember[] = [];
                snap.forEach((d) => {
                    const data = d.data();
                    members.push({
                        id: d.id,
                        name: data.name || "",
                        isActive: data.isActive ?? true,
                        dietType: data.dietType,
                        allergiesAndSensitivities: data.allergiesAndSensitivities,
                        dislikedFoods: data.dislikedFoods,
                        dietRestrictions: data.dietRestrictions,
                        createdAt: data.createdAt,
                        updatedAt: data.updatedAt,
                    });
                });

                // Sort by name
                members.sort((a, b) => a.name.localeCompare(b.name));
                setFamilyMembers(members);
            } catch (err) {
                console.error("Error loading family members", err);
                setFamilyMembers([]);
            } finally {
                setLoadingFamilyMembers(false);
            }
        };

        void loadFamilyMembers();
    }, [user]);

    const handleSetDefault = async (loc: UserLocation) => {
        if (!user) return;

        try {
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

            // Warm cache for the new default location in background
            warmLocationInBackground(loc.krogerLocationId);

            showToast("Default store updated.", "success");
        } catch (err) {
            console.error("Error setting default location", err);
            showToast("Could not update default store.", "error");
        }
    };

    const handleRemoveStore = async (loc: UserLocation) => {
        if (!user) return;

        try {

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
                showToast(`${loc.name} removed. ${newDefault.name} is now your default.`, "success");
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
                showToast(`${loc.name} removed.`, "success");
            } else {
                setLocations(remainingLocations);
                showToast(`${loc.name} removed.`, "success");
            }
        } catch (err) {
            console.error("Error removing location", err);
            showToast("Could not remove store.", "error");
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
            throw new Error("Store already saved");
        }

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

        // Warm cache for the new store in background
        warmLocationInBackground(store.locationId);

        showToast(
            isFirstLocation
                ? `${store.name} saved as your default store.`
                : `${store.name} saved and set as default.`,
            "success"
        );
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

    const handleEditDietAllergies = () => {
        setSelectedDietType(userDoc?.dietType ?? "");
        setSelectedCookingExperience(userDoc?.cookingExperience ?? "");
        setSelectedAllergies(userDoc?.allergiesAndSensitivities?.allergies ?? []);
        setSelectedSensitivities(userDoc?.allergiesAndSensitivities?.sensitivities ?? []);
        setSelectedDislikedFoods(userDoc?.dislikedFoods ?? []);
        setCustomDislikedFood("");
        setCustomAllergy("");
        setCustomSensitivity("");
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
                    cookingExperience: selectedCookingExperience || null,
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
                cookingExperience: selectedCookingExperience || undefined,
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

    const handleRemoveDietRestrictions = async () => {
        if (!user) return;

        try {
            setRemovingDoctorNote(true);

            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                dietRestrictions: null,
            });

            setUserDoc((prev) =>
                prev ? { ...prev, dietRestrictions: null } : prev
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

    const handleChangeShoppingPreference = async (newPreference: "kroger" | "instacart") => {
        if (!user || savingShoppingPreference) return;
        if (newPreference === userDoc?.shoppingPreference) return;

        try {
            setSavingShoppingPreference(true);

            await setDoc(
                doc(db, "users", user.uid),
                { shoppingPreference: newPreference },
                { merge: true }
            );

            setUserDoc((prev) => prev ? { ...prev, shoppingPreference: newPreference } : prev);
            showToast(`Shopping preference updated to ${newPreference === "instacart" ? "Instacart" : "Kroger"}.`, "success");
        } catch (err) {
            console.error("Error updating shopping preference:", err);
            showToast("Failed to update shopping preference. Please try again.", "error");
        } finally {
            setSavingShoppingPreference(false);
        }
    };

    const handleSelectInstacartRetailer = async (retailer: InstacartRetailer) => {
        if (!user) return;

        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/instacart/retailer", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(retailer),
            });

            if (!res.ok) {
                const data = await res.json();
                showToast(data.error || "Failed to save retailer", "error");
                throw new Error(data.error);
            }

            setInstacartRetailer(retailer);
            showToast(`${retailer.name} saved as your default store`, "success");
        } catch (err) {
            console.error("Error saving Instacart retailer:", err);
            throw err;
        }
    };

    const handleClearInstacartRetailer = async () => {
        if (!user) return;

        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/instacart/retailer", {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`,
                },
            });

            if (!res.ok) {
                const data = await res.json();
                showToast(data.error || "Failed to clear retailer", "error");
                throw new Error(data.error);
            }

            setInstacartRetailer(null);
            showToast("Store preference cleared", "success");
        } catch (err) {
            console.error("Error clearing Instacart retailer:", err);
            throw err;
        }
    };

    // Family member handlers
    const resetMemberForm = () => {
        setMemberName("");
        setMemberDietType("");
        setMemberAllergies([]);
        setMemberSensitivities([]);
        setMemberDislikedFoods([]);
        setMemberCustomDislikedFood("");
        setMemberCustomAllergy("");
        setMemberCustomSensitivity("");
    };

    const MAX_HOUSEHOLD_MEMBERS = userDoc?.planType === "family" ? 5 : 1;

    const handleOpenAddMember = () => {
        if (familyMembers.length >= MAX_HOUSEHOLD_MEMBERS) {
            if (userDoc?.planType !== "family") {
                setShowHouseholdUpgradeModal(true);
            } else {
                showToast(`You can add up to ${MAX_HOUSEHOLD_MEMBERS} household members.`, "error");
            }
            return;
        }
        setEditingMember(null);
        resetMemberForm();
        setShowAddMemberModal(true);
    };

    const handleOpenEditMember = (member: FamilyMember) => {
        setEditingMember(member);
        setMemberName(member.name);
        setMemberDietType(member.dietType ?? "");
        setMemberAllergies(member.allergiesAndSensitivities?.allergies ?? []);
        setMemberSensitivities(member.allergiesAndSensitivities?.sensitivities ?? []);
        setMemberDislikedFoods(member.dislikedFoods ?? []);
        setMemberCustomDislikedFood("");
        setMemberCustomAllergy("");
        setMemberCustomSensitivity("");
        setShowAddMemberModal(true);
    };

    const handleCloseMemberModal = () => {
        setShowAddMemberModal(false);
        setEditingMember(null);
        resetMemberForm();
    };

    // Handle hash scrolling after data load
    useEffect(() => {
        if (!loadingLocations && window.location.hash) {
            const id = window.location.hash.replace("#", "");
            const element = document.getElementById(id);
            if (element) {
                setTimeout(() => {
                    element.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 100);
            }
        }
    }, [loadingLocations, locations]);
    const handleSaveMember = async () => {
        if (!user) return;
        if (!memberName.trim()) {
            showToast("Please enter a name.", "error");
            return;
        }

        try {
            setSavingMember(true);

            const memberDataForFirestore = {
                name: memberName.trim(),
                dietType: memberDietType || null,
                allergiesAndSensitivities: {
                    allergies: memberAllergies,
                    sensitivities: memberSensitivities,
                },
                dislikedFoods: memberDislikedFoods,
                updatedAt: serverTimestamp(),
            };

            if (editingMember) {
                // Update existing member
                const memberRef = doc(db, "users", user.uid, "familyMembers", editingMember.id);
                await updateDoc(memberRef, memberDataForFirestore);

                setFamilyMembers((prev) =>
                    prev.map((m) =>
                        m.id === editingMember.id
                            ? {
                                ...m,
                                name: memberName.trim(),
                                dietType: memberDietType || undefined,
                                allergiesAndSensitivities: {
                                    allergies: memberAllergies,
                                    sensitivities: memberSensitivities,
                                },
                                dislikedFoods: memberDislikedFoods,
                                updatedAt: new Date() as any,
                            }
                            : m
                    ).sort((a, b) => a.name.localeCompare(b.name))
                );
                showToast(`${memberName} updated.`, "success");
            } else {
                // Add new member
                const membersCol = collection(db, "users", user.uid, "familyMembers");
                const newMemberRef = await addDoc(membersCol, {
                    ...memberDataForFirestore,
                    isActive: true,
                    createdAt: serverTimestamp(),
                });

                const newMember: FamilyMember = {
                    id: newMemberRef.id,
                    name: memberName.trim(),
                    isActive: true,
                    dietType: memberDietType || undefined,
                    allergiesAndSensitivities: {
                        allergies: memberAllergies,
                        sensitivities: memberSensitivities,
                    },
                    dislikedFoods: memberDislikedFoods,
                    createdAt: new Date() as any,
                    updatedAt: new Date() as any,
                };

                setFamilyMembers((prev) =>
                    [...prev, newMember].sort((a, b) => a.name.localeCompare(b.name))
                );
                showToast(`${memberName} added to your family.`, "success");
            }

            handleCloseMemberModal();
        } catch (err) {
            console.error("Error saving family member", err);
            showToast("Could not save family member.", "error");
        } finally {
            setSavingMember(false);
        }
    };

    const handleToggleMemberActive = async (member: FamilyMember) => {
        if (!user) return;

        try {
            const memberRef = doc(db, "users", user.uid, "familyMembers", member.id);
            await updateDoc(memberRef, {
                isActive: !member.isActive,
                updatedAt: serverTimestamp(),
            });

            setFamilyMembers((prev) =>
                prev.map((m) =>
                    m.id === member.id ? { ...m, isActive: !m.isActive } : m
                )
            );

            showToast(
                member.isActive
                    ? `${member.name} excluded. Their dietary preferences will not be considered when generating meals.`
                    : `${member.name} included. Their dietary preferences will now be considered when generating meals.`,
                "success"
            );
        } catch (err) {
            console.error("Error toggling member active status", err);
            showToast("Could not update household member.", "error");
        }
    };

    const handleDeleteMember = (member: FamilyMember) => {
        setMemberToDelete(member);
    };

    const confirmDeleteMember = async () => {
        if (!user || !memberToDelete) return;

        try {
            setDeletingMemberId(memberToDelete.id);

            const memberRef = doc(db, "users", user.uid, "familyMembers", memberToDelete.id);
            await deleteDoc(memberRef);

            setFamilyMembers((prev) => prev.filter((m) => m.id !== memberToDelete.id));
            showToast(`${memberToDelete.name} removed from your household.`, "success");
            setMemberToDelete(null);
        } catch (err) {
            console.error("Error deleting household member", err);
            showToast("Could not delete household member.", "error");
        } finally {
            setDeletingMemberId(null);
        }
    };

    const toggleMemberAllergy = (item: string) => {
        setMemberAllergies((prev) =>
            prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
        );
    };

    const toggleMemberSensitivity = (item: string) => {
        setMemberSensitivities((prev) =>
            prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item]
        );
    };

    const toggleMemberDislikedFood = (item: string) => {
        setMemberDislikedFoods((prev) =>
            prev.includes(item) ? prev.filter((f) => f !== item) : [...prev, item]
        );
    };

    const addMemberCustomDislikedFood = () => {
        const food = memberCustomDislikedFood.trim();
        if (food && !memberDislikedFoods.includes(food)) {
            setMemberDislikedFoods((prev) => [...prev, food]);
            setMemberCustomDislikedFood("");
        }
    };

    const addMemberCustomAllergy = () => {
        const trimmed = memberCustomAllergy.trim();
        if (trimmed && !memberAllergies.includes(trimmed)) {
            setMemberAllergies((prev) => [...prev, trimmed]);
            setMemberCustomAllergy("");
        }
    };

    const addMemberCustomSensitivity = () => {
        const trimmed = memberCustomSensitivity.trim();
        if (trimmed && !memberSensitivities.includes(trimmed)) {
            setMemberSensitivities((prev) => [...prev, trimmed]);
            setMemberCustomSensitivity("");
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

        // Verify email matches
        if (deleteEmail.toLowerCase().trim() !== user.email.toLowerCase()) {
            setDeleteError("Email does not match your account email.");
            return;
        }

        try {
            setDeletingAccount(true);
            setDeleteError(null);

            // Get the user's current data before deleting
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            const userData = userDocSnap.data();

            // Save email and prompt count to deletedEmails collection to prevent abuse
            const emailLower = user.email.toLowerCase();
            await setDoc(doc(db, "deletedEmails", emailLower), {
                email: emailLower,
                monthlyPromptCount: userData?.monthlyPromptCount || 0,
                promptPeriodStart: userData?.promptPeriodStart || null,
                planType: userData?.planType || "free",
                deletedAt: serverTimestamp(),
            });

            // Delete user document from Firestore
            await deleteDoc(userDocRef);

            // Delete the Firebase Auth user
            await deleteUser(user);

            // Redirect to login
            router.push("/login");
        } catch (error: any) {
            if (error.code === "auth/requires-recent-login") {
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

    const getCookingExperienceLabel = (value: string | undefined) => {
        if (!value) return null;
        const opt = COOKING_EXPERIENCE_OPTIONS.find((o) => o.value === value);
        return opt?.label ?? value;
    };

    const dietRestrictions = (userDoc?.dietRestrictions ?? null) as DietRestrictions | null;
    const hasDietRestrictions = Boolean(dietRestrictions?.hasActiveNote);

    if (loadingUser) {
        return <LoadingScreen message="Loading your account..." />;
    }

    if (!user) {
        return <LoadingScreen message="Redirecting to login..." />;
    }

    return (
        <div className="min-h-screen bg-[#f8fafb]">
            {/* Header - Sticky */}
            <div className="bg-white border-b border-gray-100 px-6 pt-safe-6 pb-6 sticky sticky-safe z-20">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-[#4A90E2] to-[#357ABD] rounded-full flex items-center justify-center shadow-sm">
                            <span className="text-xl font-semibold text-white">
                                {(userDoc?.name || user.email || "A").charAt(0).toUpperCase()}
                            </span>
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
                    {/* Premium Usage Card */}
                    {userDoc?.isPremium && (() => {
                        const premiumLimit = userDoc?.planType === "family" ? FAMILY_MONTHLY_LIMIT : INDIVIDUAL_MONTHLY_LIMIT;
                        const planLabel = userDoc?.planType === "family" ? "Family & Friends" : "Individual";
                        let monthlyCount = userDoc?.monthlyPromptCount ?? 0;
                        let daysUntilReset = 30;

                        if (userDoc?.promptPeriodStart) {
                            const startDate = typeof userDoc.promptPeriodStart.toDate === "function"
                                ? userDoc.promptPeriodStart.toDate()
                                : new Date(userDoc.promptPeriodStart);
                            const now = new Date();

                            if (now.getTime() - startDate.getTime() >= THIRTY_DAYS_MS) {
                                monthlyCount = 0;
                                daysUntilReset = 30;
                            } else {
                                const resetDate = new Date(startDate.getTime() + THIRTY_DAYS_MS);
                                daysUntilReset = Math.max(0, Math.ceil((resetDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
                            }
                        }

                        const usagePercent = Math.min((monthlyCount / premiumLimit) * 100, 100);
                        const remaining = premiumLimit - monthlyCount;

                        return (
                            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                <div className="px-5 py-4 border-b border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                                            <Zap className="w-5 h-5 text-purple-500" />
                                        </div>
                                        <div>
                                            <h2 className="font-medium text-gray-900">Monthly Usage</h2>
                                            <p className="text-xs text-gray-500">{planLabel} plan generations</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="px-5 py-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm text-gray-700">Meal generations used</span>
                                        <span className="text-sm font-medium text-gray-900">
                                            {monthlyCount.toLocaleString()} / {premiumLimit.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${usagePercent >= 100
                                                ? "bg-red-500"
                                                : usagePercent >= 80
                                                    ? "bg-amber-500"
                                                    : "bg-purple-500"
                                                }`}
                                            style={{ width: `${usagePercent}%` }}
                                        />
                                    </div>
                                    <p className="text-sm text-gray-500 mt-3">
                                        {remaining.toLocaleString()} generation{remaining !== 1 ? "s" : ""} remaining. Resets in {daysUntilReset} day{daysUntilReset !== 1 ? "s" : ""}.
                                    </p>
                                </div>
                            </div>
                        );
                    })()}

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
                                            className={`h-full rounded-full transition-all ${monthlyCount >= FREE_TIER_MONTHLY_LIMIT
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
                            <button
                                onClick={handleEditDietAllergies}
                                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
                            >
                                <Edit3 className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>

                        <div className="px-5 py-4">
                            <div className="space-y-3">
                                <div>
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Diet Focus</span>
                                    <p className="text-sm text-gray-900 mt-0.5">
                                        {getDietLabel(userDoc?.dietType) || "Not set"}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cooking Experience</span>
                                    <p className="text-sm text-gray-900 mt-0.5">
                                        {getCookingExperienceLabel(userDoc?.cookingExperience) || "Not set"}
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
                                    <p className="text-xs text-gray-500">Upload to filter meal suggestions</p>
                                </div>
                            </div>
                            {hasDietRestrictions && (
                                <button
                                    onClick={() => router.push("/diet-instructions")}
                                    className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
                                >
                                    <Edit3 className="w-4 h-4 text-gray-400" />
                                </button>
                            )}
                        </div>

                        <div className="px-5 py-4">
                            {!hasDietRestrictions ? (
                                <div>
                                    <p className="text-sm text-gray-500 mb-4">
                                        Upload your diet instructions to automatically filter meal suggestions.
                                    </p>
                                    <button
                                        onClick={() => router.push("/diet-instructions")}
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
                                        {dietRestrictions?.updatedAt && (
                                            <span className="text-xs text-gray-400">
                                                • Updated {formatDietRestrictionsUpdatedAt(dietRestrictions.updatedAt)}
                                            </span>
                                        )}
                                    </div>

                                    {dietRestrictions?.blockedIngredients && dietRestrictions.blockedIngredients.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {dietRestrictions.blockedIngredients.map((item) => (
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
                                        onClick={() => void handleRemoveDietRestrictions()}
                                        disabled={removingDietRestrictions}
                                        className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span>{removingDietRestrictions ? "Removing..." : "Remove"}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Household Members Card */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                                    <Users className="w-5 h-5 text-purple-500" />
                                </div>
                                <div>
                                    <h2 className="font-medium text-gray-900">Household Members</h2>
                                    <p className="text-xs text-gray-500">
                                        {familyMembers.length === 0
                                            ? "Add household members to consider their dietary needs"
                                            : `${familyMembers.filter(m => m.isActive).length} of ${familyMembers.length} active for meal planning`}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleOpenAddMember}
                                disabled={familyMembers.length >= MAX_HOUSEHOLD_MEMBERS}
                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-purple-500 hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title={familyMembers.length >= MAX_HOUSEHOLD_MEMBERS ? (userDoc?.planType !== "family" ? "Upgrade to add more members" : `Maximum ${MAX_HOUSEHOLD_MEMBERS} members`) : "Add member"}
                            >
                                <Plus className="w-5 h-5 text-white" />
                            </button>
                        </div>

                        <div className="px-5 py-4">
                            {loadingFamilyMembers ? (
                                <div className="flex items-center justify-center py-4">
                                    <div className="w-5 h-5 border-2 border-gray-200 border-t-purple-500 rounded-full animate-spin" />
                                </div>
                            ) : familyMembers.length === 0 ? (
                                <div>
                                    <p className="text-sm text-gray-500 mb-4">
                                        Add household members to include their dietary preferences when generating meals.
                                    </p>
                                    <button
                                        onClick={handleOpenAddMember}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-purple-500/10 text-purple-600 rounded-xl text-sm font-medium hover:bg-purple-500/20 transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span>Add Household Member</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-xs text-gray-500 mb-2">
                                        Toggle members on or off to include or exclude them from meal planning.
                                    </p>
                                    {familyMembers.map((member) => (
                                        <div
                                            key={member.id}
                                            className="border border-gray-100 rounded-xl overflow-hidden"
                                        >
                                            <div
                                                className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                                                onClick={() => setExpandedMemberId(
                                                    expandedMemberId === member.id ? null : member.id
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${member.isActive
                                                        ? "bg-purple-100 text-purple-600"
                                                        : "bg-gray-100 text-gray-400"
                                                        }`}>
                                                        {member.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className={`text-sm font-medium ${member.isActive ? "text-gray-900" : "text-gray-400"
                                                            }`}>
                                                            {member.name}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {member.dietType
                                                                ? getDietLabel(member.dietType)
                                                                : "No diet preference"}
                                                            {((member.allergiesAndSensitivities?.allergies?.length ?? 0) > 0 ||
                                                                (member.allergiesAndSensitivities?.sensitivities?.length ?? 0) > 0) && (
                                                                    <span className="text-gray-400">
                                                                        {" • "}
                                                                        {(member.allergiesAndSensitivities?.allergies?.length ?? 0) +
                                                                            (member.allergiesAndSensitivities?.sensitivities?.length ?? 0)} restriction{((member.allergiesAndSensitivities?.allergies?.length ?? 0) + (member.allergiesAndSensitivities?.sensitivities?.length ?? 0)) !== 1 ? "s" : ""}
                                                                    </span>
                                                                )}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            void handleToggleMemberActive(member);
                                                        }}
                                                        className="p-1"
                                                        title={member.isActive ? "Exclude from meals" : "Include in meals"}
                                                    >
                                                        {member.isActive ? (
                                                            <ToggleRight className="w-8 h-8 text-purple-500" />
                                                        ) : (
                                                            <ToggleLeft className="w-8 h-8 text-gray-300" />
                                                        )}
                                                    </button>
                                                    {expandedMemberId === member.id ? (
                                                        <ChevronUp className="w-5 h-5 text-gray-400" />
                                                    ) : (
                                                        <ChevronDown className="w-5 h-5 text-gray-400" />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Expanded details */}
                                            {expandedMemberId === member.id && (
                                                <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                                                    <div className="space-y-2 text-sm">
                                                        {member.allergiesAndSensitivities?.allergies &&
                                                            member.allergiesAndSensitivities.allergies.length > 0 && (
                                                                <div>
                                                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Allergies</span>
                                                                    <p className="text-gray-700">
                                                                        {member.allergiesAndSensitivities.allergies.join(", ")}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        {member.allergiesAndSensitivities?.sensitivities &&
                                                            member.allergiesAndSensitivities.sensitivities.length > 0 && (
                                                                <div>
                                                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sensitivities</span>
                                                                    <p className="text-gray-700">
                                                                        {member.allergiesAndSensitivities.sensitivities.join(", ")}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        {member.dislikedFoods && member.dislikedFoods.length > 0 && (
                                                            <div>
                                                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Dislikes</span>
                                                                <p className="text-gray-700">
                                                                    {member.dislikedFoods.join(", ")}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {member.dietRestrictions?.hasActiveNote && (
                                                            <div className="flex items-center gap-2 text-blue-600">
                                                                <FileText className="w-4 h-4" />
                                                                <span className="text-xs font-medium">Has diet instructions</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                                                        <button
                                                            onClick={() => router.push(`/diet-instructions?member=${member.id}`)}
                                                            className="flex-1 py-2 px-3 bg-purple-500 text-white rounded-xl text-sm font-medium hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
                                                        >
                                                            <FileText className="w-4 h-4" />
                                                            <span>Diet Instructions</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleOpenEditMember(member)}
                                                            className="py-2 px-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                                                            title="Edit member"
                                                        >
                                                            <Edit3 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteMember(member)}
                                                            disabled={deletingMemberId === member.id}
                                                            className="py-2 px-3 bg-white border border-red-200 text-red-500 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
                                                            title="Remove member"
                                                        >
                                                            {deletingMemberId === member.id ? (
                                                                <div className="w-4 h-4 border-2 border-red-200 border-t-red-500 rounded-full animate-spin" />
                                                            ) : (
                                                                <Trash2 className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Shopping Preference Card */}
                    {process.env.NEXT_PUBLIC_ENABLE_INSTACART === 'true' && (
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-[#43B02A]/10 rounded-xl flex items-center justify-center">
                                        <ShoppingCart className="w-5 h-5 text-[#43B02A]" />
                                    </div>
                                    <div>
                                        <h2 className="font-medium text-gray-900">Shopping Preference</h2>
                                        <p className="text-xs text-gray-500">Choose how you prefer to shop for groceries</p>
                                    </div>
                                </div>
                            </div>
                            <div className="px-5 py-4">
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => void handleChangeShoppingPreference("instacart")}
                                        disabled={savingShoppingPreference}
                                        className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all ${(userDoc?.shoppingPreference || "instacart") === "instacart"
                                            ? "border-[#003D29] bg-[#003D29]/5"
                                            : "border-gray-200 hover:border-gray-300"
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-left">
                                                <Image src={InstacartCarrot} alt="Instacart" className="w-6 h-6" />
                                                <div>
                                                    <p className="font-medium text-gray-900">Instacart</p>
                                                    <p className="text-xs text-gray-500">Multiple stores, delivery</p>
                                                </div>
                                            </div>
                                            {(userDoc?.shoppingPreference || "instacart") === "instacart" && (
                                                <CheckCircle className="w-5 h-5 text-[#003D29]" />
                                            )}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => void handleChangeShoppingPreference("kroger")}
                                        disabled={savingShoppingPreference}
                                        className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all ${userDoc?.shoppingPreference === "kroger"
                                            ? "border-[#0056a3] bg-[#0056a3]/5"
                                            : "border-gray-200 hover:border-gray-300"
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="text-left">
                                                <p className="font-medium text-gray-900">Kroger Direct</p>
                                                <p className="text-xs text-gray-500">Add to Kroger cart</p>
                                            </div>
                                            {userDoc?.shoppingPreference === "kroger" && (
                                                <CheckCircle className="w-5 h-5 text-[#0056a3]" />
                                            )}
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Instacart Store Card - Only show for Instacart preference */}
                    {process.env.NEXT_PUBLIC_ENABLE_INSTACART === 'true' && (userDoc?.shoppingPreference || "instacart") === "instacart" && (
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-[#003D29]/10 rounded-xl flex items-center justify-center">
                                        <Store className="w-5 h-5 text-[#003D29]" />
                                    </div>
                                    <div>
                                        <h2 className="font-medium text-gray-900">Instacart Store</h2>
                                        <p className="text-xs text-gray-500">Set a default store for Instacart shopping</p>
                                    </div>
                                </div>
                            </div>

                            <div className="px-5 py-4">
                                {loadingInstacartRetailer ? (
                                    <div className="flex items-center gap-3">
                                        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                                        <span className="text-sm text-gray-500">Loading...</span>
                                    </div>
                                ) : instacartRetailer ? (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {instacartRetailer.retailer_logo_url ? (
                                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-white flex-shrink-0 border border-gray-100">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={instacartRetailer.retailer_logo_url}
                                                        alt={instacartRetailer.name}
                                                        className="w-full h-full object-contain"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="w-12 h-12 rounded-lg bg-[#003D29]/10 flex items-center justify-center flex-shrink-0">
                                                    <Store className="w-6 h-6 text-[#003D29]" />
                                                </div>
                                            )}
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-gray-900">{instacartRetailer.name}</span>
                                                    <span className="px-1.5 py-0.5 bg-[#003D29]/10 text-[#003D29] rounded text-[10px] font-medium">
                                                        Default
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-0.5">Pre-selected when you shop</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowInstacartRetailerModal(true)}
                                            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                                        >
                                            Change
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-900">No store selected</p>
                                            <p className="text-xs text-gray-500 mt-0.5">Choose a default store for faster checkout</p>
                                        </div>
                                        <button
                                            onClick={() => setShowInstacartRetailerModal(true)}
                                            className="px-3 py-1.5 bg-[#003D29] text-white rounded-lg text-xs font-medium hover:bg-[#004D35] transition-colors"
                                        >
                                            Select Store
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Store & Account Card - Only show for Kroger preference OR if Instacart is disabled (forcing Kroger mode) */}
                    {(userDoc?.shoppingPreference === "kroger" || process.env.NEXT_PUBLIC_ENABLE_INSTACART !== 'true') && (() => {
                        const defaultLocation = locations.find(loc => loc.krogerLocationId === userDoc?.defaultKrogerLocationId);
                        const storeBrand = defaultLocation ? getStoreBrand(defaultLocation.name) : { displayName: "Kroger", tagline: "Kroger Family of Stores" };
                        const isGenericKroger = !defaultLocation;
                        return (
                            <div id="store-connection" className="bg-white rounded-2xl border border-gray-100 overflow-hidden scroll-mt-24">
                                <div className="px-5 py-4 border-b border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-[#0056a3]/10 rounded-xl flex items-center justify-center">
                                            <ShoppingCart className="w-5 h-5 text-[#0056a3]" />
                                        </div>
                                        <div>
                                            <h2 className="font-medium text-gray-900">
                                                {isGenericKroger ? "Store & Account" : `${storeBrand.displayName} Store & Account`}
                                            </h2>
                                            <p className="text-xs text-gray-500">Add items directly to your cart</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="px-5 py-4 space-y-4">
                                    {/* Store Selection Row */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${defaultLocation ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"
                                                }`}>
                                                {defaultLocation ? <CheckCircle className="w-4 h-4" /> : "1"}
                                            </div>
                                            <div>
                                                <span className="text-sm font-medium text-gray-900">Your Store</span>
                                                {loadingLocations ? (
                                                    <p className="text-xs text-gray-500">Loading...</p>
                                                ) : defaultLocation ? (
                                                    <p className="text-xs text-gray-500">{defaultLocation.name}{defaultLocation.city ? `, ${defaultLocation.city}` : ""}</p>
                                                ) : (
                                                    <p className="text-xs text-gray-400">No store selected</p>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowStoreSearchModal(true)}
                                            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                                        >
                                            {defaultLocation ? "Change" : "Find Store"}
                                        </button>
                                    </div>

                                    {/* Divider */}
                                    <div className="border-t border-gray-100" />

                                    {/* Account Connection Row */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${userDoc?.krogerLinked ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"
                                                }`}>
                                                {userDoc?.krogerLinked ? <CheckCircle className="w-4 h-4" /> : "2"}
                                            </div>
                                            <div>
                                                <span className="text-sm font-medium text-gray-900">
                                                    {defaultLocation ? `${storeBrand.displayName} Account` : "Store Account"}
                                                </span>
                                                {userDoc?.krogerLinked ? (
                                                    <p className="text-xs text-emerald-600">Connected</p>
                                                ) : (
                                                    <p className="text-xs text-gray-400">Not connected</p>
                                                )}
                                            </div>
                                        </div>
                                        {userDoc?.krogerLinked ? (
                                            <button
                                                onClick={() => void handleUnlinkKroger()}
                                                disabled={unlinkingKroger}
                                                className="px-3 py-1.5 text-red-500 text-xs font-medium hover:bg-red-50 rounded-lg transition-colors disabled:opacity-70"
                                            >
                                                {unlinkingKroger ? "..." : "Unlink"}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={async () => {
                                                    if (user) {
                                                        const authUrl = `/api/kroger/auth?userId=${user.uid}${isCapacitor() ? '&mobile=true' : ''}`;
                                                        if (isCapacitor()) {
                                                            // On mobile, open in system browser so OAuth redirect works
                                                            await Browser.open({ url: `${window.location.origin}${authUrl}` });
                                                        } else {
                                                            window.location.href = authUrl;
                                                        }
                                                    }
                                                }}
                                                className="px-3 py-1.5 bg-[#0056a3] text-white rounded-lg text-xs font-medium hover:bg-[#004080] transition-colors"
                                            >
                                                Connect
                                            </button>
                                        )}
                                    </div>

                                    {/* Info text when not fully set up */}
                                    {(!defaultLocation || !userDoc?.krogerLinked) && (
                                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
                                            <p className="text-xs text-amber-800 font-medium mb-1">
                                                {!defaultLocation && !userDoc?.krogerLinked
                                                    ? "Complete setup to unlock full features"
                                                    : !defaultLocation
                                                        ? "Select a store to continue"
                                                        : "Connect your account to unlock full features"}
                                            </p>
                                            <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
                                                {!userDoc?.krogerLinked && (
                                                    <>
                                                        <li>Add items directly to your Kroger cart</li>
                                                        <li>See exact prices and availability</li>
                                                        <li>View aisle locations</li>
                                                    </>
                                                )}
                                                {!defaultLocation && (
                                                    <li>Get local store pricing and stock</li>
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Store Search Modal */}
                    <StoreSearchModal
                        isOpen={showStoreSearchModal}
                        onClose={() => setShowStoreSearchModal(false)}
                        onSelectStore={handleUseStoreFromSearch}
                        savedLocations={locations}
                        defaultLocationId={userDoc?.defaultKrogerLocationId}
                        onSetDefault={handleSetDefault}
                        onRemoveStore={handleRemoveStore}
                    />

                    {/* Instacart Retailer Modal */}
                    <InstacartRetailerModal
                        isOpen={showInstacartRetailerModal}
                        onClose={() => setShowInstacartRetailerModal(false)}
                        onSelectRetailer={handleSelectInstacartRetailer}
                        savedRetailer={instacartRetailer}
                        onClearRetailer={handleClearInstacartRetailer}
                    />

                    {/* Diet & Allergies Modal */}
                    <Modal
                        isOpen={editingDietAllergies}
                        onClose={handleCancelEditDietAllergies}
                        title="Diet & Allergies"
                        subtitle="Personalize your meal suggestions"
                        variant="bottom-sheet"
                        size="lg"
                        footer={
                            <div className="flex gap-3">
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
                        }
                    >
                        <div className="space-y-5">
                            {/* Diet Focus */}
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

                            {/* Cooking Experience */}
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Cooking Experience</label>
                                <div className="space-y-2">
                                    {COOKING_EXPERIENCE_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setSelectedCookingExperience(opt.value)}
                                            className={`w-full p-3 rounded-xl border text-left transition-all ${selectedCookingExperience === opt.value
                                                ? "border-[#4A90E2] bg-blue-50"
                                                : "border-gray-200 bg-gray-50 hover:border-gray-300"
                                                }`}
                                        >
                                            <span className="font-medium text-gray-900">{opt.label}</span>
                                            <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Allergies */}
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Allergies</label>
                                <div className="flex flex-wrap gap-2">
                                    {ALLERGY_OPTIONS.map((item) => (
                                        <button
                                            key={item}
                                            type="button"
                                            onClick={() => toggleAllergy(item)}
                                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${selectedAllergies.includes(item)
                                                ? "bg-[#4A90E2] text-white"
                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                }`}
                                        >
                                            {item}
                                        </button>
                                    ))}
                                </div>
                                {/* Custom allergy input */}
                                <div className="flex gap-2 mt-3">
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
                                        placeholder="Add custom allergy..."
                                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:border-[#4A90E2] focus:outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={addCustomAllergy}
                                        disabled={!customAllergy.trim()}
                                        className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Add
                                    </button>
                                </div>
                                {/* Show custom selections */}
                                {selectedAllergies.filter(a => !ALLERGY_OPTIONS.includes(a)).length > 0 && (
                                    <div className="mt-3">
                                        <p className="text-xs text-gray-500 mb-2">Your additions:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedAllergies
                                                .filter(a => !ALLERGY_OPTIONS.includes(a))
                                                .map((item) => (
                                                    <button
                                                        key={item}
                                                        type="button"
                                                        onClick={() => toggleAllergy(item)}
                                                        className="px-3 py-1.5 rounded-lg text-sm bg-[#4A90E2] text-white"
                                                    >
                                                        {item}
                                                    </button>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Sensitivities */}
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Sensitivities</label>
                                <div className="flex flex-wrap gap-2">
                                    {SENSITIVITY_OPTIONS.map((item) => (
                                        <button
                                            key={item}
                                            type="button"
                                            onClick={() => toggleSensitivity(item)}
                                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${selectedSensitivities.includes(item)
                                                ? "bg-[#4A90E2] text-white"
                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                }`}
                                        >
                                            {item}
                                        </button>
                                    ))}
                                </div>
                                {/* Custom sensitivity input */}
                                <div className="flex gap-2 mt-3">
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
                                        placeholder="Add custom sensitivity..."
                                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:border-[#4A90E2] focus:outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={addCustomSensitivity}
                                        disabled={!customSensitivity.trim()}
                                        className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Add
                                    </button>
                                </div>
                                {/* Show custom selections */}
                                {selectedSensitivities.filter(s => !SENSITIVITY_OPTIONS.includes(s)).length > 0 && (
                                    <div className="mt-3">
                                        <p className="text-xs text-gray-500 mb-2">Your additions:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedSensitivities
                                                .filter(s => !SENSITIVITY_OPTIONS.includes(s))
                                                .map((item) => (
                                                    <button
                                                        key={item}
                                                        type="button"
                                                        onClick={() => toggleSensitivity(item)}
                                                        className="px-3 py-1.5 rounded-lg text-sm bg-[#4A90E2] text-white"
                                                    >
                                                        {item}
                                                    </button>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Food Dislikes */}
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Food Dislikes</label>
                                <div className="flex flex-wrap gap-2">
                                    {COMMON_DISLIKED_FOODS.map((item) => (
                                        <button
                                            key={item}
                                            type="button"
                                            onClick={() => toggleDislikedFood(item)}
                                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${selectedDislikedFoods.includes(item)
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
                        </div>
                    </Modal>

                    {/* Household Member Upgrade Modal */}
                    {showHouseholdUpgradeModal && (
                        <UpgradePrompt
                            feature="household_members"
                            onClose={() => setShowHouseholdUpgradeModal(false)}
                            variant="modal"
                            reason="limit_reached"
                        />
                    )}

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
                                        <div className={`flex items-center gap-2 p-2 rounded-lg ${passwordMessageType === "success" ? "bg-emerald-50" : "bg-red-50"
                                            }`}>
                                            {passwordMessageType === "success" ? (
                                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                                            ) : (
                                                <AlertCircle className="w-4 h-4 text-red-500" />
                                            )}
                                            <span className={`text-sm ${passwordMessageType === "success" ? "text-emerald-700" : "text-red-700"
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
                                        <div className={`flex items-start gap-2 p-3 rounded-xl ${passwordMessageType === "success"
                                            ? "bg-emerald-50 border border-emerald-100"
                                            : "bg-red-50 border border-red-100"
                                            }`}>
                                            {passwordMessageType === "success" ? (
                                                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                            ) : (
                                                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                            )}
                                            <p className={`text-sm ${passwordMessageType === "success" ? "text-emerald-600" : "text-red-600"
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
                                            setDeleteEmail("");
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
                                            Enter your email to confirm
                                        </label>
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="email"
                                                value={deleteEmail}
                                                onChange={(e) => setDeleteEmail(e.target.value)}
                                                placeholder="Enter your email"
                                                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-red-400 focus:outline-none focus:bg-white transition-colors"
                                            />
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
                                            disabled={deletingAccount || !deleteEmail}
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
                                                setDeleteEmail("");
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

            {/* Add/Edit Household Member Modal */}
            <Modal
                isOpen={showAddMemberModal}
                onClose={handleCloseMemberModal}
                title={editingMember ? "Edit Household Member" : "Add Household Member"}
                subtitle="Set dietary preferences for this household member"
                variant="bottom-sheet"
                size="lg"
                footer={
                    <div className="flex gap-3">
                        <button
                            onClick={() => void handleSaveMember()}
                            disabled={savingMember || !memberName.trim()}
                            className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium disabled:opacity-70 flex items-center justify-center gap-2"
                        >
                            {savingMember ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                editingMember ? "Save Changes" : "Add Member"
                            )}
                        </button>
                        <button
                            onClick={handleCloseMemberModal}
                            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    {/* Name */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Name</label>
                        <input
                            type="text"
                            value={memberName}
                            onChange={(e) => setMemberName(e.target.value)}
                            placeholder="Enter name"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                        />
                    </div>

                    {/* Diet Type */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Diet Focus</label>
                        <select
                            value={memberDietType}
                            onChange={(e) => setMemberDietType(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:border-purple-500 focus:outline-none"
                        >
                            <option value="">None</option>
                            {DIET_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Allergies */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Allergies</label>
                        <div className="flex flex-wrap gap-2">
                            {ALLERGY_OPTIONS.map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => toggleMemberAllergy(item)}
                                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${memberAllergies.includes(item)
                                        ? "bg-purple-500 text-white"
                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
                                >
                                    {item}
                                </button>
                            ))}
                        </div>
                        {/* Custom allergy input */}
                        <div className="flex gap-2 mt-3">
                            <input
                                type="text"
                                value={memberCustomAllergy}
                                onChange={(e) => setMemberCustomAllergy(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addMemberCustomAllergy();
                                    }
                                }}
                                placeholder="Add custom allergy..."
                                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                            />
                            <button
                                type="button"
                                onClick={addMemberCustomAllergy}
                                disabled={!memberCustomAllergy.trim()}
                                className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Add
                            </button>
                        </div>
                        {/* Show custom selections */}
                        {memberAllergies.filter(a => !ALLERGY_OPTIONS.includes(a)).length > 0 && (
                            <div className="mt-3">
                                <p className="text-xs text-gray-500 mb-2">Custom additions:</p>
                                <div className="flex flex-wrap gap-2">
                                    {memberAllergies
                                        .filter(a => !ALLERGY_OPTIONS.includes(a))
                                        .map((item) => (
                                            <button
                                                key={item}
                                                type="button"
                                                onClick={() => toggleMemberAllergy(item)}
                                                className="px-3 py-1.5 rounded-lg text-sm bg-purple-500 text-white"
                                            >
                                                {item}
                                            </button>
                                        ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sensitivities */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Sensitivities</label>
                        <div className="flex flex-wrap gap-2">
                            {SENSITIVITY_OPTIONS.map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => toggleMemberSensitivity(item)}
                                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${memberSensitivities.includes(item)
                                        ? "bg-purple-500 text-white"
                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
                                >
                                    {item}
                                </button>
                            ))}
                        </div>
                        {/* Custom sensitivity input */}
                        <div className="flex gap-2 mt-3">
                            <input
                                type="text"
                                value={memberCustomSensitivity}
                                onChange={(e) => setMemberCustomSensitivity(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addMemberCustomSensitivity();
                                    }
                                }}
                                placeholder="Add custom sensitivity..."
                                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                            />
                            <button
                                type="button"
                                onClick={addMemberCustomSensitivity}
                                disabled={!memberCustomSensitivity.trim()}
                                className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Add
                            </button>
                        </div>
                        {/* Show custom selections */}
                        {memberSensitivities.filter(s => !SENSITIVITY_OPTIONS.includes(s)).length > 0 && (
                            <div className="mt-3">
                                <p className="text-xs text-gray-500 mb-2">Custom additions:</p>
                                <div className="flex flex-wrap gap-2">
                                    {memberSensitivities
                                        .filter(s => !SENSITIVITY_OPTIONS.includes(s))
                                        .map((item) => (
                                            <button
                                                key={item}
                                                type="button"
                                                onClick={() => toggleMemberSensitivity(item)}
                                                className="px-3 py-1.5 rounded-lg text-sm bg-purple-500 text-white"
                                            >
                                                {item}
                                            </button>
                                        ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Disliked Foods */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Food Dislikes</label>
                        <div className="flex flex-wrap gap-2">
                            {COMMON_DISLIKED_FOODS.map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => toggleMemberDislikedFood(item)}
                                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${memberDislikedFoods.includes(item)
                                        ? "bg-purple-500 text-white"
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
                                value={memberCustomDislikedFood}
                                onChange={(e) => setMemberCustomDislikedFood(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addMemberCustomDislikedFood();
                                    }
                                }}
                                placeholder="Add custom food..."
                                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                            />
                            <button
                                type="button"
                                onClick={addMemberCustomDislikedFood}
                                disabled={!memberCustomDislikedFood.trim()}
                                className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Add
                            </button>
                        </div>
                        {/* Show custom selections */}
                        {memberDislikedFoods.filter(f => !COMMON_DISLIKED_FOODS.includes(f)).length > 0 && (
                            <div className="mt-3">
                                <p className="text-xs text-gray-500 mb-2">Custom additions:</p>
                                <div className="flex flex-wrap gap-2">
                                    {memberDislikedFoods
                                        .filter(f => !COMMON_DISLIKED_FOODS.includes(f))
                                        .map((item) => (
                                            <button
                                                key={item}
                                                type="button"
                                                onClick={() => toggleMemberDislikedFood(item)}
                                                className="px-3 py-1.5 rounded-lg text-sm bg-purple-500 text-white"
                                            >
                                                {item}
                                            </button>
                                        ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Diet Instructions link for existing members */}
                    {editingMember && (
                        <div className="pt-2">
                            <button
                                onClick={() => {
                                    handleCloseMemberModal();
                                    router.push(`/diet-instructions?member=${editingMember.id}`);
                                }}
                                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                            >
                                <FileText className="w-4 h-4" />
                                <span>
                                    {editingMember.dietRestrictions?.hasActiveNote
                                        ? "Update Diet Instructions"
                                        : "Upload Diet Instructions"}
                                </span>
                            </button>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Delete Member Confirmation Modal */}
            <Modal
                isOpen={!!memberToDelete}
                onClose={() => setMemberToDelete(null)}
                title="Remove Member"
                size="sm"
                showCloseButton={false}
                footer={
                    <div className="flex gap-3">
                        <button
                            onClick={() => void confirmDeleteMember()}
                            disabled={deletingMemberId === memberToDelete?.id}
                            className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {deletingMemberId === memberToDelete?.id ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Removing...</span>
                                </>
                            ) : (
                                "Remove"
                            )}
                        </button>
                        <button
                            onClick={() => setMemberToDelete(null)}
                            disabled={deletingMemberId === memberToDelete?.id}
                            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                    </div>
                }
            >
                <div>
                    <p className="text-gray-600">
                        Are you sure you want to remove <span className="font-medium text-gray-900">{memberToDelete?.name}</span> from your household?
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                        Their dietary preferences and restrictions will no longer be considered when generating meals.
                    </p>
                </div>
            </Modal>
        </div>
    );
}

export default function AccountPage() {
    return (
        <Suspense fallback={<LoadingScreen message="Loading your account..." />}>
            <AccountPageContent />
        </Suspense>
    );
}
