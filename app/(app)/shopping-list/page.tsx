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
    getDoc,
} from "firebase/firestore";
import {
    List,
    Trash2,
    ExternalLink,
    CheckCircle,
    AlertCircle,
    X,
    Link,
    Clock,
    ChefHat,
    MapPin,
} from "lucide-react";
import { getRandomAccentColor, type AccentColor } from "@/lib/utils";

type ShoppingItem = {
    id: string;
    name: string;
    quantity: string;
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
};

type KrogerLinkStatus = "loading" | "linked" | "not_linked";

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

export default function ShoppingListPage() {
    const router = useRouter();

    const [user, setUser] = useState<User | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [items, setItems] = useState<ShoppingItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(true);

    const [krogerLinkStatus, setKrogerLinkStatus] = useState<KrogerLinkStatus>("loading");
    const [addingToKroger, setAddingToKroger] = useState(false);
    const [krogerMessage, setKrogerMessage] = useState<string | null>(null);
    const [krogerMessageType, setKrogerMessageType] = useState<"success" | "error">("success");
    const [krogerResults, setKrogerResults] = useState<EnrichedItem[] | null>(null);
    const [showKrogerResults, setShowKrogerResults] = useState(false);
    const [accentColor, setAccentColor] = useState<AccentColor>({ primary: "#3b82f6", dark: "#2563eb" });

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

    useEffect(() => {
        if (!user) return;

        const checkKrogerStatus = async () => {
            try {
                const userRef = doc(db, "users", user.uid);
                const snap = await getDoc(userRef);
                if (snap.exists() && snap.data()?.krogerLinked) {
                    setKrogerLinkStatus("linked");
                } else {
                    setKrogerLinkStatus("not_linked");
                }
            } catch (err) {
                console.error("Error checking Kroger status", err);
                setKrogerLinkStatus("not_linked");
            }
        };

        void checkKrogerStatus();
    }, [user]);

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

    const handleAddToKrogerCart = async () => {
        if (!user || items.length === 0) return;

        setAddingToKroger(true);
        setKrogerMessage(null);
        setKrogerResults(null);

        try {
            const cartItems = items.map((item) => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
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
                    setKrogerMessage(data.message || "Please link your Kroger account first.");
                } else {
                    setKrogerMessage(data.message || "Failed to add items to Kroger cart.");
                }
                setKrogerMessageType("error");
            } else {
                setKrogerMessage(data.message || "Items added to your Kroger cart!");
                setKrogerMessageType("success");
            }

            if (data.enrichedItems && data.enrichedItems.length > 0) {
                setKrogerResults(data.enrichedItems);
                setShowKrogerResults(true);
            }
        } catch (err) {
            console.error("Error adding to Kroger cart:", err);
            setKrogerMessage("Something went wrong. Please try again.");
            setKrogerMessageType("error");
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

                        {/* Kroger Actions */}
                        {items.length > 0 && (
                            <div className="flex flex-col items-end gap-2">
                                {krogerLinkStatus === "linked" ? (
                                    <button
                                        onClick={() => void handleAddToKrogerCart()}
                                        disabled={addingToKroger}
                                        className="px-4 py-2.5 bg-[#0056a3] text-white rounded-xl text-sm font-medium hover:bg-[#004080] transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {addingToKroger ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Adding...</span>
                                            </>
                                        ) : (
                                            <>
                                                <ExternalLink className="w-4 h-4" />
                                                <span>Add to Kroger Cart</span>
                                            </>
                                        )}
                                    </button>
                                ) : krogerLinkStatus === "not_linked" ? (
                                    <button
                                        onClick={() => router.push("/account")}
                                        className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
                                    >
                                        <Link className="w-4 h-4" />
                                        <span>Link Kroger</span>
                                    </button>
                                ) : null}
                            </div>
                        )}
                    </div>

                    {/* Kroger Message */}
                    {krogerMessage && (
                        <div
                            className={`mt-4 flex items-center gap-2 p-3 rounded-xl ${
                                krogerMessageType === "success"
                                    ? "bg-emerald-50 border border-emerald-200"
                                    : "bg-red-50 border border-red-200"
                            }`}
                        >
                            {krogerMessageType === "success" ? (
                                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                            )}
                            <span
                                className={`text-sm ${
                                    krogerMessageType === "success" ? "text-emerald-700" : "text-red-700"
                                }`}
                            >
                                {krogerMessage}
                            </span>
                        </div>
                    )}
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
                            {sortedDates.map((dateKey) => {
                                const sectionItems = grouped[dateKey];
                                const firstTS = sectionItems[0]?.createdAt;

                                return (
                                    <div key={dateKey} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                        {/* Date Header */}
                                        <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-4 h-4 text-gray-400" />
                                                    <span className="font-medium text-gray-900">
                                                        {formatDate(firstTS)}
                                                    </span>
                                                    <span className="text-sm text-gray-500">
                                                        ({sectionItems.length} item{sectionItems.length !== 1 ? "s" : ""})
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => void handleRemoveAllFromDate(dateKey)}
                                                    className="text-sm text-gray-500 hover:text-red-500 transition-colors flex items-center gap-1"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    <span>Remove all</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Items */}
                                        <ul className="divide-y divide-gray-50">
                                            {sectionItems.map((item) => {
                                                const hasKrogerProduct = !!item.krogerProductId;
                                                const hasProductImage = hasKrogerProduct && item.productImageUrl;
                                                return (
                                                    <li
                                                        key={item.id}
                                                        className="px-5 py-4 flex items-center justify-between gap-4"
                                                    >
                                                        <div className="flex items-start gap-3 min-w-0 flex-1">
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
                                                            <div className="min-w-0 flex-1">
                                                                <div className="font-medium text-gray-900 truncate">
                                                                    {item.name}
                                                                </div>
                                                                <div className="text-sm text-gray-500">
                                                                    {item.quantity}
                                                                </div>
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
                                                                        {item.productSize && (
                                                                            <span className="text-xs text-gray-400">
                                                                                {item.productSize}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <button
                                                            onClick={() => handleRemoveItem(item.id)}
                                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
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
                                <p className="text-sm text-gray-500 mt-0.5">{krogerMessage}</p>
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
                                                    {item.originalName} ({item.quantity})
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
                        <div className="px-6 py-4 border-t border-gray-100 bg-white shrink-0">
                            <button
                                onClick={() => setShowKrogerResults(false)}
                                className="w-full py-3 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white rounded-xl font-medium"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
