// app/(app)/api/kroger/cart/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { searchKrogerProduct, searchAlternativeProduct, getKrogerApiStatus, type KrogerProductMatch } from "@/lib/kroger";
import { isExcludedIngredient } from "@/lib/utils";
import { KROGER_RATE_LIMITS } from "@/lib/krogerConfig";

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
    count?: number;
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
    await adminDb.collection("users").doc(userId).update({
        "krogerTokens.accessToken": access_token,
        "krogerTokens.refreshToken": refresh_token || refreshToken,
        "krogerTokens.expiresAt": expiresAt,
        "krogerTokens.updatedAt": Date.now(),
    });

    return access_token;
}

async function getValidAccessToken(userId: string): Promise<string | null> {
    const userDocSnap = await adminDb.collection("users").doc(userId).get();
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
    const userDocSnap = await adminDb.collection("users").doc(userId).get();
    const userData = userDocSnap.data();
    return userData?.defaultKrogerLocationId || null;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, items, enrichOnly } = body as { userId: string; items: ShoppingItem[]; enrichOnly?: boolean };

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

        if (!locationId) {
            return NextResponse.json(
                {
                    error: "NO_STORE",
                    message: "Please select a Kroger store first in your account settings.",
                },
                { status: 400 }
            );
        }

        // Filter out excluded ingredients like water before processing
        const filteredItems = items.filter((item) => !isExcludedIngredient(item.name));

        // Check API status before starting (cart operations are critical)
        const apiStatus = getKrogerApiStatus();
        if (apiStatus.circuitBreaker.isOpen) {
            console.warn(`[CART] Circuit breaker open, cannot process cart`);
            return NextResponse.json({
                success: false,
                error: "API_UNAVAILABLE",
                message: "Kroger API temporarily unavailable. Please try again in a few minutes.",
                retryAfterMs: apiStatus.circuitBreaker.cooldownRemainingMs,
            }, { status: 503 });
        }

        console.log(`[CART] Processing ${filteredItems.length} items for user ${userId}`);

        // Search for each item and enrich with Kroger product data
        // Process in chunks to avoid overwhelming the API
        const CHUNK_SIZE = KROGER_RATE_LIMITS.MAX_CONCURRENT_REQUESTS;
        const enrichedItems: (EnrichedItem & { itemId: string; count: number; usedAlternative?: boolean })[] = [];

        for (let chunkStart = 0; chunkStart < filteredItems.length; chunkStart += CHUNK_SIZE) {
            const chunk = filteredItems.slice(chunkStart, chunkStart + CHUNK_SIZE);

            console.log(`[CART] Processing chunk ${Math.floor(chunkStart / CHUNK_SIZE) + 1}/${Math.ceil(filteredItems.length / CHUNK_SIZE)}`);

            const chunkResults = await Promise.all(
                chunk.map(async (item) => {
                    try {
                        let product = await searchKrogerProduct(item.name, {
                            locationId: locationId || undefined,
                        });

                        let usedAlternative = false;

                        // If product found but not available, try to find an alternative
                        if (product && !product.available) {
                            console.log(`⚠️ Product "${product.name}" is unavailable, searching for alternative...`);
                            const alternative = await searchAlternativeProduct(item.name, {
                                locationId: locationId || undefined,
                                excludeProductId: product.krogerProductId,
                            });

                            if (alternative && alternative.available) {
                                console.log(`✅ Found alternative: "${alternative.name}"`);
                                product = alternative;
                                usedAlternative = true;
                            } else {
                                console.log(`❌ No available alternative found for "${item.name}"`);
                            }
                        }

                        return {
                            itemId: item.id,
                            originalName: item.name,
                            quantity: item.quantity,
                            count: item.count || 1,
                            found: !!product && product.available,
                            product: product || undefined,
                            usedAlternative,
                        };
                    } catch (err) {
                        console.error(`[CART] Error searching for "${item.name}":`, err);
                        return {
                            itemId: item.id,
                            originalName: item.name,
                            quantity: item.quantity,
                            count: item.count || 1,
                            found: false,
                            product: undefined,
                            usedAlternative: false,
                        };
                    }
                })
            );

            enrichedItems.push(...chunkResults);

            // Small delay between chunks to be gentle on the API
            if (chunkStart + CHUNK_SIZE < filteredItems.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // Filter items that were found and available
        const foundItems = enrichedItems.filter((item) => item.found && item.product);
        const notFoundItems = enrichedItems.filter((item) => !item.found);
        const unavailableItems = enrichedItems.filter((item) => item.product && !item.product.available);

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

        // If enrichOnly mode, skip adding to cart and just return enriched data
        if (enrichOnly) {
            // Update shopping list items in Firestore with Kroger product details
            const updatePromises = foundItems.map((item) => {
                if (!item.product) return Promise.resolve();

                const itemRef = adminDb
                    .collection("shoppingLists")
                    .doc(userId)
                    .collection("items")
                    .doc(item.itemId);

                return itemRef.update({
                    krogerProductId: item.product.krogerProductId,
                    productName: item.product.name,
                    productImageUrl: item.product.imageUrl || null,
                    productSize: item.product.size || null,
                    productAisle: item.product.aisle || null,
                    price: item.product.price || null,
                    soldBy: item.product.soldBy || null,
                    stockLevel: item.product.stockLevel || null,
                });
            });

            try {
                await Promise.all(updatePromises);
            } catch (updateErr) {
                console.error("Error updating shopping list items with Kroger data:", updateErr);
            }

            return NextResponse.json({
                success: true,
                message: `Enriched ${foundItems.length} items with Kroger product data.`,
                enrichedItems,
                addedCount: 0,
                notFoundCount: notFoundItems.length,
            });
        }

        // Add found items to Kroger cart
        // Kroger's productId is the UPC
        const cartItems = foundItems.map((item) => ({
            upc: item.product!.krogerProductId,
            quantity: item.count,
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
                await adminDb.collection("users").doc(userId).update({
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

        // Update shopping list items in Firestore with Kroger product details
        const updatePromises = foundItems.map((item) => {
            if (!item.product) return Promise.resolve();

            const itemRef = adminDb
                .collection("shoppingLists")
                .doc(userId)
                .collection("items")
                .doc(item.itemId);

            return itemRef.update({
                krogerProductId: item.product.krogerProductId,
                productName: item.product.name,
                productImageUrl: item.product.imageUrl || null,
                productSize: item.product.size || null,
                productAisle: item.product.aisle || null,
                price: item.product.price || null,
            });
        });

        try {
            await Promise.all(updatePromises);
        } catch (updateErr) {
            console.error("Error updating shopping list items with Kroger data:", updateErr);
            // Don't fail the request - items were added to cart successfully
        }

        const alternativesUsed = foundItems.filter((item) => item.usedAlternative).length;

        let message = `Added ${foundItems.length} item(s) to your Kroger cart.`;
        if (alternativesUsed > 0) {
            message += ` ${alternativesUsed} item(s) were substituted with available alternatives.`;
        }
        if (unavailableItems.length > 0) {
            message += ` ${unavailableItems.length} item(s) were unavailable with no alternatives.`;
        }
        if (notFoundItems.length > 0) {
            message += ` ${notFoundItems.length} item(s) could not be found.`;
        }

        return NextResponse.json({
            success: true,
            message,
            enrichedItems,
            addedCount: foundItems.length,
            notFoundCount: notFoundItems.length,
            unavailableCount: unavailableItems.length,
            alternativesUsedCount: alternativesUsed,
        });
    } catch (err) {
        console.error("Error adding to Kroger cart:", err);
        return NextResponse.json(
            { error: "SERVER_ERROR", message: "An unexpected error occurred." },
            { status: 500 }
        );
    }
}