// functions/src/warmKrogerCache.ts
// Scheduled cache warming for popular Kroger products
import { onSchedule, ScheduledEvent } from "firebase-functions/v2/scheduler";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const db = admin.firestore();

// Popular ingredients to pre-cache (matches lib/krogerConfig.ts)
const POPULAR_INGREDIENTS = [
    // Proteins
    "chicken breast",
    "ground beef",
    "chicken thighs",
    "bacon",
    "eggs",
    "salmon",
    "shrimp",
    "pork chops",
    "ground turkey",
    "sausage",

    // Dairy
    "milk",
    "butter",
    "cheddar cheese",
    "cream cheese",
    "sour cream",
    "heavy cream",
    "parmesan cheese",
    "mozzarella cheese",
    "greek yogurt",

    // Produce
    "onion",
    "garlic",
    "tomatoes",
    "potatoes",
    "carrots",
    "celery",
    "bell pepper",
    "broccoli",
    "spinach",
    "lettuce",
    "mushrooms",
    "lemon",
    "lime",

    // Fruits
    "bananas",
    "apples",
    "strawberries",
    "blueberries",

    // Pantry
    "olive oil",
    "vegetable oil",
    "all purpose flour",
    "sugar",
    "brown sugar",
    "rice",
    "pasta",
    "bread",
    "chicken broth",
    "beef broth",
];

// Kroger API configuration
const TOKEN_URL = process.env.KROGER_TOKEN_URL || "https://api-ce.kroger.com/v1/connect/oauth2/token";
const API_BASE_URL = process.env.KROGER_API_BASE_URL || "https://api-ce.kroger.com/v1";
const CLIENT_ID = process.env.KROGER_CLIENT_ID;
const CLIENT_SECRET = process.env.KROGER_CLIENT_SECRET;
const SCOPE = "product.compact";

// Delay between API requests (2 seconds to respect rate limits)
const DELAY_BETWEEN_REQUESTS_MS = 2000;

// Maximum locations to warm per run (to avoid timeout)
const MAX_LOCATIONS_PER_RUN = 5;

// Maximum items to warm per location
const MAX_ITEMS_PER_LOCATION = 50;

interface CachedKrogerProduct {
    productId: string;
    upc: string;
    brand: string | null;
    description: string;
    category: string | null;
    department: string | null;
    size: string | null;
    imageUrl: string | null;
    regularPrice: number | null;
    promoPrice: number | null;
    unitPrice: number | null;
    unitOfMeasure: string | null;
    currency: string | null;
    aisle: string | null;
    isInStock: boolean | null;
    stockLevel: string | null;
    fulfillment: {
        inStore: boolean | null;
        curbside: boolean | null;
        delivery: boolean | null;
        shipToHome: boolean | null;
    } | null;
    soldBy: string | null;
}

/**
 * Select the best (largest) image URL from Kroger image sizes array.
 * Kroger provides: thumbnail, small, medium, large, xlarge (not always in order)
 */
function selectBestImageUrl(images?: { sizes: { url: string; size?: string }[] }[]): string | null {
    const sizes = images?.[0]?.sizes;
    if (!sizes || sizes.length === 0) return null;

    // Priority order: largest to smallest
    const sizePreference = ["xlarge", "large", "medium", "small", "thumbnail"];

    for (const preferredSize of sizePreference) {
        const match = sizes.find(s => s.size?.toLowerCase() === preferredSize);
        if (match?.url) return match.url;
    }

    // Fallback: return first available URL
    return sizes[0]?.url ?? null;
}

/**
 * Get a client credentials token for the Kroger API
 */
async function getKrogerToken(): Promise<string | null> {
    if (!CLIENT_ID || !CLIENT_SECRET) {
        console.error("Missing Kroger credentials");
        return null;
    }

    const body = new URLSearchParams();
    body.append("grant_type", "client_credentials");
    body.append("scope", SCOPE);

    try {
        const res = await fetch(TOKEN_URL, {
            method: "POST",
            headers: {
                Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body,
        });

        if (!res.ok) {
            console.error("Failed to get Kroger token:", res.status);
            return null;
        }

        const json = await res.json() as { access_token: string };
        return json.access_token;
    } catch (error) {
        console.error("Error getting Kroger token:", error);
        return null;
    }
}

/**
 * Search for products and cache the results
 */
async function searchAndCache(
    token: string,
    locationId: string,
    searchTerm: string
): Promise<boolean> {
    const params = new URLSearchParams();
    params.append("filter.term", searchTerm);
    params.append("filter.limit", "8");
    params.append("filter.locationId", locationId);
    params.append("filter.fulfillment", "ais");

    try {
        const res = await fetch(`${API_BASE_URL}/products?${params.toString()}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
        });

        if (!res.ok) {
            console.warn(`Search failed for "${searchTerm}" at ${locationId}: ${res.status}`);
            return false;
        }

        const json = await res.json() as { data?: Array<{
            productId: string;
            upc?: string;
            brand?: string;
            description: string;
            categories?: string[];
            images?: { sizes: { url: string; size?: string }[] }[];
            items?: {
                size?: string;
                price?: { regular?: number; promo?: number } | number;
                soldBy?: string;
                aisleLocations?: { description?: string }[];
                fulfillment?: {
                    curbside?: boolean;
                    delivery?: boolean;
                    inStore?: boolean;
                    shipToHome?: boolean;
                };
                inventory?: { stockLevel?: string };
            }[];
        }> };

        const products = json.data ?? [];
        if (products.length === 0) {
            console.log(`No products found for "${searchTerm}" at ${locationId}`);
            return false;
        }

        // Transform to cached format
        const cachedProducts: CachedKrogerProduct[] = products.map((product) => {
            const item = product.items?.[0];
            let regularPrice: number | null = null;
            let promoPrice: number | null = null;

            if (item?.price) {
                if (typeof item.price === "number") {
                    regularPrice = item.price;
                } else if (typeof item.price === "object") {
                    regularPrice = item.price.regular ?? null;
                    promoPrice = item.price.promo ?? null;
                }
            }

            const imageUrl = selectBestImageUrl(product.images);

            const stockLevel = item?.inventory?.stockLevel ?? null;
            const isInStock = stockLevel !== "TEMPORARILY_OUT_OF_STOCK";

            return {
                productId: product.productId,
                upc: product.upc ?? "",
                brand: product.brand ?? null,
                description: product.description,
                category: product.categories?.[0] ?? null,
                department: product.categories?.[1] ?? null,
                size: item?.size ?? null,
                imageUrl,
                regularPrice,
                promoPrice,
                unitPrice: null,
                unitOfMeasure: null,
                currency: "USD",
                aisle: item?.aisleLocations?.[0]?.description ?? null,
                isInStock,
                stockLevel,
                fulfillment: item?.fulfillment ? {
                    inStore: item.fulfillment.inStore ?? null,
                    curbside: item.fulfillment.curbside ?? null,
                    delivery: item.fulfillment.delivery ?? null,
                    shipToHome: item.fulfillment.shipToHome ?? null,
                } : null,
                soldBy: item?.soldBy ?? null,
            };
        });

        // Determine TTL based on product category
        const category = cachedProducts[0]?.category?.toLowerCase() ?? "";
        let ttlHours = 24; // default
        if (category.includes("meat") || category.includes("seafood")) {
            ttlHours = 24;
        } else if (category.includes("produce")) {
            ttlHours = 48;
        } else if (category.includes("dairy")) {
            ttlHours = 72;
        } else if (category.includes("frozen")) {
            ttlHours = 168;
        } else if (category.includes("pantry") || category.includes("grocery")) {
            ttlHours = 336;
        }

        const now = admin.firestore.Timestamp.now();
        const expiresAt = admin.firestore.Timestamp.fromMillis(
            now.toMillis() + ttlHours * 60 * 60 * 1000
        );

        // Build cache document ID
        const normalizedTerm = searchTerm.toLowerCase().trim().replace(/\s+/g, "-");
        const docId = `${locationId}_${normalizedTerm}`;

        // Write to cache
        await db.collection("krogerProductSearchCache").doc(docId).set({
            locationId,
            term: searchTerm,
            normalizedTerm,
            sourceEndpoint: "products.search",
            products: cachedProducts,
            total: cachedProducts.length,
            createdAt: now,
            updatedAt: now,
            expiresAt,
            hitCount: 0,
            lastAccessedAt: now,
            warmedAt: now,
        }, { merge: true });

        console.log(`Cached ${cachedProducts.length} products for "${searchTerm}" at ${locationId}`);
        return true;
    } catch (error) {
        console.error(`Error caching "${searchTerm}" at ${locationId}:`, error);
        return false;
    }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get active location IDs from users collection, prioritizing those
 * that haven't been warmed recently.
 */
async function getActiveLocationIds(): Promise<string[]> {
    const usersSnap = await db
        .collection("users")
        .where("krogerLinked", "==", true)
        .where("defaultKrogerLocationId", "!=", null)
        .limit(100)
        .get();

    const locationIds = new Set<string>();
    usersSnap.docs.forEach((doc) => {
        const locationId = doc.data().defaultKrogerLocationId;
        if (locationId) {
            locationIds.add(locationId);
        }
    });

    return Array.from(locationIds);
}

/**
 * Get locations that need warming, sorted by priority (least recently warmed first).
 * Skips locations warmed within the last 6 hours (by on-demand or scheduled).
 */
async function getLocationsNeedingWarm(locationIds: string[]): Promise<string[]> {
    if (locationIds.length === 0) return [];

    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
    const locationsWithStats: { id: string; lastWarmed: number }[] = [];

    // Fetch warming stats for all locations
    for (const locationId of locationIds) {
        const statsDoc = await db.collection("krogerCacheWarmingStats").doc(locationId).get();
        const lastWarmed = statsDoc.exists ? (statsDoc.data()?.lastWarmedAt?.toMillis() ?? 0) : 0;

        // Only include if not warmed in last 6 hours
        if (lastWarmed < sixHoursAgo) {
            locationsWithStats.push({ id: locationId, lastWarmed });
        }
    }

    // Sort by last warmed (oldest first = highest priority)
    locationsWithStats.sort((a, b) => a.lastWarmed - b.lastWarmed);

    return locationsWithStats.map((l) => l.id);
}

/**
 * Scheduled function to warm Kroger product cache.
 * Runs every 12 hours to pre-cache popular products.
 */
export const warmKrogerCache = onSchedule(
    { schedule: "every 12 hours", timeZone: "America/New_York", timeoutSeconds: 540 },
    async (_event: ScheduledEvent) => {
        const startTime = Date.now();
        console.log(`Starting Kroger cache warming at ${new Date().toISOString()}`);

        const token = await getKrogerToken();
        if (!token) {
            console.error("Failed to get Kroger token, aborting cache warm");
            return;
        }

        // Get active location IDs
        const locationIds = await getActiveLocationIds();
        console.log(`Found ${locationIds.length} active locations`);

        if (locationIds.length === 0) {
            console.log("No active locations to warm");
            return;
        }

        // Get locations that need warming (skips recently warmed by on-demand)
        const locationsNeedingWarm = await getLocationsNeedingWarm(locationIds);
        console.log(`${locationsNeedingWarm.length} locations need warming`);

        if (locationsNeedingWarm.length === 0) {
            console.log("All locations recently warmed, skipping scheduled warming");
            return;
        }

        // Limit locations per run to avoid timeout
        const locationsToWarm = locationsNeedingWarm.slice(0, MAX_LOCATIONS_PER_RUN);
        let totalCached = 0;
        let totalErrors = 0;

        for (const locationId of locationsToWarm) {
            console.log(`Warming cache for location ${locationId}`);
            let locationCached = 0;

            const ingredientsToWarm = POPULAR_INGREDIENTS.slice(0, MAX_ITEMS_PER_LOCATION);

            for (const ingredient of ingredientsToWarm) {
                const success = await searchAndCache(token, locationId, ingredient);
                if (success) {
                    totalCached++;
                    locationCached++;
                } else {
                    totalErrors++;
                }

                // Delay to respect rate limits
                await sleep(DELAY_BETWEEN_REQUESTS_MS);
            }

            console.log(`Location ${locationId}: cached ${locationCached} products`);

            // Record warming stats
            await db.collection("krogerCacheWarmingStats").doc(locationId).set({
                locationId,
                lastWarmedAt: admin.firestore.Timestamp.now(),
                itemsWarmed: locationCached,
                errors: totalErrors,
                warmType: "scheduled",
            }, { merge: true });
        }

        const duration = (Date.now() - startTime) / 1000;
        console.log(`Cache warming complete: ${totalCached} products cached, ${totalErrors} errors, ${duration.toFixed(1)}s`);
    }
);

/**
 * HTTP-callable function to manually trigger cache warming for a specific location.
 * Useful for testing or warming a new location.
 */
export const manualCacheWarm = onRequest(
    { timeoutSeconds: 540 },
    async (req, res) => {
        // Simple auth check
        const authHeader = req.headers["x-cleanup-secret"];
        const expectedSecret = process.env.CLEANUP_SECRET || "your-secret-here";

        if (authHeader !== expectedSecret) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const locationId = req.query.locationId as string;
        if (!locationId) {
            res.status(400).json({ error: "locationId query parameter required" });
            return;
        }

        const token = await getKrogerToken();
        if (!token) {
            res.status(500).json({ error: "Failed to get Kroger token" });
            return;
        }

        console.log(`Manual cache warm for location ${locationId}`);

        let totalCached = 0;
        let totalErrors = 0;
        const ingredientsToWarm = POPULAR_INGREDIENTS.slice(0, MAX_ITEMS_PER_LOCATION);

        for (const ingredient of ingredientsToWarm) {
            const success = await searchAndCache(token, locationId, ingredient);
            if (success) {
                totalCached++;
            } else {
                totalErrors++;
            }

            // Delay to respect rate limits
            await sleep(DELAY_BETWEEN_REQUESTS_MS);
        }

        // Record warming stats
        await db.collection("krogerCacheWarmingStats").doc(locationId).set({
            locationId,
            lastWarmedAt: admin.firestore.Timestamp.now(),
            itemsWarmed: totalCached,
            errors: totalErrors,
        }, { merge: true });

        res.json({
            success: true,
            locationId,
            cached: totalCached,
            errors: totalErrors,
            ingredients: ingredientsToWarm.length,
        });
    }
);

// Essential ingredients to warm immediately (subset for faster response)
const ESSENTIAL_INGREDIENTS = [
    "chicken breast",
    "ground beef",
    "eggs",
    "milk",
    "butter",
    "onion",
    "garlic",
    "olive oil",
    "cheese",
    "bread",
];

// Minimum hours between warming same location
const MIN_HOURS_BETWEEN_WARMS = 6;

/**
 * On-demand cache warming triggered when user selects a new location.
 * Warms essential ingredients immediately, then continues with full list.
 * Called from client when user adds or switches Kroger store.
 */
export const warmLocationOnDemand = onCall(
    { timeoutSeconds: 540 },
    async (request) => {
        // Require authenticated user
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Must be logged in to warm cache");
        }

        const { locationId } = request.data as { locationId?: string };

        if (!locationId || typeof locationId !== "string") {
            throw new HttpsError("invalid-argument", "locationId is required");
        }

        // Check if recently warmed to avoid duplicate work
        const statsDoc = await db.collection("krogerCacheWarmingStats").doc(locationId).get();
        if (statsDoc.exists) {
            const lastWarmed = statsDoc.data()?.lastWarmedAt?.toMillis() ?? 0;
            const hoursSinceWarm = (Date.now() - lastWarmed) / (1000 * 60 * 60);

            if (hoursSinceWarm < MIN_HOURS_BETWEEN_WARMS) {
                console.log(`Location ${locationId} was warmed ${hoursSinceWarm.toFixed(1)}h ago, skipping`);
                return {
                    success: true,
                    skipped: true,
                    reason: `Recently warmed ${hoursSinceWarm.toFixed(1)} hours ago`,
                    locationId,
                };
            }
        }

        const token = await getKrogerToken();
        if (!token) {
            throw new HttpsError("internal", "Failed to get Kroger API token");
        }

        console.log(`On-demand warming for location ${locationId} by user ${request.auth.uid}`);

        let totalCached = 0;
        let totalErrors = 0;

        // Phase 1: Warm essential ingredients with shorter delay (faster UX)
        console.log(`Phase 1: Warming ${ESSENTIAL_INGREDIENTS.length} essential ingredients`);
        for (const ingredient of ESSENTIAL_INGREDIENTS) {
            const success = await searchAndCache(token, locationId, ingredient);
            if (success) {
                totalCached++;
            } else {
                totalErrors++;
            }
            await sleep(1500); // Slightly faster for essentials
        }

        // Phase 2: Warm remaining ingredients
        const remainingIngredients = POPULAR_INGREDIENTS.filter(
            (ing) => !ESSENTIAL_INGREDIENTS.includes(ing)
        );

        console.log(`Phase 2: Warming ${remainingIngredients.length} additional ingredients`);
        for (const ingredient of remainingIngredients) {
            const success = await searchAndCache(token, locationId, ingredient);
            if (success) {
                totalCached++;
            } else {
                totalErrors++;
            }
            await sleep(DELAY_BETWEEN_REQUESTS_MS);
        }

        // Record warming stats
        await db.collection("krogerCacheWarmingStats").doc(locationId).set({
            locationId,
            lastWarmedAt: admin.firestore.Timestamp.now(),
            itemsWarmed: totalCached,
            errors: totalErrors,
            warmedBy: request.auth.uid,
            warmType: "on-demand",
        }, { merge: true });

        console.log(`On-demand warming complete: ${totalCached} cached, ${totalErrors} errors`);

        return {
            success: true,
            skipped: false,
            locationId,
            cached: totalCached,
            errors: totalErrors,
        };
    }
);
