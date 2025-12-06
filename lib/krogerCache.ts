// lib/krogerCache.ts
import "server-only";
import { adminDb } from "./firebaseAdmin";
import admin from "firebase-admin";

export interface CachedKrogerProduct {
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

export interface KrogerProductSearchCacheDoc {
    locationId: string;
    term: string;
    normalizedTerm: string;
    sourceEndpoint: "products.search";

    products: CachedKrogerProduct[];
    total: number;

    createdAt: FirebaseFirestore.Timestamp;
    updatedAt: FirebaseFirestore.Timestamp;
    expiresAt: FirebaseFirestore.Timestamp;

    hitCount: number;
    lastAccessedAt: FirebaseFirestore.Timestamp;
}

const CACHE_COLLECTION = "krogerProductSearchCache";

// ─────────────────────────────────────────────────────────────────────────────
// Category-based TTL (in hours)
// Aligned with real grocery pricing cycles
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_TTL_HOURS: Record<string, number> = {
    // Meat: 24-48 hours (prices change frequently, sales rotate)
    meat: 24,
    "fresh meat": 24,
    poultry: 24,
    seafood: 24,
    deli: 24,

    // Produce: 48 hours
    produce: 48,
    "fresh produce": 48,
    fruits: 48,
    vegetables: 48,

    // Dairy: 3-5 days (72-120 hours)
    dairy: 72,
    milk: 72,
    cheese: 72,
    eggs: 72,
    yogurt: 72,

    // Bakery: 3-7 days (72-168 hours)
    bakery: 72,
    bread: 72,
    "baked goods": 72,

    // Frozen: 7 days (168 hours)
    frozen: 168,
    "frozen foods": 168,
    "ice cream": 168,

    // Pantry: 14-30 days (336-720 hours)
    pantry: 336,
    canned: 336,
    "canned goods": 336,
    dry: 336,
    "dry goods": 336,
    pasta: 336,
    rice: 336,
    cereal: 336,
    snacks: 336,
    condiments: 336,
    spices: 336,
    baking: 336,

    // Household/Non-food: 30 days (720 hours)
    household: 720,
    cleaning: 720,
    "paper products": 720,
    "health & beauty": 720,
    "personal care": 720,
    pet: 720,
    baby: 720,

    // Beverages: 7-14 days
    beverages: 168,
    drinks: 168,
    water: 336,
    soda: 168,
    juice: 168,
    coffee: 336,
    tea: 336,
};

const DEFAULT_TTL_HOURS = 24; // Fallback to conservative 24 hours

/**
 * Determine the appropriate cache TTL based on product category/department.
 * Returns TTL in hours.
 */
function getCategoryTTL(products: CachedKrogerProduct[]): number {
    if (!products.length) {
        return DEFAULT_TTL_HOURS;
    }

    // Get the first product's category/department to determine TTL
    // (assumes all products in a search result are similar category)
    const firstProduct = products[0];
    const category = firstProduct.category?.toLowerCase() || "";
    const department = firstProduct.department?.toLowerCase() || "";

    // Check category first, then department
    for (const key of Object.keys(CATEGORY_TTL_HOURS)) {
        if (category.includes(key) || department.includes(key)) {
            return CATEGORY_TTL_HOURS[key];
        }
    }

    // Check for keywords in category/department
    if (category.includes("fresh") || department.includes("fresh")) {
        return 48; // Fresh items get shorter TTL
    }

    return DEFAULT_TTL_HOURS;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeTerm(term: string): string {
    return term.trim().toLowerCase().replace(/\s+/g, " ");
}

function slugify(term: string): string {
    return normalizeTerm(term)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function buildDocId(locationId: string, term: string): string {
    return `${locationId}_${slugify(term)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get cached products for a search term at a specific location.
 * Returns null if not found or expired.
 */
export async function getCachedProducts(
    locationId: string,
    term: string
): Promise<KrogerProductSearchCacheDoc | null> {
    try {
        const docId = buildDocId(locationId, term);
        const ref = adminDb.collection(CACHE_COLLECTION).doc(docId);
        const snap = await ref.get();

        if (!snap.exists) {
            console.log(`📦 Cache MISS for: "${term}" at location ${locationId}`);
            return null;
        }

        const data = snap.data() as KrogerProductSearchCacheDoc;
        const now = admin.firestore.Timestamp.now();

        // Check if expired
        if (data.expiresAt.toMillis() <= now.toMillis()) {
            console.log(`📦 Cache EXPIRED for: "${term}" at location ${locationId}`);
            return null;
        }

        console.log(`📦 Cache HIT for: "${term}" at location ${locationId} (${data.products.length} products, hit #${data.hitCount + 1})`);

        // Increment hitCount + update lastAccessedAt (fire-and-forget)
        ref.update({
            hitCount: admin.firestore.FieldValue.increment(1),
            lastAccessedAt: now,
        }).catch(() => { });

        return data;
    } catch (error) {
        console.error("Error reading product cache:", error);
        return null;
    }
}

/**
 * Write products to cache for a search term at a specific location.
 * TTL is automatically determined by product category if not explicitly provided.
 */
export async function writeProductsCache(
    locationId: string,
    term: string,
    products: CachedKrogerProduct[],
    total: number,
    ttlHours?: number
): Promise<KrogerProductSearchCacheDoc> {
    const docId = buildDocId(locationId, term);
    const ref = adminDb.collection(CACHE_COLLECTION).doc(docId);
    const now = admin.firestore.Timestamp.now();

    // Use category-based TTL if not explicitly provided
    const effectiveTTL = ttlHours ?? getCategoryTTL(products);
    const expiresAt = admin.firestore.Timestamp.fromMillis(
        now.toMillis() + effectiveTTL * 60 * 60 * 1000
    );

    const normalizedTerm = normalizeTerm(term);

    const doc: KrogerProductSearchCacheDoc = {
        locationId,
        term,
        normalizedTerm,
        sourceEndpoint: "products.search",
        products,
        total,
        createdAt: now,
        updatedAt: now,
        expiresAt,
        hitCount: 1,
        lastAccessedAt: now,
    };

    await ref.set(doc, { merge: true });

    const category = products[0]?.category || products[0]?.department || "unknown";
    console.log(`📦 Cache WRITE for: "${term}" at location ${locationId} (${products.length} products, TTL: ${effectiveTTL}h, category: ${category})`);

    return doc;
}

/**
 * Cache a "not found" result (empty products array) to avoid repeated API calls.
 */
export async function cacheNotFound(
    locationId: string,
    term: string,
    ttlHours: number = 6 // Shorter TTL for "not found" - might become available
): Promise<void> {
    try {
        await writeProductsCache(locationId, term, [], 0, ttlHours);
        console.log(`📦 Cache NOT_FOUND for: "${term}" at location ${locationId}`);
    } catch (error) {
        console.error("Error caching not-found:", error);
    }
}
