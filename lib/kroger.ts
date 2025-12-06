// lib/kroger.ts
import "server-only";
import {
    getCachedProducts,
    writeProductsCache,
    cacheNotFound,
    type CachedKrogerProduct,
} from "./krogerCache";

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
// Product Availability & Scoring
// ─────────────────────────────────────────────────────────────────────────────

// Pet food indicators - used to completely filter out pet products
const PET_FOOD_BRANDS = [
    "purina", "pedigree", "iams", "blue buffalo", "meow mix", "fancy feast",
    "friskies", "alpo", "beneful", "cesar", "nutro", "rachael ray nutrish",
    "wellness pet", "hill's science diet", "royal canin", "blue wilderness",
    "taste of the wild", "orijen", "acana", "merrick", "canidae", "fromm",
    "nutrisource", "diamond naturals", "earthborn", "zignature", "instinct",
];

const PET_FOOD_KEYWORDS = [
    "dog food", "cat food", "pet food", "dog treat", "cat treat", "pet treat",
    "kibble", "puppy food", "kitten food", "canine", "feline", "for dogs",
    "for cats", "for pets", "dog biscuit", "cat litter",
];

// Non-food product indicators - household, health, beauty, etc.
const NON_FOOD_KEYWORDS = [
    // Oral care
    "toothpaste", "toothbrush", "mouthwash", "dental floss", "denture",
    // Personal care / beauty
    "shampoo", "conditioner", "body wash", "soap bar", "hand soap", "lotion",
    "deodorant", "antiperspirant", "razor", "shaving cream", "aftershave",
    "makeup", "mascara", "lipstick", "foundation", "concealer", "nail polish",
    "hair dye", "hair color", "styling gel", "hairspray", "mousse",
    "face wash", "cleanser", "moisturizer", "sunscreen", "tanning",
    "cotton balls", "cotton swabs", "q-tips",
    // Health / medicine
    "medicine", "aspirin", "ibuprofen", "acetaminophen", "tylenol", "advil",
    "allergy relief", "cold medicine", "cough syrup", "antacid", "laxative",
    "bandage", "band-aid", "first aid", "thermometer", "heating pad",
    "vitamin supplement", "multivitamin", "fiber supplement",
    // Baby (non-food)
    "diaper", "baby wipe", "baby powder", "baby lotion", "baby shampoo",
    // Cleaning products
    "dish soap", "dishwasher detergent", "laundry detergent", "fabric softener",
    "bleach", "all-purpose cleaner", "glass cleaner", "disinfectant", "lysol",
    "toilet cleaner", "drain cleaner", "oven cleaner", "carpet cleaner",
    "air freshener", "febreze", "sponge", "scrub brush", "mop", "broom",
    "trash bag", "garbage bag", "aluminum foil", "plastic wrap", "parchment",
    // Paper products
    "paper towel", "toilet paper", "tissue", "napkin", "paper plate", "paper cup",
    // Laundry
    "stain remover", "dryer sheet", "laundry pod",
    // Batteries / household
    "battery", "light bulb", "candle",
];

const NON_FOOD_CATEGORIES = [
    "pet", "dog", "cat", "health", "beauty", "personal care", "oral care",
    "household", "cleaning", "laundry", "paper products", "baby care",
    "pharmacy", "medicine", "first aid", "cosmetics", "hair care", "skin care",
];

/**
 * Check if a product is pet food - these should never be displayed for human food searches.
 */
function isPetFood(product: KrogerProduct | CachedKrogerProduct): boolean {
    const desc = ("description" in product ? product.description : "").toLowerCase();

    // Check brand names
    if (PET_FOOD_BRANDS.some((brand) => desc.includes(brand))) {
        return true;
    }

    // Check keywords
    if (PET_FOOD_KEYWORDS.some((keyword) => desc.includes(keyword))) {
        return true;
    }

    // Check categories
    const categories: string[] = [];
    if ("categories" in product && Array.isArray(product.categories)) {
        categories.push(...product.categories.map(c => c.toLowerCase()));
    }
    if ("category" in product && typeof product.category === "string") {
        categories.push(product.category.toLowerCase());
    }
    if ("department" in product && typeof product.department === "string") {
        categories.push(product.department.toLowerCase());
    }

    if (categories.some((c) => c.includes("pet") || c.includes("dog") || c.includes("cat"))) {
        return true;
    }

    return false;
}

/**
 * Check if a product is a non-food item (household, health, beauty, etc.)
 * These should never be displayed for grocery/ingredient searches.
 */
function isNonFoodProduct(product: KrogerProduct | CachedKrogerProduct): boolean {
    const desc = ("description" in product ? product.description : "").toLowerCase();

    // Check non-food keywords
    if (NON_FOOD_KEYWORDS.some((keyword) => desc.includes(keyword))) {
        return true;
    }

    // Check categories
    const categories: string[] = [];
    if ("categories" in product && Array.isArray(product.categories)) {
        categories.push(...product.categories.map(c => c.toLowerCase()));
    }
    if ("category" in product && typeof product.category === "string") {
        categories.push(product.category.toLowerCase());
    }
    if ("department" in product && typeof product.department === "string") {
        categories.push(product.department.toLowerCase());
    }

    // Check if any category matches non-food categories
    // But be careful not to exclude "grocery" items that might have "health" in a sub-category
    if (categories.some((c) => NON_FOOD_CATEGORIES.some((nf) => c.includes(nf)))) {
        return true;
    }

    return false;
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
 * Works with both KrogerProduct (API) and CachedKrogerProduct (cache).
 */
function scoreProduct(
    product: KrogerProduct | CachedKrogerProduct,
    searchTerm: string,
): number {
    // Get description - works for both types
    const desc = ("description" in product ? product.description : "").toLowerCase();
    const term = searchTerm.toLowerCase().trim();

    let score = 0;

    // Stock level affects scoring
    const { stockLevel } = isProductAvailable(product);
    if (stockLevel === "LOW") {
        score -= 2;
    } else if (stockLevel === "HIGH") {
        score += 3;
    }

    // Basic text match
    if (desc.includes(term)) score += 5;

    // Exact word match
    const wordRegex = new RegExp(`\\b${term}\\b`);
    if (wordRegex.test(desc)) score += 3;

    // Get categories - handle both types
    const categories: string[] = [];
    if ("categories" in product && Array.isArray(product.categories)) {
        categories.push(...product.categories.map(c => c.toLowerCase()));
    }
    if ("category" in product && typeof product.category === "string") {
        categories.push(product.category.toLowerCase());
    }
    if ("department" in product && typeof product.department === "string") {
        categories.push(product.department.toLowerCase());
    }

    const freshProduceCategories = ["produce", "fruit", "vegetable", "fresh fruit", "fresh vegetable"];
    const otherGoodCategoryHints = ["meat", "seafood", "dairy", "cheese", "eggs", "pantry", "spices", "baking"];

    const isInFreshProduceCategory = categories.some((c) =>
        freshProduceCategories.some((g) => c.includes(g)) && !c.includes("frozen")
    );

    if (isInFreshProduceCategory) {
        score += 15;
    } else if (categories.some((c) => otherGoodCategoryHints.some((g) => c.includes(g)))) {
        score += 4;
    }

    // Penalize beverages/sodas
    const badWords = [
        "soda", "soft drink", "pop", "cola", "energy drink", "sports drink",
        "sparkling", "sprite", "coke", "pepsi", "mountain dew", "zero sugar",
        "diet", "lemonade", "drink", "beverage", "tea", "cocktail", "mixer",
    ];
    if (badWords.some((w) => desc.includes(w))) {
        score -= 10;
    }

    // Note: Pet food is filtered out entirely by isPetFood() before scoring

    // Penalize processed products
    const processedIndicators = [
        "chips", "bread", "muffin", "cake", "cookie", "bar", "smoothie", "shake",
        "dried", "dehydrated", "freeze-dried", "trail mix", "granola", "cereal",
        "jam", "jelly", "preserves", "sauce", "syrup", "flavored", "candy",
        "pudding", "yogurt", "ice cream",
    ];
    if (processedIndicators.some((w) => desc.includes(w))) {
        score -= 8;
    }

    // Boost juice products when searching for juice
    if (term.includes("juice")) {
        if (desc.includes("juice") && !desc.includes("lemonade") && !desc.includes("drink")) {
            score += 8;
        }
    }

    // Boost fresh items
    if (desc.includes("fresh") || desc.startsWith("fresh ")) {
        score += 10;
    }

    // Penalize frozen products
    const frozenIndicators = ["frozen", "steamable", "steam-in-bag", "microwaveable"];
    const isFrozenProduct = frozenIndicators.some((w) => desc.includes(w)) ||
        categories.some((c) => c.includes("frozen"));

    if (isFrozenProduct && !isInFreshProduceCategory) {
        score -= 15;
    }

    // Boost raw ingredient indicators
    const rawIndicators = ["bunch", "single", "each", "per lb", "- lb", "/lb"];
    if (rawIndicators.some((w) => desc.includes(w))) {
        score += 5;
    }

    // Reward short descriptions
    if (desc.length < 40) score += 2;

    // Handle pantry staples - prefer smaller/cheaper sizes
    const pantryStaples = [
        "olive oil", "vegetable oil", "canola oil", "coconut oil", "sesame oil",
        "soy sauce", "vinegar", "honey", "maple syrup", "worcestershire",
        "mustard", "ketchup", "mayonnaise", "hot sauce", "sriracha",
        "salt", "pepper", "sugar", "flour", "baking powder", "baking soda",
    ];
    const isPantryStaple = pantryStaples.some((staple) => term.includes(staple) || desc.includes(staple));

    if (isPantryStaple) {
        // Get price - handle both types
        let price: number | null = null;
        if ("promoPrice" in product) {
            price = product.promoPrice ?? product.regularPrice;
        } else if ("items" in product && product.items?.[0]?.price) {
            const itemPrice = product.items[0].price;
            if (typeof itemPrice === "number") {
                price = itemPrice;
            } else if (typeof itemPrice === "object") {
                price = itemPrice.promo ?? itemPrice.regular ?? null;
            }
        }

        if (typeof price === "number") {
            if (price <= 4) score += 5;
            else if (price <= 6) score += 2;
            else if (price > 10) score -= 3;
        }
    }

    return score;
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
    let imageUrl: string | null = null;
    if (product.images?.[0]?.sizes) {
        const sizes = product.images[0].sizes;
        // Prefer larger images
        imageUrl = sizes[sizes.length - 1]?.url ?? sizes[0]?.url ?? null;
    }

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

        const res = await fetch(`${API_BASE_URL}/products?${params.toString()}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
            next: { revalidate: 60 * 60 * 8 },
        });

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

        const imageUrl =
            chosen.images?.[0]?.sizes?.[0]?.url ??
            (chosen.images?.[0]?.sizes && chosen.images[0].sizes[chosen.images[0].sizes.length - 1]?.url) ??
            undefined;

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

    const res = await fetch(`${API_BASE_URL}/products?${params.toString()}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
        },
        next: { revalidate: 60 * 60 * 8 },
    });

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

    const imageUrl =
        chosen.images?.[0]?.sizes?.[0]?.url ??
        (chosen.images?.[0]?.sizes && chosen.images[0].sizes[chosen.images[0].sizes.length - 1]?.url) ??
        undefined;

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

    const res = await fetch(`${API_BASE_URL}/products?${params.toString()}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
        },
        next: { revalidate: 60 * 60 * 8 },
    });

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

        const imageUrl =
            product.images?.[0]?.sizes?.[0]?.url ??
            (product.images?.[0]?.sizes && product.images[0].sizes[product.images[0].sizes.length - 1]?.url) ??
            undefined;

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

    const res = await fetch(`${API_BASE_URL}/locations?${params.toString()}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
        },
        next: { revalidate: 60 * 10 },
    });

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
