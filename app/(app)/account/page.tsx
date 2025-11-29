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
    updatedAt?: any; // Firestore Timestamp or string
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
};

type UserLocation = {
    id: string; // Firestore doc ID
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

export default function AccountPage(): JSX.Element {
    const router = useRouter();

    const [user, setUser] = useState<User | null>(null);
    const [userDoc, setUserDoc] = useState<UserPrefsDoc | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [locations, setLocations] = useState<UserLocation[]>([]);
    const [loadingLocations, setLoadingLocations] = useState(true);

    // Location saving state
    const [savingLocation, setSavingLocation] = useState(false);
    const [locationMessage, setLocationMessage] = useState<string | null>(null);

    // ZIP → store search
    const [zipSearch, setZipSearch] = useState("");
    const [storeResults, setStoreResults] = useState<KrogerLocationSearchResult[]>([]);
    const [searchingStores, setSearchingStores] = useState(false);
    const [storeSearchError, setStoreSearchError] = useState<string | null>(null);

    // Diet & Allergies editing
    const [editingDietAllergies, setEditingDietAllergies] = useState(false);
    const [selectedDietType, setSelectedDietType] = useState("");
    const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
    const [selectedSensitivities, setSelectedSensitivities] = useState<string[]>([]);
    const [savingDietAllergies, setSavingDietAllergies] = useState(false);
    const [dietAllergiesMessage, setDietAllergiesMessage] = useState<string | null>(null);

    // Diet instructions state (formerly “doctor note”)
    const [removingDoctorNote, setRemovingDoctorNote] = useState(false);
    const [doctorNoteMessage, setDoctorNoteMessage] = useState<string | null>(null);

    // Kroger account linking
    const [krogerMessage, setKrogerMessage] = useState<string | null>(null);
    const [krogerMessageType, setKrogerMessageType] = useState<"success" | "error">("success");
    const searchParams = useSearchParams();

    // Helper: format doctor.updatedAt
    const formatDoctorUpdatedAt = (value?: any) => {
        if (!value) return "";
        let date: Date | null = null;

        // Firestore Timestamp
        if (value && typeof value === "object" && typeof value.toDate === "function") {
            date = value.toDate();
        } else if (typeof value === "string") {
            date = new Date(value);
        }

        if (!date || Number.isNaN(date.getTime())) return "";
        return date.toLocaleDateString();
    };

    // Handle Kroger OAuth callback params
    useEffect(() => {
        const krogerLinked = searchParams.get("kroger_linked");
        const krogerError = searchParams.get("kroger_error");

        if (krogerLinked === "success") {
            setKrogerMessage("Your Kroger account has been linked successfully!");
            setKrogerMessageType("success");
            // Update local state
            setUserDoc((prev) => (prev ? { ...prev, krogerLinked: true } : { krogerLinked: true }));
            // Clear URL params
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

    // 1️⃣ Auth + user doc
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

    // 2️⃣ Load locations for this user
    useEffect(() => {
        if (!user) return;

        const loadLocations = async () => {
            setLoadingLocations(true);
            try {
                const locCol = collection(
                    db,
                    "krogerLocations",
                    user.uid,
                    "locations",
                );
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

    // 4️⃣ Set default location
    const handleSetDefault = async (loc: UserLocation) => {
        if (!user) return;

        try {
            setLocationMessage(null);

            // 1) update user doc
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                defaultKrogerLocationId: loc.krogerLocationId,
            });

            // 2) flip isDefault on all location docs
            const batch = writeBatch(db);
            const locCol = collection(
                db,
                "krogerLocations",
                user.uid,
                "locations",
            );
            for (const l of locations) {
                const ref = doc(locCol, l.id);
                batch.update(ref, { isDefault: l.id === loc.id });
            }
            await batch.commit();

            // 3) update local state
            setLocations((prev) =>
                prev.map((l) => ({
                    ...l,
                    isDefault: l.id === loc.id,
                })),
            );
            setUserDoc((prev) =>
                prev
                    ? { ...prev, defaultKrogerLocationId: loc.krogerLocationId }
                    : { defaultKrogerLocationId: loc.krogerLocationId },
            );

            setLocationMessage("Default store updated.");
        } catch (err) {
            console.error("Error setting default location", err);
            setLocationMessage("Could not update default store.");
        }
    };

    // 5️⃣ Search stores by ZIP (calls /api/kroger/locations)
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

            const res = await fetch(
                `/api/kroger/locations?zip=${encodeURIComponent(zip)}`,
            );

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                setStoreSearchError(
                    data?.message || "Could not load stores for that ZIP.",
                );
                return;
            }

            const data = (await res.json()) as {
                locations?: KrogerLocationSearchResult[];
            };
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

    // Save the store directly from search result
    const handleUseStoreFromSearch = async (store: KrogerLocationSearchResult) => {
        if (!user) return;

        try {
            setSavingLocation(true);
            setLocationMessage(null);

            const locCol = collection(
                db,
                "krogerLocations",
                user.uid,
                "locations",
            );

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

            // Update user doc with new default
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                defaultKrogerLocationId: store.locationId,
            });

            // Update local state
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
                    : { defaultKrogerLocationId: store.locationId },
            );

            // Clear search results after saving
            setStoreResults([]);
            setZipSearch("");

            setLocationMessage(
                isFirstLocation
                    ? `${store.name} saved as your default store.`
                    : `${store.name} saved and set as default.`,
            );
        } catch (err) {
            console.error("Error saving location", err);
            setLocationMessage("Something went wrong saving this location.");
        } finally {
            setSavingLocation(false);
        }
    };

    // Toggle allergy selection
    const toggleAllergy = (item: string) => {
        setSelectedAllergies((prev) =>
            prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
        );
    };

    // Toggle sensitivity selection
    const toggleSensitivity = (item: string) => {
        setSelectedSensitivities((prev) =>
            prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
        );
    };

    // Start editing diet/allergies/sensitivities
    const handleEditDietAllergies = () => {
        setSelectedDietType(userDoc?.dietType ?? "");
        setSelectedAllergies(userDoc?.allergiesAndSensitivities?.allergies ?? []);
        setSelectedSensitivities(userDoc?.allergiesAndSensitivities?.sensitivities ?? []);
        setDietAllergiesMessage(null);
        setEditingDietAllergies(true);
    };

    // Cancel editing
    const handleCancelEditDietAllergies = () => {
        setEditingDietAllergies(false);
        setDietAllergiesMessage(null);
    };

    // Save diet/allergies/sensitivities
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

            // Update local state
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

    // Remove diet instructions
    const handleRemoveDoctorInstructions = async () => {
        if (!user) return;

        try {
            setRemovingDoctorNote(true);
            setDoctorNoteMessage(null);

            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                doctorDietInstructions: null,
            });

            // Update local state
            setUserDoc((prev) =>
                prev ? { ...prev, doctorDietInstructions: null } : prev,
            );

            setDoctorNoteMessage(
                "Diet instructions removed. Future meals will no longer use this filter.",
            );
        } catch (err) {
            console.error("Error removing diet instructions", err);
            setDoctorNoteMessage("Could not remove diet instructions.");
        } finally {
            setRemovingDoctorNote(false);
        }
    };

    // Helper to get diet type label
    const getDietLabel = (value: string | undefined) => {
        if (!value) return null;
        const opt = DIET_OPTIONS.find((o) => o.value === value);
        return opt?.label ?? value;
    };

    // Diet instructions derived (uses doctorDietInstructions field under the hood)
    const doctor = (userDoc?.doctorDietInstructions ??
        null) as DoctorDietInstructions | null;
    const hasDoctorNote = Boolean(doctor?.hasActiveNote);

    // 6️⃣ Render

    if (loadingUser) {
        return (
            <div style={{ padding: "2rem" }}>
                <p>Loading your account…</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div style={{ padding: "2rem" }}>
                <p>Redirecting to login…</p>
            </div>
        );
    }

    return (
        <div
            style={{
                padding: "2rem",
                maxWidth: 900,
                margin: "0 auto",
                display: "flex",
                flexDirection: "column",
                gap: "2rem",
            }}
        >
            {/* Header */}
            <div>
                <h1 style={{ marginBottom: "0.25rem" }}>Account</h1>
                <p style={{ fontSize: "0.9rem", color: "#6b7280" }}>
                    Manage your profile, dietary preferences, diet instructions, and shopping
                    locations.
                </p>
            </div>

            {/* Basic user info */}
            <section
                style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.75rem",
                    padding: "1.25rem",
                }}
            >
                <h2
                    style={{
                        marginBottom: "0.75rem",
                        fontSize: "1rem",
                    }}
                >
                    Profile
                </h2>
                <p style={{ fontSize: "0.9rem" }}>
                    <strong>Email:</strong> {user.email}
                </p>
                {userDoc?.name && (
                    <p style={{ fontSize: "0.9rem" }}>
                        <strong>Name:</strong> {userDoc.name}
                    </p>
                )}
                {userDoc?.dietType && (
                    <p style={{ fontSize: "0.9rem" }}>
                        <strong>Diet type:</strong> {userDoc.dietType}
                    </p>
                )}
                {userDoc?.allergiesAndSensitivities && (
                    <div style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
                        {userDoc.allergiesAndSensitivities.allergies &&
                            userDoc.allergiesAndSensitivities.allergies
                                .length > 0 && (
                                <p>
                                    <strong>Allergies:</strong>{" "}
                                    {userDoc.allergiesAndSensitivities.allergies.join(
                                        ", ",
                                    )}
                                </p>
                            )}
                        {userDoc.allergiesAndSensitivities.sensitivities &&
                            userDoc.allergiesAndSensitivities.sensitivities
                                .length > 0 && (
                                <p>
                                    <strong>Sensitivities:</strong>{" "}
                                    {userDoc.allergiesAndSensitivities.sensitivities.join(
                                        ", ",
                                    )}
                                </p>
                            )}
                    </div>
                )}
            </section>

            {/* Diet Type & Allergies */}
            <section
                style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.75rem",
                    padding: "1.25rem",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.75rem",
                    }}
                >
                    <h2 style={{ fontSize: "1rem", margin: 0 }}>
                        Diet & Allergies
                    </h2>
                    {!editingDietAllergies && (
                        <button
                            type="button"
                            onClick={handleEditDietAllergies}
                            style={{
                                padding: "0.25rem 0.7rem",
                                borderRadius: "999px",
                                border: "1px solid #111827",
                                fontSize: "0.8rem",
                                background: "#ffffff",
                                color: "#111827",
                                cursor: "pointer",
                            }}
                        >
                            Edit
                        </button>
                    )}
                </div>
                <p style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "1rem" }}>
                    Help us personalize meals and avoid ingredients that don&apos;t work for you.
                </p>

                {!editingDietAllergies ? (
                    <div style={{ fontSize: "0.9rem" }}>
                        {userDoc?.dietType ? (
                            <p style={{ marginBottom: "0.5rem" }}>
                                <strong>Diet focus:</strong>{" "}
                                {getDietLabel(userDoc.dietType)}
                            </p>
                        ) : (
                            <p style={{ marginBottom: "0.5rem", color: "#6b7280" }}>
                                <strong>Diet focus:</strong> Not set
                            </p>
                        )}
                        {userDoc?.allergiesAndSensitivities?.allergies &&
                        userDoc.allergiesAndSensitivities.allergies.length > 0 ? (
                            <p style={{ marginBottom: "0.5rem" }}>
                                <strong>Allergies:</strong>{" "}
                                {userDoc.allergiesAndSensitivities.allergies.join(", ")}
                            </p>
                        ) : (
                            <p style={{ marginBottom: "0.5rem", color: "#6b7280" }}>
                                <strong>Allergies:</strong> None selected
                            </p>
                        )}
                        {userDoc?.allergiesAndSensitivities?.sensitivities &&
                        userDoc.allergiesAndSensitivities.sensitivities.length > 0 ? (
                            <p>
                                <strong>Sensitivities:</strong>{" "}
                                {userDoc.allergiesAndSensitivities.sensitivities.join(", ")}
                            </p>
                        ) : (
                            <p style={{ color: "#6b7280" }}>
                                <strong>Sensitivities:</strong> None selected
                            </p>
                        )}

                        {dietAllergiesMessage && (
                            <p
                                style={{
                                    marginTop: "0.75rem",
                                    fontSize: "0.85rem",
                                    color: "#059669",
                                }}
                            >
                                {dietAllergiesMessage}
                            </p>
                        )}
                    </div>
                ) : (
                    <div>
                        {/* Diet type select */}
                        <div style={{ marginBottom: "1.25rem" }}>
                            <h3 style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                                Diet focus
                            </h3>
                            <select
                                value={selectedDietType}
                                onChange={(e) => setSelectedDietType(e.target.value)}
                                style={{
                                    padding: "0.4rem 0.5rem",
                                    borderRadius: "0.5rem",
                                    border: "1px solid #d1d5db",
                                    fontSize: "0.85rem",
                                    minWidth: 200,
                                }}
                            >
                                <option value="">None</option>
                                {DIET_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Allergies checkboxes */}
                        <div style={{ marginBottom: "1.25rem" }}>
                            <h3 style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                                Allergies
                            </h3>
                            <div
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "0.5rem",
                                }}
                            >
                                {ALLERGY_OPTIONS.map((item) => (
                                    <label
                                        key={item}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.3rem",
                                            padding: "0.3rem 0.6rem",
                                            borderRadius: "0.5rem",
                                            border: selectedAllergies.includes(item)
                                                ? "1px solid #111827"
                                                : "1px solid #d1d5db",
                                            background: selectedAllergies.includes(item)
                                                ? "#f3f4f6"
                                                : "#ffffff",
                                            cursor: "pointer",
                                            fontSize: "0.85rem",
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedAllergies.includes(item)}
                                            onChange={() => toggleAllergy(item)}
                                            style={{ margin: 0 }}
                                        />
                                        {item}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Sensitivities checkboxes */}
                        <div style={{ marginBottom: "1.25rem" }}>
                            <h3 style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                                Sensitivities
                            </h3>
                            <div
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "0.5rem",
                                }}
                            >
                                {SENSITIVITY_OPTIONS.map((item) => (
                                    <label
                                        key={item}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.3rem",
                                            padding: "0.3rem 0.6rem",
                                            borderRadius: "0.5rem",
                                            border: selectedSensitivities.includes(item)
                                                ? "1px solid #111827"
                                                : "1px solid #d1d5db",
                                            background: selectedSensitivities.includes(item)
                                                ? "#f3f4f6"
                                                : "#ffffff",
                                            cursor: "pointer",
                                            fontSize: "0.85rem",
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedSensitivities.includes(item)}
                                            onChange={() => toggleSensitivity(item)}
                                            style={{ margin: 0 }}
                                        />
                                        {item}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Save / Cancel buttons */}
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                                type="button"
                                onClick={() => void handleSaveDietAllergies()}
                                disabled={savingDietAllergies}
                                style={{
                                    padding: "0.4rem 0.9rem",
                                    borderRadius: "999px",
                                    border: "1px solid #111827",
                                    fontSize: "0.85rem",
                                    background: "#111827",
                                    color: "#ffffff",
                                    opacity: savingDietAllergies ? 0.7 : 1,
                                    cursor: savingDietAllergies ? "default" : "pointer",
                                }}
                            >
                                {savingDietAllergies ? "Saving…" : "Save changes"}
                            </button>
                            <button
                                type="button"
                                onClick={handleCancelEditDietAllergies}
                                disabled={savingDietAllergies}
                                style={{
                                    padding: "0.4rem 0.9rem",
                                    borderRadius: "999px",
                                    border: "1px solid #d1d5db",
                                    fontSize: "0.85rem",
                                    background: "#ffffff",
                                    color: "#111827",
                                    cursor: savingDietAllergies ? "default" : "pointer",
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {/* Diet instructions (from doctor, but user-facing label is generic) */}
            <section
                style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.75rem",
                    padding: "1.25rem",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.75rem",
                    }}
                >
                    <h2 style={{ fontSize: "1rem", margin: 0 }}>Diet instructions</h2>

                    {hasDoctorNote && (
                        <button
                            type="button"
                            style={{
                                padding: "0.25rem 0.7rem",
                                borderRadius: "999px",
                                border: "1px solid #111827",
                                fontSize: "0.8rem",
                                background: "#ffffff",
                                color: "#111827",
                                cursor: "pointer",
                            }}
                            onClick={() => {
                                router.push("/doctor-note");
                            }}
                        >
                            Edit
                        </button>
                    )}
                </div>

                <p
                    style={{
                        fontSize: "0.85rem",
                        color: "#6b7280",
                        marginBottom: "0.75rem",
                    }}
                >
                    Tell CartSense what foods your doctor asked you to stay away from. We&apos;ll
                    filter meal suggestions around those foods where possible.
                </p>

                {!hasDoctorNote ? (
                    <>
                        <div
                            style={{
                                padding: "0.75rem 1rem",
                                borderRadius: "0.75rem",
                                border: "1px dashed #d1d5db",
                                background: "#f9fafb",
                                fontSize: "0.85rem",
                                color: "#4b5563",
                                marginBottom: "0.75rem",
                            }}
                        >
                            <strong>No diet instructions saved yet.</strong>
                            <br />
                            Upload a photo of your doctor&apos;s note or add foods manually, and
                            CartSense will avoid them in your meal suggestions.
                        </div>

                        <button
                            type="button"
                            style={{
                                padding: "0.45rem 0.9rem",
                                borderRadius: "999px",
                                border: "1px solid #111827",
                                fontSize: "0.85rem",
                                background: "#111827",
                                color: "#ffffff",
                                cursor: "pointer",
                            }}
                            onClick={() => {
                                router.push("/doctor-note");
                            }}
                        >
                            Add diet instructions
                        </button>
                    </>
                ) : (
                    <>
                        <div
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.4rem",
                                padding: "0.25rem 0.75rem",
                                borderRadius: "999px",
                                border: "1px solid #0f766e",
                                background: "#ecfdf5",
                                fontSize: "0.8rem",
                                color: "#0f766e",
                                marginBottom: "0.5rem",
                            }}
                        >
                            <span
                                style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "999px",
                                    background: "#0f766e",
                                }}
                            />
                            Diet instructions active
                        </div>

                        {doctor?.updatedAt && (
                            <p
                                style={{
                                    fontSize: "0.8rem",
                                    color: "#6b7280",
                                    marginTop: 0,
                                    marginBottom: "0.5rem",
                                }}
                            >
                                Last updated: {formatDoctorUpdatedAt(doctor.updatedAt)}
                            </p>
                        )}

                        {doctor?.summaryText && (
                            <p
                                style={{
                                    fontSize: "0.85rem",
                                    marginBottom: "0.5rem",
                                }}
                            >
                                <strong>Summary:</strong> {doctor.summaryText}
                            </p>
                        )}

                        {doctor?.blockedIngredients &&
                            doctor.blockedIngredients.length > 0 && (
                                <div style={{ marginBottom: "0.4rem" }}>
                                    <strong style={{ fontSize: "0.8rem" }}>
                                        Blocked ingredients:
                                    </strong>
                                    <div
                                        style={{
                                            display: "flex",
                                            flexWrap: "wrap",
                                            gap: "0.35rem",
                                            marginTop: "0.35rem",
                                        }}
                                    >
                                        {doctor.blockedIngredients.map((item) => (
                                            <span
                                                key={item}
                                                style={{
                                                    fontSize: "0.75rem",
                                                    padding: "0.15rem 0.5rem",
                                                    borderRadius: "999px",
                                                    border: "1px solid #d1d5db",
                                                    background: "#f9fafb",
                                                }}
                                            >
                                                {item}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                        {doctor?.blockedGroups && doctor.blockedGroups.length > 0 && (
                            <div style={{ marginBottom: "0.4rem" }}>
                                <strong style={{ fontSize: "0.8rem" }}>
                                    Blocked groups:
                                </strong>
                                <div
                                    style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: "0.35rem",
                                        marginTop: "0.35rem",
                                    }}
                                >
                                    {doctor.blockedGroups.map((item) => (
                                        <span
                                            key={item}
                                            style={{
                                                fontSize: "0.75rem",
                                                padding: "0.15rem 0.5rem",
                                                borderRadius: "999px",
                                                border: "1px solid #d1d5db",
                                                background: "#f9fafb",
                                            }}
                                        >
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => void handleRemoveDoctorInstructions()}
                            disabled={removingDoctorNote}
                            style={{
                                marginTop: "0.75rem",
                                padding: "0.35rem 0.8rem",
                                borderRadius: "999px",
                                border: "1px solid #d1d5db",
                                fontSize: "0.8rem",
                                background: "#ffffff",
                                color: "#b91c1c",
                                cursor: removingDoctorNote ? "default" : "pointer",
                                opacity: removingDoctorNote ? 0.7 : 1,
                            }}
                        >
                            {removingDoctorNote
                                ? "Removing…"
                                : "Remove diet instructions"}
                        </button>

                        {doctorNoteMessage && (
                            <p
                                style={{
                                    marginTop: "0.5rem",
                                    fontSize: "0.8rem",
                                    color: "#4b5563",
                                }}
                            >
                                {doctorNoteMessage}
                            </p>
                        )}
                    </>
                )}
            </section>

            {/* Kroger Account */}
            <section
                style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.75rem",
                    padding: "1.25rem",
                }}
            >
                <h2
                    style={{
                        marginBottom: "0.75rem",
                        fontSize: "1rem",
                    }}
                >
                    Kroger Account
                </h2>
                <p style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "1rem" }}>
                    Link your Kroger account to add items directly to your Kroger cart.
                </p>

                {userDoc?.krogerLinked ? (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.75rem",
                            padding: "0.75rem 1rem",
                            background: "#f0fdf4",
                            border: "1px solid #bbf7d0",
                            borderRadius: "0.5rem",
                        }}
                    >
                        <span
                            style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                background: "#22c55e",
                            }}
                        />
                        <span style={{ fontSize: "0.9rem", color: "#166534" }}>
                            Your Kroger account is linked
                        </span>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => {
                            if (user) {
                                window.location.href = `/api/kroger/auth?userId=${user.uid}`;
                            }
                        }}
                        style={{
                            padding: "0.5rem 1rem",
                            borderRadius: "999px",
                            border: "1px solid #0056a3",
                            fontSize: "0.9rem",
                            background: "#0056a3",
                            color: "#ffffff",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                        }}
                    >
                        Link Kroger Account
                    </button>
                )}

                {krogerMessage && (
                    <p
                        style={{
                            marginTop: "0.75rem",
                            fontSize: "0.85rem",
                            color: krogerMessageType === "success" ? "#059669" : "#b91c1c",
                        }}
                    >
                        {krogerMessage}
                    </p>
                )}
            </section>

            {/* Locations */}
            <section
                style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.75rem",
                    padding: "1.25rem",
                }}
            >
                <h2
                    style={{
                        marginBottom: "0.75rem",
                        fontSize: "1rem",
                    }}
                >
                    Shopping locations
                </h2>
                <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                    Link your Kroger store to help CartSense pick products and
                    prices.
                </p>

                {/* Existing locations */}
                <div style={{ marginTop: "1rem", marginBottom: "1rem" }}>
                    <h3
                        style={{
                            fontSize: "0.9rem",
                            marginBottom: "0.5rem",
                        }}
                    >
                        Your locations
                    </h3>
                    {loadingLocations ? (
                        <p style={{ fontSize: "0.85rem" }}>
                            Loading locations…
                        </p>
                    ) : locations.length === 0 ? (
                        <p
                            style={{
                                fontSize: "0.85rem",
                                color: "#6b7280",
                            }}
                        >
                            You haven’t added any stores yet.
                        </p>
                    ) : (
                        <ul
                            style={{
                                listStyle: "none",
                                padding: 0,
                                margin: 0,
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.5rem",
                            }}
                        >
                            {locations.map((loc) => (
                                <li
                                    key={loc.id}
                                    style={{
                                        border: "1px solid #e5e7eb",
                                        borderRadius: "0.75rem",
                                        padding: "0.75rem 0.9rem",
                                        display: "flex",
                                        alignItems: "flex-start",
                                        justifyContent: "space-between",
                                        gap: "0.75rem",
                                    }}
                                >
                                    <div>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "0.4rem",
                                                marginBottom: "0.15rem",
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: "0.9rem",
                                                    fontWeight: 500,
                                                }}
                                            >
                                                {loc.name}
                                            </span>
                                            {loc.isDefault && (
                                                <span
                                                    style={{
                                                        fontSize: "0.7rem",
                                                        padding:
                                                            "0.05rem 0.4rem",
                                                        borderRadius:
                                                            "999px",
                                                        border: "1px solid #111827",
                                                        textTransform:
                                                            "uppercase",
                                                        letterSpacing:
                                                            "0.05em",
                                                    }}
                                                >
                                                    Default
                                                </span>
                                            )}
                                        </div>
                                        <p
                                            style={{
                                                fontSize: "0.8rem",
                                                margin: 0,
                                                color: "#4b5563",
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontFamily:
                                                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace",
                                                }}
                                            >
                                                ID: {loc.krogerLocationId}
                                            </span>
                                        </p>
                                        {(loc.addressLine1 ||
                                            loc.city ||
                                            loc.state ||
                                            loc.zip) && (
                                            <p
                                                style={{
                                                    fontSize: "0.8rem",
                                                    marginTop: "0.25rem",
                                                    color: "#4b5563",
                                                }}
                                            >
                                                {loc.addressLine1 && (
                                                    <>
                                                        {loc.addressLine1}
                                                        <br />
                                                    </>
                                                )}
                                                {(loc.city ||
                                                    loc.state ||
                                                    loc.zip) && (
                                                    <>
                                                        {loc.city &&
                                                            `${loc.city}, `}
                                                        {loc.state}
                                                        {loc.zip &&
                                                            ` ${loc.zip}`}
                                                    </>
                                                )}
                                            </p>
                                        )}
                                    </div>

                                    {!loc.isDefault && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                void handleSetDefault(loc)
                                            }
                                            style={{
                                                alignSelf: "center",
                                                padding:
                                                    "0.25rem 0.7rem",
                                                borderRadius: "999px",
                                                border: "1px solid #111827",
                                                fontSize: "0.8rem",
                                                background: "#111827",
                                                color: "#ffffff",
                                                cursor: "pointer",
                                            }}
                                        >
                                            Set as default
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Find store by ZIP */}
                <div
                    style={{
                        borderTop: "1px solid #e5e7eb",
                        paddingTop: "1rem",
                        marginTop: "0.75rem",
                        marginBottom: "0.75rem",
                    }}
                >
                    <h3
                        style={{
                            fontSize: "0.9rem",
                            marginBottom: "0.5rem",
                        }}
                    >
                        Find a store by ZIP
                    </h3>

                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "0.5rem",
                            alignItems: "center",
                            maxWidth: 420,
                            marginBottom: "0.5rem",
                        }}
                    >
                        <input
                            value={zipSearch}
                            onChange={(e) => setZipSearch(e.target.value)}
                            placeholder="e.g. 89502"
                            style={{
                                flex: "0 0 120px",
                                padding: "0.4rem 0.5rem",
                                borderRadius: "0.5rem",
                                border: "1px solid #d1d5db",
                                fontSize: "0.85rem",
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => void handleSearchStoresByZip()}
                            disabled={searchingStores}
                            style={{
                                padding: "0.4rem 0.9rem",
                                borderRadius: "999px",
                                border: "1px solid #111827",
                                fontSize: "0.85rem",
                                background: "#111827",
                                color: "#ffffff",
                                opacity: searchingStores ? 0.7 : 1,
                                cursor: searchingStores
                                    ? "default"
                                    : "pointer",
                            }}
                        >
                            {searchingStores ? "Searching…" : "Find stores"}
                        </button>
                    </div>

                    {storeSearchError && (
                        <p
                            style={{
                                fontSize: "0.8rem",
                                color: "#b91c1c",
                                marginBottom: "0.3rem",
                            }}
                        >
                            {storeSearchError}
                        </p>
                    )}

                    {storeResults.length > 0 && (
                        <ul
                            style={{
                                listStyle: "none",
                                padding: 0,
                                margin: 0,
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.5rem",
                                maxWidth: 500,
                            }}
                        >
                            {storeResults.map((store) => (
                                <li
                                    key={store.locationId}
                                    style={{
                                        border: "1px solid #e5e7eb",
                                        borderRadius: "0.75rem",
                                        padding: "0.6rem 0.8rem",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        gap: "0.75rem",
                                    }}
                                >
                                    <div>
                                        <div
                                            style={{
                                                fontSize: "0.9rem",
                                                fontWeight: 500,
                                                marginBottom: "0.1rem",
                                            }}
                                        >
                                            {store.name}
                                        </div>
                                        <p
                                            style={{
                                                fontSize: "0.8rem",
                                                margin: 0,
                                                color: "#4b5563",
                                            }}
                                        >
                                            {store.addressLine1}
                                            <br />
                                            {store.city}, {store.state}{" "}
                                            {store.zipCode}
                                            <br />
                                            <span
                                                style={{
                                                    fontFamily:
                                                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace",
                                                }}
                                            >
                                                ID: {store.locationId}
                                            </span>
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleUseStoreFromSearch(store)
                                        }
                                        disabled={savingLocation}
                                        style={{
                                            alignSelf: "center",
                                            padding: "0.25rem 0.7rem",
                                            borderRadius: "999px",
                                            border: "1px solid #111827",
                                            fontSize: "0.8rem",
                                            background: "#ffffff",
                                            color: "#111827",
                                            cursor: savingLocation
                                                ? "default"
                                                : "pointer",
                                            opacity: savingLocation ? 0.7 : 1,
                                        }}
                                    >
                                        {savingLocation
                                            ? "Saving…"
                                            : "Use this store"}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Location message */}
                {locationMessage && (
                    <div
                        style={{
                            borderTop: "1px solid #e5e7eb",
                            paddingTop: "1rem",
                            marginTop: "0.75rem",
                        }}
                    >
                        <p
                            style={{
                                fontSize: "0.85rem",
                                color: "#059669",
                            }}
                        >
                            {locationMessage}
                        </p>
                    </div>
                )}
            </section>
        </div>
    );
}
