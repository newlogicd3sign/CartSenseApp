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

type ShoppingItem = {
    id: string;
    name: string;
    quantity: string;
    mealId?: string;
    mealName?: string;
    checked: boolean;
    createdAt?: unknown;
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

    // Kroger integration state
    const [krogerLinkStatus, setKrogerLinkStatus] = useState<KrogerLinkStatus>("loading");
    const [addingToKroger, setAddingToKroger] = useState(false);
    const [krogerMessage, setKrogerMessage] = useState<string | null>(null);
    const [krogerMessageType, setKrogerMessageType] = useState<"success" | "error">("success");
    const [krogerResults, setKrogerResults] = useState<EnrichedItem[] | null>(null);
    const [showKrogerResults, setShowKrogerResults] = useState(false);

    // 1️⃣ Auth
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

    // Check Kroger link status
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

    // 2️⃣ Subscribe to shopping list items
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
            },
        );

        return () => unsub();
    }, [user]);

    // Handle adding all items to Kroger cart
    const handleAddToKrogerCart = async () => {
        if (!user || items.length === 0) return;

        setAddingToKroger(true);
        setKrogerMessage(null);
        setKrogerResults(null);

        try {
            // Send items by name - the API will search for matching Kroger products
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

            // Show results if we have enriched items
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

    // Helper to get Date from Firestore Timestamp
    const toDate = (ts: unknown): Date => {
        if (ts && typeof ts === "object" && "toDate" in ts && typeof (ts as { toDate: () => Date }).toDate === "function") {
            return (ts as { toDate: () => Date }).toDate();
        }
        return new Date();
    };

    // 3️⃣ Group items by date label
    const grouped: Record<string, ShoppingItem[]> = items.reduce(
        (acc, item) => {
            const ts = toDate(item.createdAt);
            const dateKey = ts.toDateString(); // ex: "Tue Nov 25 2025"
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(item);
            return acc;
        },
        {} as Record<string, ShoppingItem[]>,
    );

    const sortedDates = Object.keys(grouped).sort(
        (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    );

    const formatTime = (ts: unknown) => {
        const d = toDate(ts);
        return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    };

    const formatDate = (ts: unknown) => {
        const d = toDate(ts);
        return d.toLocaleDateString([], {
            month: "long",
            day: "numeric",
        });
    };

    if (loadingUser || loadingItems) {
        return (
            <div style={{ padding: "2rem" }}>
                <p>Loading your shopping list…</p>
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
        <div style={{ padding: "2rem", maxWidth: 900 }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "1rem",
                }}
            >
                <div>
                    <h1>Shopping List</h1>
                    <p style={{ marginTop: "0.5rem", color: "#4b5563", fontSize: "0.95rem" }}>
                        Items you've added from your CartSense meals.
                    </p>
                </div>

                {items.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
                        {krogerLinkStatus === "linked" ? (
                            <button
                                onClick={() => void handleAddToKrogerCart()}
                                disabled={addingToKroger}
                                style={{
                                    padding: "0.5rem 1rem",
                                    borderRadius: "999px",
                                    border: "1px solid #0056a3",
                                    fontSize: "0.9rem",
                                    background: "#0056a3",
                                    color: "#ffffff",
                                    cursor: addingToKroger ? "default" : "pointer",
                                    opacity: addingToKroger ? 0.7 : 1,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                }}
                            >
                                {addingToKroger ? "Adding..." : "Add All to Kroger Cart"}
                            </button>
                        ) : krogerLinkStatus === "not_linked" ? (
                            <button
                                onClick={() => router.push("/account")}
                                style={{
                                    padding: "0.5rem 1rem",
                                    borderRadius: "999px",
                                    border: "1px solid #d1d5db",
                                    fontSize: "0.9rem",
                                    background: "#ffffff",
                                    color: "#374151",
                                    cursor: "pointer",
                                }}
                            >
                                Link Kroger to Add to Cart
                            </button>
                        ) : null}

                        {krogerMessage && (
                            <p
                                style={{
                                    fontSize: "0.85rem",
                                    color: krogerMessageType === "success" ? "#059669" : "#b91c1c",
                                    textAlign: "right",
                                    maxWidth: 280,
                                }}
                            >
                                {krogerMessage}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {items.length === 0 ? (
                <div style={{ marginTop: "1.5rem" }}>
                    <p>Your shopping list is empty.</p>
                    <button
                        onClick={() => router.push("/prompt")}
                        style={{
                            marginTop: "1rem",
                            padding: "0.5rem 1rem",
                            borderRadius: "999px",
                            border: "1px solid #d1d5db",
                            fontSize: "0.85rem",
                            background: "#f9fafb",
                        }}
                    >
                        Search for meals
                    </button>
                </div>
            ) : (
                sortedDates.map((dateKey) => {
                    const sectionItems = grouped[dateKey];
                    const firstTS = sectionItems[0]?.createdAt;

                    return (
                        <div
                            key={dateKey}
                            style={{
                                marginTop: "2rem",
                                border: "1px solid #e5e7eb",
                                borderRadius: "12px",
                                overflow: "hidden",
                            }}
                        >
                            {/* Date header */}
                            <div
                                style={{
                                    padding: "0.75rem 1rem",
                                    background: "#f9fafb",
                                    borderBottom: "1px solid #e5e7eb",
                                }}
                            >
                                <strong style={{ fontSize: "1rem" }}>
                                    {formatDate(firstTS)} ({sectionItems.length} items)
                                </strong>
                                <div
                                    style={{
                                        fontSize: "0.85rem",
                                        color: "#4b5563",
                                        marginTop: "0.2rem",
                                    }}
                                >
                                    {formatTime(firstTS)}
                                </div>
                            </div>

                            {/* Items in this date group */}
                            <ul
                                style={{
                                    listStyle: "none",
                                    margin: 0,
                                    padding: 0,
                                }}
                            >
                                {sectionItems.map((item) => (
                                    <li
                                        key={item.id}
                                        style={{
                                            padding: "0.75rem 1rem",
                                            borderBottom: "1px solid #f3f4f6",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            gap: "0.75rem",
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 500 }}>{item.name}</div>
                                            <div
                                                style={{
                                                    fontSize: "0.85rem",
                                                    color: "#4b5563",
                                                }}
                                            >
                                                {item.quantity}
                                                {item.mealName
                                                    ? ` • from "${item.mealName}"`
                                                    : ""}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleRemoveItem(item.id)}
                                            style={{
                                                padding: "0.25rem 0.6rem",
                                                borderRadius: "999px",
                                                border: "1px solid #ef4444",
                                                background: "#fef2f2",
                                                color: "#b91c1c",
                                                fontSize: "0.8rem",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            Remove
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })
            )}

            {/* Kroger Results Modal */}
            {showKrogerResults && krogerResults && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0, 0, 0, 0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                        padding: "1rem",
                    }}
                    onClick={() => setShowKrogerResults(false)}
                >
                    <div
                        style={{
                            background: "#ffffff",
                            borderRadius: "12px",
                            maxWidth: 600,
                            width: "100%",
                            maxHeight: "80vh",
                            overflow: "auto",
                            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            style={{
                                padding: "1.25rem",
                                borderBottom: "1px solid #e5e7eb",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>
                                Kroger Cart Results
                            </h2>
                            <button
                                onClick={() => setShowKrogerResults(false)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    fontSize: "1.5rem",
                                    cursor: "pointer",
                                    color: "#6b7280",
                                    lineHeight: 1,
                                }}
                            >
                                &times;
                            </button>
                        </div>

                        <div style={{ padding: "1rem" }}>
                            <p
                                style={{
                                    marginBottom: "1rem",
                                    fontSize: "0.9rem",
                                    color: krogerMessageType === "success" ? "#059669" : "#6b7280",
                                }}
                            >
                                {krogerMessage}
                            </p>

                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.75rem",
                                }}
                            >
                                {krogerResults.map((item, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            padding: "0.75rem",
                                            border: "1px solid #e5e7eb",
                                            borderRadius: "8px",
                                            display: "flex",
                                            gap: "0.75rem",
                                            alignItems: "flex-start",
                                            background: item.found ? "#f0fdf4" : "#fef2f2",
                                        }}
                                    >
                                        {item.product?.imageUrl && (
                                            <img
                                                src={item.product.imageUrl}
                                                alt={item.product.name}
                                                style={{
                                                    width: 60,
                                                    height: 60,
                                                    objectFit: "contain",
                                                    borderRadius: "4px",
                                                    background: "#ffffff",
                                                }}
                                            />
                                        )}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{
                                                    fontSize: "0.85rem",
                                                    color: "#6b7280",
                                                    marginBottom: "0.25rem",
                                                }}
                                            >
                                                {item.originalName} ({item.quantity})
                                            </div>
                                            {item.found && item.product ? (
                                                <>
                                                    <div
                                                        style={{
                                                            fontWeight: 500,
                                                            fontSize: "0.9rem",
                                                            color: "#166534",
                                                        }}
                                                    >
                                                        {item.product.name}
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: "0.8rem",
                                                            color: "#4b5563",
                                                            marginTop: "0.25rem",
                                                        }}
                                                    >
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
                                                <div
                                                    style={{
                                                        fontSize: "0.85rem",
                                                        color: "#b91c1c",
                                                    }}
                                                >
                                                    No matching product found
                                                </div>
                                            )}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: "0.75rem",
                                                padding: "0.15rem 0.5rem",
                                                borderRadius: "999px",
                                                background: item.found ? "#dcfce7" : "#fee2e2",
                                                color: item.found ? "#166534" : "#991b1b",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {item.found ? "Added" : "Not found"}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div
                            style={{
                                padding: "1rem 1.25rem",
                                borderTop: "1px solid #e5e7eb",
                                display: "flex",
                                justifyContent: "flex-end",
                            }}
                        >
                            <button
                                onClick={() => setShowKrogerResults(false)}
                                style={{
                                    padding: "0.5rem 1rem",
                                    borderRadius: "999px",
                                    border: "1px solid #111827",
                                    fontSize: "0.9rem",
                                    background: "#111827",
                                    color: "#ffffff",
                                    cursor: "pointer",
                                }}
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
