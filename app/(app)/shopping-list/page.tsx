"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
    collection,
    onSnapshot,
    deleteDoc,
    doc,
    query,
    orderBy,
    updateDoc,
    addDoc,
    getDocs,
    serverTimestamp,
} from "firebase/firestore";
import {
    List,
    Trash2,
    ExternalLink,
    X,
    Link,
    Clock,
    ChefHat,
    MapPin,
    Lightbulb,
    Plus,
    Minus,
    Loader2,
    RefreshCw,
    Search,
    CheckCircle,
    ShoppingCart,
} from "lucide-react";
import { getRandomAccentColor, getStoreBrand, type AccentColor, type StoreBrandInfo } from "@/lib/utils";
import { useToast } from "@/components/Toast";

type ShoppingItem = {
    id: string;
    name: string;
    quantity: string;
    count?: number; // Number of this item (default 1)
    mealId?: string;
    mealName?: string;
    checked: boolean;
    createdAt?: unknown;
    krogerProductId?: string;
    productName?: string;
    productImageUrl?: string;
    productSize?: string;
    productAisle?: string;
    price?: number;
    soldBy?: "WEIGHT" | "UNIT";
    stockLevel?: string; // HIGH, LOW, or TEMPORARILY_OUT_OF_STOCK
};

type KrogerLinkStatus = "loading" | "linked" | "not_linked" | "no_store";

type KrogerProduct = {
    krogerProductId: string;
    name: string;
    imageUrl?: string;
    price?: number;
    size?: string;
    aisle?: string;
};

type EnrichedItem = {
    originalName: string;
    quantity: string;
    found: boolean;
    product?: KrogerProduct;
};

type KrogerCartResponse = {
    success: boolean;
    message: string;
    enrichedItems?: EnrichedItem[];
    addedCount?: number;
    notFoundCount?: number;
    error?: string;
};

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

export default function ShoppingListPage() {
    const router = useRouter();
    const { showToast } = useToast();

    const [user, setUser] = useState<User | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [items, setItems] = useState<ShoppingItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(true);

    const [krogerLinkStatus, setKrogerLinkStatus] = useState<KrogerLinkStatus>("loading");
    const [storeBrand, setStoreBrand] = useState<StoreBrandInfo>({ displayName: "Kroger", tagline: "Kroger Family of Stores", cartUrl: "https://www.kroger.com/cart" });
    const [addingToKroger, setAddingToKroger] = useState(false);
    const [krogerResults, setKrogerResults] = useState<EnrichedItem[] | null>(null);
    const [showKrogerResults, setShowKrogerResults] = useState(false);
    const [accentColor, setAccentColor] = useState<AccentColor>({ primary: "#3b82f6", dark: "#2563eb" });
    const [removeConfirmDateKey, setRemoveConfirmDateKey] = useState<string | null>(null);
    const [showPantryTip, setShowPantryTip] = useState(true);

    // Item detail modal state (same pattern as meal details)
    const [selectedItem, setSelectedItem] = useState<ShoppingItem | null>(null);
    const [swapAlternatives, setSwapAlternatives] = useState<KrogerProduct[] | null>(null);
    const [loadingSwapSuggestions, setLoadingSwapSuggestions] = useState(false);
    const [showSwapOptions, setShowSwapOptions] = useState(false);
    const [swappingItem, setSwappingItem] = useState(false);

    // Kroger link modal state
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [locations, setLocations] = useState<UserLocation[]>([]);
    const [loadingLocations, setLoadingLocations] = useState(true);
    const [zipSearch, setZipSearch] = useState("");
    const [storeResults, setStoreResults] = useState<KrogerLocationSearchResult[]>([]);
    const [searchingStores, setSearchingStores] = useState(false);
    const [storeSearchError, setStoreSearchError] = useState<string | null>(null);
    const [savingLocation, setSavingLocation] = useState(false);
    const [krogerLinked, setKrogerLinked] = useState(false);

    useEffect(() => {
        setAccentColor(getRandomAccentColor());
    }, []);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (firebaseUser) => {
            if (!firebaseUser) {
                router.push("/login");
                return;
            }

            setUser(firebaseUser);
            setLoadingUser(false);
        });

        return () => unsub();
    }, [router]);

    // Check Kroger status - runs on mount and when page becomes visible (for OAuth callback)
    useEffect(() => {
        if (!user) return;

        const checkKrogerStatus = async () => {
            try {
                // Use server-side API to check Kroger status (bypasses Firestore rules)
                const res = await fetch(`/api/kroger/status?userId=${user.uid}`);
                const data = await res.json();

                console.log("Kroger status API response:", data);

                if (!res.ok) {
                    console.error("Kroger status check failed:", data);
                    setKrogerLinkStatus("not_linked");
                    return;
                }

                if (!data.linked) {
                    setKrogerLinkStatus("not_linked");
                    setKrogerLinked(false);
                } else if (data.hasStore) {
                    setKrogerLinkStatus("linked");
                    setKrogerLinked(true);
                    // Set store brand based on store name from API
                    if (data.storeName) {
                        setStoreBrand(getStoreBrand(data.storeName));
                    }
                } else {
                    setKrogerLinkStatus("no_store");
                    setKrogerLinked(true);
                }
            } catch (err) {
                console.error("Error checking Kroger status", err);
                setKrogerLinkStatus("not_linked");
            }
        };

        void checkKrogerStatus();

        // Re-check when page becomes visible (handles return from OAuth flow)
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                void checkKrogerStatus();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [user]);

    // Load locations when modal opens
    useEffect(() => {
        if (!user || !showLinkModal) return;

        const loadLocations = async () => {
            setLoadingLocations(true);
            try {
                const locCol = collection(db, "krogerLocations", user.uid, "locations");
                const snap = await getDocs(locCol);
                const locs: UserLocation[] = snap.docs.map((d) => ({
                    id: d.id,
                    ...(d.data() as Omit<UserLocation, "id">),
                }));
                setLocations(locs);
            } catch (err) {
                console.error("Error loading locations", err);
            } finally {
                setLoadingLocations(false);
            }
        };

        void loadLocations();
    }, [user, showLinkModal]);

    useEffect(() => {
        if (!user) return;

        setLoadingItems(true);

        const itemsCol = collection(db, "shoppingLists", user.uid, "items");
        const q = query(itemsCol, orderBy("createdAt", "desc"));

        const unsub = onSnapshot(
            q,
            (snapshot) => {
                const docs: ShoppingItem[] = snapshot.docs.map((d) => ({
                    id: d.id,
                    ...(d.data() as Omit<ShoppingItem, "id">),
                }));
                setItems(docs);
                setLoadingItems(false);
            },
            (error) => {
                console.error("Error listening to shopping list", error);
                setItems([]);
                setLoadingItems(false);
            }
        );

        return () => unsub();
    }, [user]);

    // Enrich items with Kroger product data when Kroger becomes linked
    useEffect(() => {
        if (!user || krogerLinkStatus !== "linked" || items.length === 0) return;

        // Find items that don't have Kroger product data yet
        const itemsToEnrich = items.filter((item) => !item.krogerProductId);
        if (itemsToEnrich.length === 0) return;

        const enrichItems = async () => {
            try {
                // Use the cart endpoint with enrichOnly flag to get product data without adding to cart
                const cartItems = itemsToEnrich.map((item) => ({
                    id: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    count: item.count || 1,
                }));

                const res = await fetch("/api/kroger/cart", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: user.uid, items: cartItems, enrichOnly: true }),
                });

                if (!res.ok) return;

                const data = (await res.json()) as KrogerCartResponse;

                // Update items in Firestore with enriched data
                if (data.enrichedItems && data.enrichedItems.length > 0) {
                    for (const enriched of data.enrichedItems) {
                        if (enriched.found && enriched.product) {
                            const matchingItem = itemsToEnrich.find(
                                (item) => item.name.toLowerCase() === enriched.originalName.toLowerCase()
                            );
                            if (matchingItem) {
                                await updateDoc(doc(db, "shoppingLists", user.uid, "items", matchingItem.id), {
                                    krogerProductId: enriched.product.krogerProductId,
                                    productName: enriched.product.name,
                                    productImageUrl: enriched.product.imageUrl || null,
                                    productSize: enriched.product.size || null,
                                    productAisle: enriched.product.aisle || null,
                                    price: enriched.product.price || null,
                                });
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Error enriching items with Kroger data", err);
            }
        };

        void enrichItems();
    }, [user, krogerLinkStatus, items.length]); // Only re-run when status changes or items count changes

    const handleAddToKrogerCart = async (itemsToAdd: ShoppingItem[]) => {
        if (!user || itemsToAdd.length === 0) return;

        setAddingToKroger(true);
        setKrogerResults(null);

        try {
            const cartItems = itemsToAdd.map((item) => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                count: item.count || 1,
            }));

            const res = await fetch("/api/kroger/cart", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.uid, items: cartItems }),
            });

            const data = (await res.json()) as KrogerCartResponse;

            if (!res.ok) {
                if (data.error === "NOT_LINKED" || data.error === "TOKEN_EXPIRED") {
                    setKrogerLinkStatus("not_linked");
                    showToast(data.message || "Please link your Kroger account first.", "error");
                } else if (data.error === "NO_STORE") {
                    setKrogerLinkStatus("no_store");
                    showToast(data.message || "Please select a Kroger store first.", "error");
                } else {
                    showToast(data.message || "Failed to add items to Kroger cart.", "error");
                }
            } else {
                showToast(data.message || "Items added to your Kroger cart!", "success");
            }

            if (data.enrichedItems && data.enrichedItems.length > 0) {
                setKrogerResults(data.enrichedItems);
                setShowKrogerResults(true);
            }
        } catch (err) {
            console.error("Error adding to Kroger cart:", err);
            showToast("Something went wrong. Please try again.", "error");
        } finally {
            setAddingToKroger(false);
        }
    };

    const handleRemoveItem = async (itemId: string) => {
        if (!user) return;

        try {
            await deleteDoc(doc(db, "shoppingLists", user.uid, "items", itemId));
        } catch (err) {
            console.error("Error deleting shopping list item", err);
        }
    };

    const handleUpdateCount = async (itemId: string, newCount: number) => {
        if (!user) return;
        if (newCount < 1) {
            // If count goes to 0, remove the item
            await handleRemoveItem(itemId);
            return;
        }

        try {
            await updateDoc(doc(db, "shoppingLists", user.uid, "items", itemId), {
                count: newCount,
            });
        } catch (err) {
            console.error("Error updating item count", err);
        }
    };

    const handleOpenItemDetail = (item: ShoppingItem) => {
        setSelectedItem(item);
        setSwapAlternatives(null);
        setShowSwapOptions(false);
    };

    const handleCloseItemDetail = () => {
        setSelectedItem(null);
        setSwapAlternatives(null);
        setShowSwapOptions(false);
    };

    const handleShowSwapOptions = async () => {
        if (!user || !selectedItem) return;

        setLoadingSwapSuggestions(true);
        setSwapAlternatives(null);

        try {
            const res = await fetch("/api/swap-suggestions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user.uid,
                    ingredientName: selectedItem.name,
                    currentProductId: selectedItem.krogerProductId,
                    searchTerm: selectedItem.name,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.error === "NOT_LINKED" || data.error === "NO_STORE") {
                    showToast(data.message, "error");
                    return;
                }
                throw new Error(data.message || "Failed to get swap suggestions");
            }

            if (data.alternatives && data.alternatives.length > 0) {
                setSwapAlternatives(data.alternatives);
                setShowSwapOptions(true);
            } else {
                showToast("No alternative products found.", "info");
            }
        } catch (err) {
            console.error("Error getting swap suggestions:", err);
            showToast("Something went wrong getting swap options.", "error");
        } finally {
            setLoadingSwapSuggestions(false);
        }
    };

    const handleSelectSwap = async (product: KrogerProduct) => {
        if (!user || !selectedItem) return;

        setSwappingItem(true);

        try {
            await updateDoc(doc(db, "shoppingLists", user.uid, "items", selectedItem.id), {
                name: product.name,
                krogerProductId: product.krogerProductId,
                productName: product.name,
                productImageUrl: product.imageUrl || null,
                productSize: product.size || null,
                productAisle: product.aisle || null,
                price: product.price || null,
            });
            showToast(`Swapped to ${product.name}!`, "success");
            setSelectedItem(null);
            setSwapAlternatives(null);
            setShowSwapOptions(false);
        } catch (err) {
            console.error("Error swapping item:", err);
            showToast("Failed to swap item", "error");
        } finally {
            setSwappingItem(false);
        }
    };

    const handleRemoveAllFromDate = async (dateKey: string) => {
        if (!user) return;

        const itemsToRemove = grouped[dateKey];
        if (!itemsToRemove || itemsToRemove.length === 0) return;

        try {
            await Promise.all(
                itemsToRemove.map((item) =>
                    deleteDoc(doc(db, "shoppingLists", user.uid, "items", item.id))
                )
            );
        } catch (err) {
            console.error("Error deleting items from date", err);
        }
    };

    // Store search and selection handlers for modal
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

            const locCol = collection(db, "krogerLocations", user.uid, "locations");

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

            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                defaultKrogerLocationId: store.locationId,
            });

            // Reload locations
            const snap = await getDocs(locCol);
            const locs: UserLocation[] = snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<UserLocation, "id">),
            }));
            setLocations(locs);

            setStoreResults([]);
            setZipSearch("");
            setStoreBrand(getStoreBrand(store.name));

            // Update status if we now have a store
            if (krogerLinked) {
                setKrogerLinkStatus("linked");
            } else {
                setKrogerLinkStatus("no_store");
            }

            showToast(`${store.name} saved as your store.`, "success");
        } catch (err) {
            console.error("Error saving location", err);
            showToast("Something went wrong saving this location.", "error");
        } finally {
            setSavingLocation(false);
        }
    };

    const handleSetDefaultStore = async (loc: UserLocation) => {
        if (!user) return;

        try {
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                defaultKrogerLocationId: loc.krogerLocationId,
            });

            setLocations((prev) =>
                prev.map((l) => ({
                    ...l,
                    isDefault: l.id === loc.id,
                }))
            );
            setStoreBrand(getStoreBrand(loc.name));

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

            if (loc.isDefault && remainingLocations.length > 0) {
                const newDefault = remainingLocations[0];
                const userRef = doc(db, "users", user.uid);
                await updateDoc(userRef, {
                    defaultKrogerLocationId: newDefault.krogerLocationId,
                });

                setLocations(
                    remainingLocations.map((l, idx) => ({
                        ...l,
                        isDefault: idx === 0,
                    }))
                );
                setStoreBrand(getStoreBrand(newDefault.name));
                showToast(`${loc.name} removed. ${newDefault.name} is now your default.`, "success");
            } else if (loc.isDefault || remainingLocations.length === 0) {
                const userRef = doc(db, "users", user.uid);
                await updateDoc(userRef, {
                    defaultKrogerLocationId: null,
                });
                setLocations(remainingLocations);
                setKrogerLinkStatus(krogerLinked ? "no_store" : "not_linked");
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

    const toDate = (ts: unknown): Date => {
        if (ts && typeof ts === "object" && "toDate" in ts && typeof (ts as { toDate: () => Date }).toDate === "function") {
            return (ts as { toDate: () => Date }).toDate();
        }
        return new Date();
    };

    const grouped: Record<string, ShoppingItem[]> = items.reduce(
        (acc, item) => {
            const ts = toDate(item.createdAt);
            const dateKey = ts.toDateString();
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(item);
            return acc;
        },
        {} as Record<string, ShoppingItem[]>
    );

    const sortedDates = Object.keys(grouped).sort(
        (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );

    const formatDate = (ts: unknown) => {
        const d = toDate(ts);
        return d.toLocaleDateString([], {
            weekday: "long",
            month: "long",
            day: "numeric",
        });
    };

    if (loadingUser || loadingItems) {
        return (
            <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-3 border-gray-200 border-t-[#4A90E2] rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-500">Loading your shopping list...</p>
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
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#4A90E2]/10 rounded-xl flex items-center justify-center">
                                <List className="w-5 h-5 text-[#4A90E2]" />
                            </div>
                            <div>
                                <h1 className="text-xl lg:text-2xl text-gray-900">Shopping List</h1>
                                <p className="text-sm text-gray-500">
                                    {items.length} item{items.length !== 1 ? "s" : ""}
                                </p>
                            </div>
                        </div>

                        {/* Kroger Link Status - show link/store buttons in header when not fully set up */}
                        {items.length > 0 && krogerLinkStatus !== "linked" && krogerLinkStatus !== "loading" && (
                            <div className="flex flex-col items-end gap-2">
                                {krogerLinkStatus === "no_store" ? (
                                    <button
                                        onClick={() => setShowLinkModal(true)}
                                        className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                                    >
                                        <MapPin className="w-3.5 h-3.5" />
                                        <span>Select Store</span>
                                    </button>
                                ) : krogerLinkStatus === "not_linked" ? (
                                    <button
                                        onClick={() => setShowLinkModal(true)}
                                        className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                                    >
                                        <Link className="w-3.5 h-3.5" />
                                        <span>Link Kroger</span>
                                    </button>
                                ) : null}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
                <div className="max-w-3xl mx-auto">
                    {items.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <List className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Your list is empty</h3>
                            <p className="text-gray-500 mb-6">
                                Add ingredients from meals to start building your shopping list.
                            </p>
                            <button
                                onClick={() => router.push("/prompt")}
                                style={{
                                    background: `linear-gradient(to right, ${accentColor.primary}, ${accentColor.dark})`,
                                }}
                                className="px-6 py-3 text-white rounded-xl shadow-lg hover:shadow-xl transition-all"
                            >
                                Generate meals
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Pantry Tip */}
                            {showPantryTip && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <Lightbulb className="w-4 h-4 text-amber-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-amber-800">
                                            <span className="font-medium">Tip:</span> Remove items you already have in your pantry to avoid buying duplicates.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setShowPantryTip(false)}
                                        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-amber-100 transition-colors flex-shrink-0"
                                    >
                                        <X className="w-4 h-4 text-amber-600" />
                                    </button>
                                </div>
                            )}

                            {sortedDates.map((dateKey) => {
                                const sectionItems = grouped[dateKey];
                                const firstTS = sectionItems[0]?.createdAt;

                                return (
                                    <div key={dateKey} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                        {/* Date Header */}
                                        <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-100">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                {/* Date and item count */}
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                    <span className="font-medium text-gray-900 text-sm sm:text-base">
                                                        {formatDate(firstTS)}
                                                    </span>
                                                    <span className="text-xs sm:text-sm text-gray-500">
                                                        ({sectionItems.length} item{sectionItems.length !== 1 ? "s" : ""})
                                                    </span>
                                                </div>
                                                {/* Actions */}
                                                <div className="flex items-center gap-2">
                                                    {krogerLinkStatus === "linked" && (
                                                        <button
                                                            onClick={() => void handleAddToKrogerCart(sectionItems)}
                                                            disabled={addingToKroger}
                                                            className="px-3 py-1.5 h-8 bg-[#0056a3] text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-[#004080] transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-1.5"
                                                        >
                                                            {addingToKroger ? (
                                                                <>
                                                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                                    <span>Adding...</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                                    <span>Add to Kroger</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setRemoveConfirmDateKey(dateKey)}
                                                        className="w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Items */}
                                        <ul className="divide-y divide-gray-50">
                                            {sectionItems.map((item) => {
                                                const hasKrogerProduct = krogerLinkStatus === "linked" && !!item.krogerProductId;
                                                const hasProductImage = hasKrogerProduct && item.productImageUrl;
                                                return (
                                                    <li
                                                        key={item.id}
                                                        className="px-5 py-4"
                                                    >
                                                        {/* Clickable area for opening detail modal - only when Kroger is linked */}
                                                        <div
                                                            onClick={() => krogerLinkStatus === "linked" && handleOpenItemDetail(item)}
                                                            className={`flex items-start gap-3 ${krogerLinkStatus === "linked" ? "cursor-pointer" : ""}`}
                                                        >
                                                            {/* Product Image or Icon */}
                                                            {hasProductImage ? (
                                                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                    <img
                                                                        src={item.productImageUrl}
                                                                        alt={item.productName || item.name}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                                                    <ChefHat className="w-6 h-6 text-gray-300" />
                                                                </div>
                                                            )}
                                                            <div className="flex-1">
                                                                <div>
                                                                    <span className="font-medium text-gray-900">
                                                                        {item.name}
                                                                    </span>
                                                                    {hasKrogerProduct && item.stockLevel && item.stockLevel !== "HIGH" && (
                                                                        <span className={`inline-block ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap align-middle ${
                                                                            item.stockLevel === "LOW"
                                                                                ? "bg-amber-100 text-amber-700"
                                                                                : "bg-red-100 text-red-700"
                                                                        }`}>
                                                                            {item.stockLevel === "LOW" ? "Low Stock" : "Out of Stock"}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {hasKrogerProduct && item.productSize && (
                                                                    <div className="text-sm text-gray-500">
                                                                        {item.productSize}
                                                                    </div>
                                                                )}
                                                                {/* Kroger Product Details */}
                                                                {hasKrogerProduct && (
                                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                                                                        {item.productAisle && (
                                                                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                                                                <MapPin className="w-3 h-3" />
                                                                                <span>{item.productAisle}</span>
                                                                            </div>
                                                                        )}
                                                                        {typeof item.price === "number" && (
                                                                            <span className="text-xs font-medium text-[#4A90E2]">
                                                                                ${item.price.toFixed(2)}{item.soldBy === "WEIGHT" ? "/lb" : ""}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Quantity Counter and Delete - below content */}
                                                        <div className="flex items-center justify-between mt-3 pl-15">
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    onClick={() => handleUpdateCount(item.id, (item.count || 1) - 1)}
                                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                                                                >
                                                                    <Minus className="w-4 h-4" />
                                                                </button>
                                                                <span className="w-8 text-center font-medium text-gray-900">
                                                                    {item.count || 1}
                                                                </span>
                                                                <button
                                                                    onClick={() => handleUpdateCount(item.id, (item.count || 1) + 1)}
                                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                                                                >
                                                                    <Plus className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                            <button
                                                                onClick={() => handleRemoveItem(item.id)}
                                                                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Remove Confirmation Modal */}
            {removeConfirmDateKey && grouped[removeConfirmDateKey] && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setRemoveConfirmDateKey(null)}
                    />
                    <div className="relative w-full max-w-sm bg-white rounded-2xl p-6 animate-slide-up">
                        <div className="text-center">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="w-6 h-6 text-red-500" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                Remove {grouped[removeConfirmDateKey].length} item{grouped[removeConfirmDateKey].length !== 1 ? "s" : ""}?
                            </h3>
                            <p className="text-sm text-gray-500 mb-6">
                                You&apos;re about to remove all items from {formatDate(grouped[removeConfirmDateKey][0]?.createdAt)}. This action cannot be undone.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setRemoveConfirmDateKey(null)}
                                    className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        void handleRemoveAllFromDate(removeConfirmDateKey);
                                        setRemoveConfirmDateKey(null);
                                    }}
                                    className="flex-1 py-2.5 px-4 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Kroger Results Modal */}
            {showKrogerResults && krogerResults && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setShowKrogerResults(false)}
                    />
                    <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col animate-slide-up overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
                            <div>
                                <h2 className="text-lg font-medium text-gray-900">Kroger Cart Results</h2>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    {krogerResults.filter(i => i.found).length} of {krogerResults.length} items added
                                </p>
                            </div>
                            <button
                                onClick={() => setShowKrogerResults(false)}
                                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
                            <div className="space-y-3">
                                {krogerResults.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-4 rounded-xl border ${
                                            item.found
                                                ? "bg-emerald-50 border-emerald-200"
                                                : "bg-red-50 border-red-200"
                                        }`}
                                    >
                                        <div className="flex gap-3">
                                            {item.product?.imageUrl && (
                                                <div className="w-14 h-14 rounded-lg overflow-hidden bg-white flex-shrink-0">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={item.product.imageUrl}
                                                        alt={item.product.name}
                                                        className="w-full h-full object-contain"
                                                    />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs text-gray-500 mb-1">
                                                    {item.originalName}
                                                </div>
                                                {item.found && item.product ? (
                                                    <>
                                                        <div className="font-medium text-gray-900 text-sm">
                                                            {item.product.name}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            {item.product.size && (
                                                                <span>{item.product.size}</span>
                                                            )}
                                                            {item.product.price && (
                                                                <span>
                                                                    {item.product.size ? " • " : ""}$
                                                                    {item.product.price.toFixed(2)}
                                                                </span>
                                                            )}
                                                            {item.product.aisle && (
                                                                <span>
                                                                    {item.product.size || item.product.price
                                                                        ? " • "
                                                                        : ""}
                                                                    {item.product.aisle}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="text-sm text-red-600">
                                                        No matching product found
                                                    </div>
                                                )}
                                            </div>
                                            <div
                                                className={`px-2 py-1 rounded-full text-xs font-medium h-fit ${
                                                    item.found
                                                        ? "bg-emerald-100 text-emerald-700"
                                                        : "bg-red-100 text-red-700"
                                                }`}
                                            >
                                                {item.found ? "Added" : "Not found"}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 bg-white shrink-0 space-y-3">
                            {/* Checkout reminder */}
                            {krogerResults.some(i => i.found) && (
                                <div className="bg-[#0056a3]/5 border border-[#0056a3]/20 rounded-xl p-3">
                                    <p className="text-sm text-[#0056a3] text-center">
                                        Items are in your {storeBrand.displayName} cart! Complete your purchase on the {storeBrand.displayName} app or website.
                                    </p>
                                </div>
                            )}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowKrogerResults(false)}
                                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                                >
                                    Close
                                </button>
                                {krogerResults.some(i => i.found) && (
                                    <a
                                        href={storeBrand.cartUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 py-3 bg-[#0056a3] text-white rounded-xl font-medium text-center hover:bg-[#004080] transition-colors flex items-center justify-center gap-2"
                                    >
                                        <span>Go to {storeBrand.displayName}</span>
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Item Detail Modal (same pattern as meal details) */}
            {selectedItem && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
                    <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <h3 className="font-medium text-gray-900">Item Details</h3>
                            <button
                                onClick={handleCloseItemDetail}
                                disabled={swappingItem}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="space-y-4">
                                {/* Product Image */}
                                {krogerLinkStatus === "linked" && selectedItem.productImageUrl ? (
                                    <div className="w-full aspect-square max-w-[200px] mx-auto rounded-xl overflow-hidden bg-gray-100">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={selectedItem.productImageUrl}
                                            alt={selectedItem.productName || selectedItem.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-full aspect-square max-w-[200px] mx-auto rounded-xl bg-gray-100 flex items-center justify-center">
                                        <ChefHat className="w-16 h-16 text-gray-300" />
                                    </div>
                                )}

                                {/* Item Name */}
                                <div className="text-center">
                                    <h4 className="text-lg font-medium text-gray-900">{selectedItem.name}</h4>
                                    {krogerLinkStatus === "linked" && selectedItem.productName && selectedItem.productName !== selectedItem.name && (
                                        <p className="text-sm text-gray-500 mt-1">{selectedItem.productName}</p>
                                    )}
                                </div>

                                {/* Details Grid - only show Kroger details when linked */}
                                {krogerLinkStatus === "linked" && (
                                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                                        {selectedItem.productSize && (
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-500">Size</span>
                                                <span className="text-sm font-medium text-gray-900">
                                                    {selectedItem.productSize}
                                                </span>
                                            </div>
                                        )}
                                        {selectedItem.productAisle && (
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-500">Aisle</span>
                                                <span className="text-sm font-medium text-gray-900">{selectedItem.productAisle}</span>
                                            </div>
                                        )}
                                        {typeof selectedItem.price === "number" && (
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-500">Price</span>
                                                <span className="text-sm font-medium text-[#4A90E2]">
                                                    ${selectedItem.price.toFixed(2)}{selectedItem.soldBy === "WEIGHT" ? "/lb" : ""}
                                                </span>
                                            </div>
                                        )}
                                        {selectedItem.stockLevel && (
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-500">Stock</span>
                                                <span className={`text-sm font-medium ${
                                                    selectedItem.stockLevel === "HIGH"
                                                        ? "text-emerald-600"
                                                        : selectedItem.stockLevel === "LOW"
                                                            ? "text-amber-600"
                                                            : "text-red-600"
                                                }`}>
                                                    {selectedItem.stockLevel === "HIGH"
                                                        ? "In Stock"
                                                        : selectedItem.stockLevel === "LOW"
                                                            ? "Low Stock"
                                                            : "Out of Stock"}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer with Swap Button */}
                        <div className="p-4 border-t border-gray-100 space-y-3">
                            {showSwapOptions && swapAlternatives ? (
                                <>
                                    <p className="text-sm text-gray-600 font-medium mb-2">Choose a different product:</p>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {swapAlternatives.map((product) => (
                                            <button
                                                key={product.krogerProductId}
                                                onClick={() => handleSelectSwap(product)}
                                                disabled={swappingItem}
                                                className="w-full p-3 bg-gray-50 hover:bg-[#4A90E2]/10 border border-gray-200 hover:border-[#4A90E2] rounded-xl text-left transition-colors disabled:opacity-50 flex items-center gap-3"
                                            >
                                                {product.imageUrl ? (
                                                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-white flex-shrink-0">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={product.imageUrl}
                                                            alt={product.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="w-14 h-14 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                                                        <ChefHat className="w-6 h-6 text-gray-400" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-gray-900 text-sm line-clamp-2">{product.name}</div>
                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                        {product.size && <span>{product.size}</span>}
                                                        {product.aisle && <span> • {product.aisle}</span>}
                                                    </div>
                                                    {typeof product.price === "number" && (
                                                        <div className="text-sm font-medium text-[#4A90E2] mt-0.5">
                                                            ${product.price.toFixed(2)}
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowSwapOptions(false);
                                            setSwapAlternatives(null);
                                        }}
                                        className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={handleShowSwapOptions}
                                        disabled={loadingSwapSuggestions}
                                        className="w-full py-3 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-70"
                                    >
                                        {loadingSwapSuggestions ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                <span>Finding products...</span>
                                            </>
                                        ) : (
                                            <>
                                                <RefreshCw className="w-5 h-5" />
                                                <span>Swap Product</span>
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={handleCloseItemDetail}
                                        disabled={loadingSwapSuggestions}
                                        className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium disabled:opacity-50"
                                    >
                                        Close
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Kroger Link Modal */}
            {showLinkModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#0056a3]/10 rounded-xl flex items-center justify-center">
                                    <ShoppingCart className="w-5 h-5 text-[#0056a3]" />
                                </div>
                                <div>
                                    <h2 className="font-medium text-gray-900">Store & Account</h2>
                                    <p className="text-xs text-gray-500">Connect to add items to your cart</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowLinkModal(false)}
                                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="px-5 py-4 space-y-5 overflow-y-auto flex-1">
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
                                                            onClick={() => void handleSetDefaultStore(loc)}
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
                                            className="p-2.5 bg-gray-900 text-white rounded-xl disabled:opacity-70 flex items-center justify-center flex-shrink-0"
                                            aria-label="Search"
                                        >
                                            {searchingStores ? (
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <Search className="w-5 h-5" />
                                            )}
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
                                                        onClick={() => void handleUseStoreFromSearch(store)}
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
                            </div>

                            {/* Divider */}
                            <div className="border-t border-gray-100" />

                            {/* Step 2: Account Linking */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                        krogerLinked ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"
                                    }`}>
                                        {krogerLinked ? <CheckCircle className="w-4 h-4" /> : "2"}
                                    </div>
                                    <span className="text-sm font-medium text-gray-900">Connect Your Account</span>
                                </div>

                                <div className="ml-8">
                                    {krogerLinked ? (
                                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full">
                                            <CheckCircle className="w-4 h-4" />
                                            <span className="text-sm font-medium">Account linked</span>
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
                                                <span>Link Store Account</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
                            <button
                                onClick={() => setShowLinkModal(false)}
                                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
