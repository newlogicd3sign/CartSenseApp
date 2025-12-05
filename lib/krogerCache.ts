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
 */
export async function writeProductsCache(
    locationId: string,
    term: string,
    products: CachedKrogerProduct[],
    total: number,
    ttlHours: number = 24
): Promise<KrogerProductSearchCacheDoc> {
    const docId = buildDocId(locationId, term);
    const ref = adminDb.collection(CACHE_COLLECTION).doc(docId);
    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(
        now.toMillis() + ttlHours * 60 * 60 * 1000
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

    console.log(`📦 Cache WRITE for: "${term}" at location ${locationId} (${products.length} products)`);

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
