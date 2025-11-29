// lib/kroger.ts
import "server-only";

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

type KrogerProduct = {
    productId: string;
    description: string;
    images?: {
        sizes: { url: string }[];
    }[];
    categories?: string[];
    items?: {
        size?: string;
        price?: number;
        soldBy?: string;
        aisleLocations?: { description?: string }[];
    }[];
};

/**
 * Score how good a Kroger product is for a given ingredient search term.
 * Higher score = better match.
 */
function scoreProductForIngredient(
    product: KrogerProduct,
    searchTerm: string,
): number {
    const desc = product.description.toLowerCase();
    const term = searchTerm.toLowerCase().trim();

    let score = 0;

    // Basic text match
    if (desc.includes(term)) score += 5;

    // Exact word match (e.g. "lemon" as a word, not just "lemon-lime soda")
    const wordRegex = new RegExp(`\\b${term}\\b`);
    if (wordRegex.test(desc)) score += 3;

    // Prefer certain categories for generic ingredients (produce, meat, dairy, etc.)
    const categories = (product.categories ?? []).map((c) => c.toLowerCase());
    const goodCategoryHints = [
        "produce",
        "fruit",
        "vegetable",
        "meat",
        "seafood",
        "dairy",
        "cheese",
        "eggs",
        "pantry",
        "spices",
        "baking",
        "frozen",
    ];
    if (categories.some((c) => goodCategoryHints.some((g) => c.includes(g)))) {
        score += 4;
    }

    // Heavily penalize obvious beverages / sodas
    const badWords = [
        "soda",
        "soft drink",
        "pop",
        "cola",
        "energy drink",
        "sports drink",
        "sparkling",
        "sprite",
        "coke",
        "pepsi",
        "mountain dew",
        "zero sugar",
        "diet",
    ];
    if (badWords.some((w) => desc.includes(w))) {
        score -= 10;
    }

    // Lightly reward short, clean ingredient-like descriptions
    if (desc.length < 40) score += 2;

    return score;
}

function buildFallbackSearchTerm(original: string): string | null {
    const lower = original.toLowerCase().trim();

    // Common adjectives / prep words we can safely drop
    const throwAway = new Set([
        "fresh",
        "ground",
        "canned",
        "grated",
        "finely",
        "chopped",
        "minced",
        "sliced",
        "diced",
        "boneless",
        "skinless",
        "lean",
        "reduced",
        "no-salt",
        "no",
        "salted",
        "unsalted",
        "organic",
        "low-sodium",
        "low",
    ]);

    const words = lower.split(/\s+/);

    // If it's just one word like "lentils", there's nothing to simplify
    if (words.length === 1) return null;

    const filtered = words.filter((w) => !throwAway.has(w));
    if (!filtered.length) return null;

    const fallback = filtered.join(" ").trim();
    if (!fallback || fallback === lower) return null;

    return fallback;
}

export type KrogerProductMatch = {
    krogerProductId: string;
    name: string;
    imageUrl?: string;
    price?: number;
    size?: string;
    aisle?: string;
};

export async function searchKrogerProduct(
    searchTerm: string,
    opts: { locationId?: string } = {},
): Promise<KrogerProductMatch | null> {
    async function runSearch(term: string): Promise<KrogerProductMatch | null> {
        const trimmed = term.trim();
        if (!trimmed) return null;

        const token = await getKrogerToken();

        if (!API_BASE_URL) {
            console.error("Missing KROGER_API_BASE_URL env var.");
            throw new Error("Missing Kroger API base URL");
        }

        const params = new URLSearchParams();
        params.append("filter.term", trimmed);
        params.append("filter.limit", "8");
        if (opts.locationId) {
            params.append("filter.locationId", opts.locationId);
        }

        const res = await fetch(`${API_BASE_URL}/products?${params.toString()}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
            next: { revalidate: 60 * 60 },
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("Kroger search error:", res.status, text);
            return null;
        }

        const json = (await res.json()) as { data?: KrogerProduct[] };
        const products = json.data ?? [];

        console.log("\n🔎 Kroger Search");
        console.log("Search Term:", trimmed);
        console.log("Products Returned:", products.length);

        products.forEach((p, idx) => {
            console.log(`  [${idx}] ${p.description}`);
        });

        if (!products.length) {
            console.log("❌ No products found.\n");
            return null;
        }

        // Scoring
        let best: { product: KrogerProduct; score: number } | null = null;

        console.log("Scores:");
        for (const p of products) {
            const score = scoreProductForIngredient(p, trimmed);
            console.log(`  > ${p.description} => score ${score}`);
            if (!best || score > best.score) {
                best = { product: p, score };
            }
        }

        if (best) {
            console.log("Chosen Product:", best.product.description);
            console.log("Chosen Score:", best.score);
        } else {
            console.log("No scoring winner — fallback to first item");
        }
        console.log("\n");

        const chosen = best && best.score > 0 ? best.product : products[0];

        const imageUrl =
            chosen.images?.[0]?.sizes?.[0]?.url ??
            (chosen.images?.[0]?.sizes &&
                chosen.images[0].sizes[chosen.images[0].sizes.length - 1]?.url) ??
            undefined;

        const item = chosen.items?.[0];

        return {
            krogerProductId: chosen.productId,
            name: chosen.description,
            imageUrl,
            price:
                typeof item?.price === "number" && Number.isFinite(item.price)
                    ? item.price
                    : undefined,
            size: item?.size,
            aisle: item?.aisleLocations?.[0]?.description,
        };
    }

    // 1) Try full ingredient name ("Ground flaxseed")
    const firstTry = await runSearch(searchTerm);
    if (firstTry) return firstTry;

    // 2) Try simplified term ("flaxseed")
    const fallback = buildFallbackSearchTerm(searchTerm);
    if (!fallback) return null;

    console.log("🔁 Fallback Kroger search term:", fallback);
    return runSearch(fallback);
}

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
 * Uses the same TOKEN_URL / API_BASE_URL / CLIENT_ID / SECRET as products.
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
            next: { revalidate: 60 * 10 }, // 10 minutes
        },
    );

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
