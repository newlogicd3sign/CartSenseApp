// lib/kroger.ts
import "server-only";
import {
    getCachedProducts,
    writeProductsCache,
    cacheNotFound,
    type CachedKrogerProduct,
} from "./krogerCache";
import {
    isPetFood as isPetFoodCheck,
    isNonFoodProduct as isNonFoodCheck,
    findIngredientRule,
    calculateQualityScore,
    calculateRelevanceScore,
    type ProductCandidate,
} from "./productSelectionService";
import { queueKrogerRequest, getKrogerQueueStats } from "./krogerQueue";
import { fetchWithRetry, getCircuitBreakerStatus } from "./krogerRetry";
import { canMakeRequest, recordRequest } from "./krogerRateLimiter";
import { QUEUE_PRIORITY, createKrogerError } from "./krogerConfig";

// ✅ Defaults for Kroger api-ce, overridable via env
const TOKEN_URL =
    process.env.KROGER_TOKEN_URL ??
    "https://api-ce.kroger.com/v1/connect/oauth2/token";

const API_BASE_URL =
    process.env.KROGER_API_BASE_URL ??
    "https://api-ce.kroger.com/v1";

const CLIENT_ID = process.env.KROGER_CLIENT_ID;
const CLIENT_SECRET = process.env.KROGER_CLIENT_SECRET;
const SCOPE = process.env.KROGER_SCOPE || "product.compact";

type KrogerOAuthToken = {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getKrogerToken(): Promise<string> {
    const now = Date.now();

    // ✅ Reuse cached token if still valid (60s safety buffer)
    if (cachedToken && now < cachedToken.expiresAt - 60_000) {
        return cachedToken.token;
    }

    if (!CLIENT_ID || !CLIENT_SECRET) {
        console.error("Missing Kroger CLIENT_ID / CLIENT_SECRET env vars.");
        throw new Error("Missing Kroger client credentials");
    }

    if (!TOKEN_URL) {
        console.error("Missing KROGER_TOKEN_URL env var.");
        throw new Error("Missing Kroger token URL");
    }

    const body = new URLSearchParams();
    body.append("grant_type", "client_credentials");
    body.append("scope", SCOPE);

    const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
            Authorization:
                "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });

    if (!res.ok) {
        console.error(
            "Kroger token error",
            res.status,
            await res.text().catch(() => ""),
        );
        throw new Error("Failed to fetch Kroger token");
    }

    const json = (await res.json()) as KrogerOAuthToken;
    cachedToken = {
        token: json.access_token,
        expiresAt: now + json.expires_in * 1000,
    };

    return json.access_token;
}

// ─────────────────────────────────────────────────────────────────────────────
// Protected Kroger API Fetch (with queue, rate limiter, and retry)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Make a protected Kroger API request with:
 * 1. Queue for concurrency control
 * 2. Rate limit check
 * 3. Retry with exponential backoff
 * 4. Circuit breaker protection
 */
async function protectedKrogerFetch(
    url: string | URL,
    options?: RequestInit,
    priority: number = QUEUE_PRIORITY.ENRICH
): Promise<Response> {
    return queueKrogerRequest(async () => {
        // Check circuit breaker first
        const circuitStatus = getCircuitBreakerStatus();
        if (circuitStatus.isOpen) {
            throw createKrogerError(
                "CIRCUIT_OPEN",
                `Circuit breaker open - ${circuitStatus.cooldownRemainingMs}ms remaining`,
                circuitStatus.cooldownRemainingMs
            );
        }

        // Check rate limit
        const rateLimitCheck = await canMakeRequest();
        if (!rateLimitCheck.allowed) {
            console.warn(
                `⚠️ Rate limit check failed: ${rateLimitCheck.currentSecond}/${rateLimitCheck.limitSecond}/sec, ${rateLimitCheck.currentHour}/${rateLimitCheck.limitHour}/hour`
            );
            throw createKrogerError(
                "RATE_LIMITED",
                `Pre-flight rate limit check failed`,
                rateLimitCheck.retryAfterMs
            );
        }

        // Make the request with retry logic
        const response = await fetchWithRetry(url, options);

        // Record successful request
        recordRequest().catch((err) =>
            console.error("Failed to record rate limit:", err)
        );

        return response;
    }, priority);
}

/**
 * Get Kroger API health status (for monitoring/debugging)
 */
export function getKrogerApiStatus() {
    return {
        queue: getKrogerQueueStats(),
        circuitBreaker: getCircuitBreakerStatus(),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Kroger API Response Types
// ─────────────────────────────────────────────────────────────────────────────

type KrogerProduct = {
    productId: string;
    upc?: string;
    brand?: string;
    description: string;
    categories?: string[];
    images?: {
        sizes: { url: string; size?: string }[];
    }[];
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
        inventory?: {
            stockLevel?: string; // "HIGH", "LOW", "TEMPORARILY_OUT_OF_STOCK", etc.
        };
    }[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Product Availability & Filtering (delegates to productSelectionService)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert KrogerProduct or CachedKrogerProduct to ProductCandidate for selection service.
 */
function toProductCandidate(product: KrogerProduct | CachedKrogerProduct): ProductCandidate {
    const item = "items" in product ? product.items?.[0] : null;
    const stockLevel = "stockLevel" in product
        ? product.stockLevel
        : item?.inventory?.stockLevel ?? null;
    const isInStock = "isInStock" in product
        ? product.isInStock
        : stockLevel !== "TEMPORARILY_OUT_OF_STOCK";

    // Extract price
    let price: number | null = null;
    if ("promoPrice" in product) {
        price = product.promoPrice ?? product.regularPrice ?? null;
    } else if (item?.price) {
        if (typeof item.price === "number") {
            price = item.price;
        } else if (typeof item.price === "object") {
            price = item.price.promo ?? item.price.regular ?? null;
        }
    }

    return {
        productId: product.productId,
        description: product.description,
        brand: "brand" in product ? product.brand ?? null : null,
        categories: "categories" in product ? product.categories : undefined,
        category: "category" in product ? product.category : null,
        department: "department" in product ? product.department : null,
        price,
        stockLevel,
        isInStock,
        size: "size" in product ? product.size : item?.size ?? null,
    };
}

/**
 * Check if a product is pet food - delegates to selection service.
 */
function isPetFood(product: KrogerProduct | CachedKrogerProduct): boolean {
    return isPetFoodCheck(toProductCandidate(product));
}

/**
 * Check if a product is a non-food item - delegates to selection service.
 */
function isNonFoodProduct(product: KrogerProduct | CachedKrogerProduct): boolean {
    return isNonFoodCheck(toProductCandidate(product));
}

/**
 * Check if a product is available in-store based on fulfillment and inventory data.
 */
function isProductAvailable(product: KrogerProduct | CachedKrogerProduct): { available: boolean; stockLevel?: string } {
    // Handle CachedKrogerProduct
    if ("isInStock" in product) {
        const cached = product as CachedKrogerProduct;
        if (cached.isInStock === false) {
            return { available: false, stockLevel: cached.stockLevel ?? undefined };
        }
        if (cached.stockLevel === "TEMPORARILY_OUT_OF_STOCK") {
            return { available: false, stockLevel: cached.stockLevel };
        }
        return { available: true, stockLevel: cached.stockLevel ?? undefined };
    }

    // Handle KrogerProduct (API response)
    const krogerProduct = product as KrogerProduct;
    const item = krogerProduct.items?.[0];
    if (!item) return { available: true }; // No item data, assume available

    const stockLevel = item.inventory?.stockLevel;
    const fulfillment = item.fulfillment;

    // Check stock level - TEMPORARILY_OUT_OF_STOCK means unavailable
    if (stockLevel === "TEMPORARILY_OUT_OF_STOCK") {
        return { available: false, stockLevel };
    }

    // If we have fulfillment data, check if in-store is available
    if (fulfillment && fulfillment.inStore === false) {
        return { available: false, stockLevel };
    }

    // HIGH or LOW stock means available
    return { available: true, stockLevel };
}

/**
 * Score how good a product is for a given ingredient search term.
 * Uses the selection service for quality-based scoring.
 * Works with both KrogerProduct (API) and CachedKrogerProduct (cache).
 */
function scoreProduct(
    product: KrogerProduct | CachedKrogerProduct,
    searchTerm: string,
): number {
    // Convert to ProductCandidate and use selection service
    const candidate = toProductCandidate(product);

    // Get ingredient rule for quality scoring
    const ingredientRule = findIngredientRule(searchTerm);

    // Use selection service's quality and relevance scoring
    const qualityResult = calculateQualityScore(candidate, ingredientRule, ingredientRule?.category);
    const relevanceResult = calculateRelevanceScore(candidate, searchTerm);

    // Combined score - quality weighted more heavily for fresh ingredient selection
    const combinedScore = (qualityResult.score * 1.5) + relevanceResult.score;

    // Additional pantry staple price adjustments (keep existing logic)
    let priceBonus = 0;
    const term = searchTerm.toLowerCase().trim();
    const pantryStaples = [
        "olive oil", "vegetable oil", "canola oil", "coconut oil", "sesame oil",
        "soy sauce", "vinegar", "honey", "maple syrup", "worcestershire",
        "mustard", "ketchup", "mayonnaise", "hot sauce", "sriracha",
        "salt", "pepper", "sugar", "flour", "baking powder", "baking soda",
    ];
    const desc = candidate.description.toLowerCase();
    const isPantryStaple = pantryStaples.some((staple) => term.includes(staple) || desc.includes(staple));

    if (isPantryStaple && typeof candidate.price === "number") {
        if (candidate.price <= 4) priceBonus = 5;
        else if (candidate.price <= 6) priceBonus = 2;
        else if (candidate.price > 10) priceBonus = -3;
    }

    return combinedScore + priceBonus;
}

function buildFallbackSearchTerm(original: string): string | null {
    const lower = original.toLowerCase().trim();

    const throwAway = new Set([
        "fresh", "ground", "canned", "grated", "finely", "chopped", "minced",
        "sliced", "diced", "boneless", "skinless", "lean", "reduced", "no-salt",
        "no", "salted", "unsalted", "organic", "low-sodium", "low",
    ]);

    const words = lower.split(/\s+/);
    if (words.length === 1) return null;

    const filtered = words.filter((w) => !throwAway.has(w));
    if (!filtered.length) return null;

    const fallback = filtered.join(" ").trim();
    if (!fallback || fallback === lower) return null;

    return fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transform Kroger API response to cache format
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Select the best (largest) image URL from Kroger image sizes array.
 * Kroger provides: thumbnail, small, medium, large, xlarge (not always in order)
 */
function selectBestImageUrl(images?: KrogerProduct["images"]): string | null {
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

function krogerProductToCached(product: KrogerProduct): CachedKrogerProduct {
    const item = product.items?.[0];

    // Extract price
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

    // Get best image URL
    const imageUrl = selectBestImageUrl(product.images);

    const { available, stockLevel } = isProductAvailable(product);

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
        isInStock: available,
        stockLevel: stockLevel ?? null,
        fulfillment: item?.fulfillment ? {
            inStore: item.fulfillment.inStore ?? null,
            curbside: item.fulfillment.curbside ?? null,
            delivery: item.fulfillment.delivery ?? null,
            shipToHome: item.fulfillment.shipToHome ?? null,
        } : null,
        soldBy: item?.soldBy ?? null,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API Types
// ─────────────────────────────────────────────────────────────────────────────

export type KrogerProductMatch = {
    krogerProductId: string;
    name: string;
    imageUrl?: string;
    price?: number;
    soldBy?: "WEIGHT" | "UNIT";
    size?: string;
    aisle?: string;
    available: boolean;
    stockLevel?: string;
};

/**
 * Convert a CachedKrogerProduct to the KrogerProductMatch format used by the app.
 */
function cachedToProductMatch(cached: CachedKrogerProduct): KrogerProductMatch {
    const soldBy = cached.soldBy?.toUpperCase() === "WEIGHT" ? "WEIGHT" as const : "UNIT" as const;
    const price = cached.promoPrice ?? cached.regularPrice ?? undefined;

    return {
        krogerProductId: cached.productId,
        name: cached.description,
        imageUrl: cached.imageUrl ?? undefined,
        price: typeof price === "number" && Number.isFinite(price) ? price : undefined,
        soldBy,
        size: cached.size ?? undefined,
        aisle: cached.aisle ?? undefined,
        available: cached.isInStock ?? true,
        stockLevel: cached.stockLevel ?? undefined,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Search Functions
// ─────────────────────────────────────────────────────────────────────────────

export async function searchKrogerProduct(
    searchTerm: string,
    opts: { locationId?: string; skipCache?: boolean } = {},
): Promise<KrogerProductMatch | null> {
    const trimmed = searchTerm.trim();
    if (!trimmed) return null;

    // Must have locationId for caching (prices vary by location)
    const locationId = opts.locationId;

    // ─────────────────────────────────────────────────────────────────────────
    // Step 1: Check Firestore cache first
    // ─────────────────────────────────────────────────────────────────────────
    if (!opts.skipCache && locationId) {
        const cached = await getCachedProducts(locationId, trimmed);

        if (cached) {
            // Empty products array means "not found" was cached
            if (cached.products.length === 0) {
                return null;
            }

            // Filter available products, excluding pet food and non-food items
            const availableProducts = cached.products.filter(p => {
                if (isPetFood(p)) return false;
                if (isNonFoodProduct(p)) return false;
                const { available } = isProductAvailable(p);
                return available;
            });

            if (availableProducts.length === 0) {
                return null;
            }

            // Score and pick best
            let best: { product: CachedKrogerProduct; score: number } | null = null;
            for (const p of availableProducts) {
                const s = scoreProduct(p, trimmed);
                if (!best || s > best.score) {
                    best = { product: p, score: s };
                }
            }

            if (best && best.score > 0) {
                return cachedToProductMatch(best.product);
            }

            // Fallback to first available
            return cachedToProductMatch(availableProducts[0]);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 2: No cache hit - call Kroger API
    // ─────────────────────────────────────────────────────────────────────────

    async function runSearch(term: string): Promise<{ products: KrogerProduct[]; match: KrogerProductMatch | null }> {
        const searchTrimmed = term.trim();
        if (!searchTrimmed) return { products: [], match: null };

        const token = await getKrogerToken();

        if (!API_BASE_URL) {
            console.error("Missing KROGER_API_BASE_URL env var.");
            throw new Error("Missing Kroger API base URL");
        }

        const params = new URLSearchParams();
        params.append("filter.term", searchTrimmed);
        params.append("filter.limit", "8");
        if (locationId) {
            params.append("filter.locationId", locationId);
            params.append("filter.fulfillment", "ais");
        }

        let res: Response;
        try {
            res = await protectedKrogerFetch(
                `${API_BASE_URL}/products?${params.toString()}`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/json",
                    },
                },
                QUEUE_PRIORITY.ENRICH
            );
        } catch (error) {
            console.error("Kroger search error (protected):", error);
            return { products: [], match: null };
        }

        if (!res.ok) {
            const text = await res.text();
            console.error("Kroger search error:", res.status, text);
            return { products: [], match: null };
        }

        const json = (await res.json()) as { data?: KrogerProduct[] };
        const products = json.data ?? [];

        console.log("\n🔎 Kroger Search (API CALL)");
        console.log("Search Term:", searchTrimmed);
        console.log("Products Returned:", products.length);

        if (!products.length) {
            console.log("❌ No products found.\n");
            return { products: [], match: null };
        }

        // Filter available products, excluding pet food and non-food items
        const availableProducts = products.filter((p) => {
            if (isPetFood(p)) return false;
            if (isNonFoodProduct(p)) return false;
            const { available } = isProductAvailable(p);
            return available;
        });

        console.log(`Products after filtering (food only): ${availableProducts.length}/${products.length}`);

        if (!availableProducts.length) {
            console.log("❌ All products are out of stock.\n");
            return { products, match: null };
        }

        // Score and pick best
        let best: { product: KrogerProduct; score: number } | null = null;
        for (const p of availableProducts) {
            const s = scoreProduct(p, searchTrimmed);
            if (!best || s > best.score) {
                best = { product: p, score: s };
            }
        }

        const chosen = best && best.score > 0 ? best.product : availableProducts[0];
        console.log("Chosen Product:", chosen.description);
        console.log("\n");

        const { available, stockLevel } = isProductAvailable(chosen);
        const item = chosen.items?.[0];

        let priceValue: number | undefined;
        if (item?.price) {
            if (typeof item.price === "number") {
                priceValue = item.price;
            } else if (typeof item.price === "object") {
                priceValue = item.price.promo ?? item.price.regular;
            }
        }

        const imageUrl = selectBestImageUrl(chosen.images) ?? undefined;

        const soldBy = item?.soldBy?.toUpperCase() === "WEIGHT" ? "WEIGHT" as const : "UNIT" as const;

        return {
            products,
            match: {
                krogerProductId: chosen.productId,
                name: chosen.description,
                imageUrl,
                price: typeof priceValue === "number" && Number.isFinite(priceValue) ? priceValue : undefined,
                soldBy,
                size: item?.size,
                aisle: item?.aisleLocations?.[0]?.description,
                available,
                stockLevel,
            },
        };
    }

    // Try full search term first
    const firstTry = await runSearch(searchTerm);

    // Cache the results (even if no match, to avoid repeated API calls)
    if (locationId && firstTry.products.length > 0) {
        const cachedProducts = firstTry.products.map(krogerProductToCached);
        await writeProductsCache(locationId, trimmed, cachedProducts, cachedProducts.length);
    }

    if (firstTry.match) {
        return firstTry.match;
    }

    // Try fallback search term
    const fallback = buildFallbackSearchTerm(searchTerm);
    if (!fallback) {
        // Cache as "not found"
        if (locationId) {
            await cacheNotFound(locationId, trimmed);
        }
        return null;
    }

    console.log("🔁 Fallback Kroger search term:", fallback);
    const fallbackTry = await runSearch(fallback);

    // Cache fallback results under original term
    if (locationId && fallbackTry.products.length > 0) {
        const cachedProducts = fallbackTry.products.map(krogerProductToCached);
        await writeProductsCache(locationId, trimmed, cachedProducts, cachedProducts.length);
    }

    if (fallbackTry.match) {
        return fallbackTry.match;
    }

    // Cache as "not found"
    if (locationId) {
        await cacheNotFound(locationId, trimmed);
    }
    return null;
}

/**
 * Search for an available alternative product when the primary match is unavailable.
 */
export async function searchAlternativeProduct(
    searchTerm: string,
    opts: { locationId?: string; excludeProductId?: string } = {},
): Promise<KrogerProductMatch | null> {
    const trimmed = searchTerm.trim();
    if (!trimmed) return null;

    const locationId = opts.locationId;
    const simplifiedTerm = buildFallbackSearchTerm(trimmed) || trimmed;

    // ─────────────────────────────────────────────────────────────────────────
    // Check cache first
    // ─────────────────────────────────────────────────────────────────────────
    if (locationId) {
        const cached = await getCachedProducts(locationId, simplifiedTerm);

        if (cached && cached.products.length > 0) {
            // Filter out excluded product, pet food, non-food items, and unavailable products
            const availableProducts = cached.products.filter(p => {
                if (opts.excludeProductId && p.productId === opts.excludeProductId) {
                    return false;
                }
                if (isPetFood(p)) return false;
                if (isNonFoodProduct(p)) return false;
                const { available } = isProductAvailable(p);
                return available;
            });

            if (availableProducts.length > 0) {
                let best: { product: CachedKrogerProduct; score: number } | null = null;
                for (const p of availableProducts) {
                    const s = scoreProduct(p, simplifiedTerm);
                    if (!best || s > best.score) {
                        best = { product: p, score: s };
                    }
                }

                if (best) {
                    console.log("✅ Alternative found from cache:", best.product.description);
                    return cachedToProductMatch(best.product);
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Call Kroger API
    // ─────────────────────────────────────────────────────────────────────────
    const token = await getKrogerToken();

    if (!API_BASE_URL) {
        console.error("Missing KROGER_API_BASE_URL env var.");
        throw new Error("Missing Kroger API base URL");
    }

    const params = new URLSearchParams();
    params.append("filter.term", simplifiedTerm);
    params.append("filter.limit", "12");
    if (locationId) {
        params.append("filter.locationId", locationId);
        params.append("filter.fulfillment", "ais");
    }

    let res: Response;
    try {
        res = await protectedKrogerFetch(
            `${API_BASE_URL}/products?${params.toString()}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                },
            },
            QUEUE_PRIORITY.ENRICH
        );
    } catch (error) {
        console.error("Kroger alternative search error (protected):", error);
        return null;
    }

    if (!res.ok) {
        console.error("Kroger alternative search error:", res.status);
        return null;
    }

    const json = (await res.json()) as { data?: KrogerProduct[] };
    const products = json.data ?? [];

    console.log("\n🔄 Searching for alternative product (API CALL)");
    console.log("Simplified term:", simplifiedTerm);
    console.log("Products found:", products.length);

    // Cache these results
    if (locationId && products.length > 0) {
        const cachedProducts = products.map(krogerProductToCached);
        await writeProductsCache(locationId, simplifiedTerm, cachedProducts, cachedProducts.length);
    }

    // Filter out excluded, pet food, non-food items, and unavailable products
    const availableProducts = products.filter((p) => {
        if (opts.excludeProductId && p.productId === opts.excludeProductId) {
            return false;
        }
        if (isPetFood(p)) return false;
        if (isNonFoodProduct(p)) return false;
        const { available } = isProductAvailable(p);
        return available;
    });

    console.log("Available alternatives (food only):", availableProducts.length);

    if (availableProducts.length === 0) {
        console.log("❌ No available alternatives found.\n");
        return null;
    }

    // Score and pick best
    let best: { product: KrogerProduct; score: number } | null = null;
    for (const p of availableProducts) {
        const s = scoreProduct(p, simplifiedTerm);
        if (!best || s > best.score) {
            best = { product: p, score: s };
        }
    }

    if (!best) return null;

    const chosen = best.product;
    const { available, stockLevel } = isProductAvailable(chosen);
    const item = chosen.items?.[0];

    const imageUrl = selectBestImageUrl(chosen.images) ?? undefined;

    let priceValue: number | undefined;
    if (item?.price) {
        if (typeof item.price === "number") {
            priceValue = item.price;
        } else if (typeof item.price === "object") {
            priceValue = item.price.promo ?? item.price.regular;
        }
    }

    console.log("✅ Alternative found:", chosen.description);
    console.log("\n");

    const soldBy = item?.soldBy?.toUpperCase() === "WEIGHT" ? "WEIGHT" as const : "UNIT" as const;

    return {
        krogerProductId: chosen.productId,
        name: chosen.description,
        imageUrl,
        price: typeof priceValue === "number" && Number.isFinite(priceValue) ? priceValue : undefined,
        soldBy,
        size: item?.size,
        aisle: item?.aisleLocations?.[0]?.description,
        available,
        stockLevel,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Search for Multiple Products (for swap suggestions)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search for multiple Kroger products matching a search term.
 * Returns up to `limit` products, excluding any specified product IDs.
 */
export async function searchKrogerProducts(
    searchTerm: string,
    opts: {
        locationId?: string;
        excludeProductIds?: string[];
        limit?: number;
    } = {},
): Promise<KrogerProductMatch[]> {
    const trimmed = searchTerm.trim();
    if (!trimmed) return [];

    const locationId = opts.locationId;
    const excludeIds = new Set(opts.excludeProductIds ?? []);
    const limit = opts.limit ?? 5;

    // ─────────────────────────────────────────────────────────────────────────
    // Check cache first
    // ─────────────────────────────────────────────────────────────────────────
    if (locationId) {
        const cached = await getCachedProducts(locationId, trimmed);

        if (cached && cached.products.length > 0) {
            // Filter available products, excluding specified IDs, pet food, and non-food items
            const availableProducts = cached.products.filter(p => {
                if (excludeIds.has(p.productId)) return false;
                if (isPetFood(p)) return false; // Never show pet food
                if (isNonFoodProduct(p)) return false; // Never show non-grocery items
                const { available } = isProductAvailable(p);
                return available;
            });

            if (availableProducts.length > 0) {
                // Score and sort
                const scored = availableProducts.map(p => ({
                    product: p,
                    score: scoreProduct(p, trimmed),
                }));
                scored.sort((a, b) => b.score - a.score);

                return scored.slice(0, limit).map(s => cachedToProductMatch(s.product));
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Call Kroger API
    // ─────────────────────────────────────────────────────────────────────────
    const token = await getKrogerToken();

    if (!API_BASE_URL) {
        console.error("Missing KROGER_API_BASE_URL env var.");
        throw new Error("Missing Kroger API base URL");
    }

    const params = new URLSearchParams();
    params.append("filter.term", trimmed);
    params.append("filter.limit", "15"); // Fetch more to have options after filtering
    if (locationId) {
        params.append("filter.locationId", locationId);
        params.append("filter.fulfillment", "ais");
    }

    let res: Response;
    try {
        res = await protectedKrogerFetch(
            `${API_BASE_URL}/products?${params.toString()}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                },
            },
            QUEUE_PRIORITY.ENRICH
        );
    } catch (error) {
        console.error("Kroger multi-product search error (protected):", error);
        return [];
    }

    if (!res.ok) {
        console.error("Kroger multi-product search error:", res.status);
        return [];
    }

    const json = (await res.json()) as { data?: KrogerProduct[] };
    const products = json.data ?? [];

    console.log("\n🔎 Kroger Multi-Product Search (API CALL)");
    console.log("Search Term:", trimmed);
    console.log("Products Returned:", products.length);

    // Cache results
    if (locationId && products.length > 0) {
        const cachedProducts = products.map(krogerProductToCached);
        await writeProductsCache(locationId, trimmed, cachedProducts, cachedProducts.length);
    }

    // Filter available products, excluding specified IDs, pet food, and non-food items
    const availableProducts = products.filter((p) => {
        if (excludeIds.has(p.productId)) return false;
        if (isPetFood(p)) return false; // Never show pet food
        if (isNonFoodProduct(p)) return false; // Never show non-grocery items
        const { available } = isProductAvailable(p);
        return available;
    });

    console.log("Available after filtering (food only):", availableProducts.length);

    if (availableProducts.length === 0) {
        return [];
    }

    // Score and sort
    const scored = availableProducts.map(p => ({
        product: p,
        score: scoreProduct(p, trimmed),
    }));
    scored.sort((a, b) => b.score - a.score);

    // Convert to KrogerProductMatch format
    return scored.slice(0, limit).map(({ product }) => {
        const { available, stockLevel } = isProductAvailable(product);
        const item = product.items?.[0];

        const imageUrl = selectBestImageUrl(product.images) ?? undefined;

        let priceValue: number | undefined;
        if (item?.price) {
            if (typeof item.price === "number") {
                priceValue = item.price;
            } else if (typeof item.price === "object") {
                priceValue = item.price.promo ?? item.price.regular;
            }
        }

        const soldBy = item?.soldBy?.toUpperCase() === "WEIGHT" ? "WEIGHT" as const : "UNIT" as const;

        return {
            krogerProductId: product.productId,
            name: product.description,
            imageUrl,
            price: typeof priceValue === "number" && Number.isFinite(priceValue) ? priceValue : undefined,
            soldBy,
            size: item?.size,
            aisle: item?.aisleLocations?.[0]?.description,
            available,
            stockLevel,
        };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Location Search
// ─────────────────────────────────────────────────────────────────────────────

export type KrogerLocationResult = {
    locationId: string;
    name: string;
    addressLine1: string;
    city: string;
    state: string;
    zipCode: string;
};

/**
 * Search Kroger locations near a ZIP code.
 */
export async function searchKrogerLocationsByZip(
    zip: string,
    limit = 10,
): Promise<KrogerLocationResult[]> {
    const trimmed = zip.trim();
    if (!trimmed) return [];

    const token = await getKrogerToken();

    if (!API_BASE_URL) {
        console.error("Missing KROGER_API_BASE_URL env var.");
        throw new Error("Missing Kroger API base URL");
    }

    const params = new URLSearchParams();
    params.append("filter.zipCode.near", trimmed);
    params.append("filter.limit", String(limit));

    let res: Response;
    try {
        res = await protectedKrogerFetch(
            `${API_BASE_URL}/locations?${params.toString()}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                },
            },
            QUEUE_PRIORITY.LOCATION
        );
    } catch (error) {
        console.error("Kroger locations error (protected):", error);
        return [];
    }

    if (!res.ok) {
        const text = await res.text();
        console.error("Kroger locations error:", res.status, text);
        return [];
    }

    const json = (await res.json()) as {
        data?: {
            locationId: string;
            name: string;
            address: {
                addressLine1?: string;
                city?: string;
                state?: string;
                zipCode?: string;
            };
        }[];
    };

    const data = json.data ?? [];
    return data.map((loc) => ({
        locationId: loc.locationId,
        name: loc.name,
        addressLine1: loc.address.addressLine1 ?? "",
        city: loc.address.city ?? "",
        state: loc.address.state ?? "",
        zipCode: loc.address.zipCode ?? "",
    }));
}
