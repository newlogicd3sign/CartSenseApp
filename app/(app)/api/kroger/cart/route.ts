// app/(app)/api/kroger/cart/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { searchKrogerProduct, type KrogerProductMatch } from "@/lib/kroger";

const TOKEN_URL = process.env.KROGER_TOKEN_URL ?? "https://api-ce.kroger.com/v1/connect/oauth2/token";
const API_BASE_URL = process.env.KROGER_API_BASE_URL ?? "https://api-ce.kroger.com/v1";
const CLIENT_ID = process.env.KROGER_CLIENT_ID!;
const CLIENT_SECRET = process.env.KROGER_CLIENT_SECRET!;

type KrogerTokens = {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    updatedAt: number;
};

type ShoppingItem = {
    id: string;
    name: string;
    quantity: string;
};

type EnrichedItem = {
    originalName: string;
    quantity: string;
    found: boolean;
    product?: KrogerProductMatch;
};

async function refreshKrogerToken(
    userId: string,
    refreshToken: string
): Promise<string | null> {
    const body = new URLSearchParams();
    body.append("grant_type", "refresh_token");
    body.append("refresh_token", refreshToken);

    const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
            Authorization:
                "Basic " +
                Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });

    if (!res.ok) {
        console.error("Failed to refresh Kroger token:", await res.text());
        return null;
    }

    const tokens = await res.json();
    const { access_token, refresh_token, expires_in } = tokens;
    const expiresAt = Date.now() + expires_in * 1000;

    // Update tokens in Firebase
    await updateDoc(doc(adminDb, "users", userId), {
        "krogerTokens.accessToken": access_token,
        "krogerTokens.refreshToken": refresh_token || refreshToken,
        "krogerTokens.expiresAt": expiresAt,
        "krogerTokens.updatedAt": Date.now(),
    });

    return access_token;
}

async function getValidAccessToken(userId: string): Promise<string | null> {
    const userDocSnap = await getDoc(doc(adminDb, "users", userId));
    const userData = userDocSnap.data();

    if (!userData?.krogerTokens) {
        return null;
    }

    const tokens = userData.krogerTokens as KrogerTokens;

    // Check if token is expired (with 5 minute buffer)
    if (Date.now() > tokens.expiresAt - 5 * 60 * 1000) {
        return refreshKrogerToken(userId, tokens.refreshToken);
    }

    return tokens.accessToken;
}

async function getUserDefaultLocationId(userId: string): Promise<string | null> {
    const userDocSnap = await getDoc(doc(adminDb, "users", userId));
    const userData = userDocSnap.data();
    return userData?.defaultKrogerLocationId || null;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, items } = body as { userId: string; items: ShoppingItem[] };

        if (!userId) {
            return NextResponse.json(
                { error: "USER_ID_REQUIRED", message: "User ID is required." },
                { status: 400 }
            );
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                { error: "ITEMS_REQUIRED", message: "Items array is required." },
                { status: 400 }
            );
        }

        // Get valid access token
        const accessToken = await getValidAccessToken(userId);

        if (!accessToken) {
            return NextResponse.json(
                {
                    error: "NOT_LINKED",
                    message: "Kroger account is not linked. Please link your account first.",
                },
                { status: 401 }
            );
        }

        // Get user's default location for better product search results
        const locationId = await getUserDefaultLocationId(userId);

        // Search for each item and enrich with Kroger product data
        const enrichedItems: EnrichedItem[] = await Promise.all(
            items.map(async (item) => {
                const product = await searchKrogerProduct(item.name, {
                    locationId: locationId || undefined,
                });

                return {
                    originalName: item.name,
                    quantity: item.quantity,
                    found: !!product,
                    product: product || undefined,
                };
            })
        );

        // Filter items that were found
        const foundItems = enrichedItems.filter((item) => item.found && item.product);
        const notFoundItems = enrichedItems.filter((item) => !item.found);

        if (foundItems.length === 0) {
            return NextResponse.json({
                success: false,
                error: "NO_PRODUCTS_FOUND",
                message: "Could not find any matching Kroger products for your items.",
                enrichedItems,
                addedCount: 0,
                notFoundCount: notFoundItems.length,
            });
        }

        // Add found items to Kroger cart
        // Kroger's productId is the UPC
        const cartItems = foundItems.map((item) => ({
            upc: item.product!.krogerProductId,
            quantity: 1, // Default to 1, could parse from quantity string
        }));

        const cartRes = await fetch(`${API_BASE_URL}/cart/add`, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({ items: cartItems }),
        });

        if (!cartRes.ok) {
            const errorText = await cartRes.text();
            console.error("Kroger cart error:", errorText);

            // Check if token is invalid
            if (cartRes.status === 401) {
                // Mark account as unlinked
                await updateDoc(doc(adminDb, "users", userId), {
                    krogerLinked: false,
                });

                return NextResponse.json(
                    {
                        error: "TOKEN_EXPIRED",
                        message: "Your Kroger connection has expired. Please re-link your account.",
                        enrichedItems,
                    },
                    { status: 401 }
                );
            }

            return NextResponse.json(
                {
                    error: "CART_ERROR",
                    message: "Failed to add items to Kroger cart.",
                    enrichedItems,
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: `Added ${foundItems.length} item(s) to your Kroger cart.${
                notFoundItems.length > 0
                    ? ` ${notFoundItems.length} item(s) could not be found.`
                    : ""
            }`,
            enrichedItems,
            addedCount: foundItems.length,
            notFoundCount: notFoundItems.length,
        });
    } catch (err) {
        console.error("Error adding to Kroger cart:", err);
        return NextResponse.json(
            { error: "SERVER_ERROR", message: "An unexpected error occurred." },
            { status: 500 }
        );
    }
}