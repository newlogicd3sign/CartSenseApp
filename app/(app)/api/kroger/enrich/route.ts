// app/(app)/api/kroger/enrich/route.ts
// On-demand Kroger product enrichment for meal ingredients
// Called when user views a meal detail page to lazy-load pricing/product data

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { searchKrogerProduct, searchAlternativeProduct, getKrogerApiStatus } from "@/lib/kroger";
import { isExcludedIngredient } from "@/lib/utils";
import { KROGER_RATE_LIMITS } from "@/lib/krogerConfig";

type Ingredient = {
    name: string;
    quantity: string;
    category?: string;
    aisle?: string;
    price?: number;
    krogerProductId?: string;
    productName?: string;
    productImageUrl?: string;
    productSize?: string;
    productAisle?: string;
    soldBy?: "WEIGHT" | "UNIT";
    stockLevel?: string;
    available?: boolean;
};

type EnrichedIngredient = Ingredient & {
    krogerProductId?: string;
    productName?: string;
    productImageUrl?: string;
    productSize?: string;
    productAisle?: string;
    price?: number;
    soldBy?: "WEIGHT" | "UNIT";
    stockLevel?: string;
    available?: boolean;
};

async function getUserDefaultLocationId(userId: string): Promise<string | null> {
    const userDocSnap = await adminDb.collection("users").doc(userId).get();
    const userData = userDocSnap.data();
    return userData?.defaultKrogerLocationId || null;
}

async function isKrogerLinked(userId: string): Promise<boolean> {
    const userDocSnap = await adminDb.collection("users").doc(userId).get();
    const userData = userDocSnap.data();
    return Boolean(userData?.krogerLinked);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, ingredients } = body as {
            userId: string;
            ingredients: Ingredient[];
        };

        if (!userId) {
            return NextResponse.json(
                { error: "USER_ID_REQUIRED", message: "User ID is required." },
                { status: 400 }
            );
        }

        if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
            return NextResponse.json(
                { error: "INGREDIENTS_REQUIRED", message: "Ingredients array is required." },
                { status: 400 }
            );
        }

        // Check if Kroger is linked
        const krogerLinked = await isKrogerLinked(userId);
        if (!krogerLinked) {
            return NextResponse.json(
                {
                    error: "NOT_LINKED",
                    message: "Kroger account is not linked.",
                    ingredients: ingredients // Return unchanged ingredients
                },
                { status: 200 } // Not an error - just means no enrichment
            );
        }

        // Get user's default location for better product search results
        const locationId = await getUserDefaultLocationId(userId);
        if (!locationId) {
            return NextResponse.json(
                {
                    error: "NO_STORE",
                    message: "No Kroger store selected.",
                    ingredients: ingredients // Return unchanged ingredients
                },
                { status: 200 } // Not an error - just means no enrichment
            );
        }

        console.log(`[ENRICH] Enriching ${ingredients.length} ingredients for user ${userId}`);

        // Check API status before starting
        const apiStatus = getKrogerApiStatus();
        if (apiStatus.circuitBreaker.isOpen) {
            console.warn(`[ENRICH] Circuit breaker open, returning unenriched ingredients`);
            return NextResponse.json({
                success: false,
                error: "API_UNAVAILABLE",
                message: "Kroger API temporarily unavailable. Please try again later.",
                ingredients: ingredients,
                enrichedCount: 0,
                totalCount: ingredients.length,
                retryAfterMs: apiStatus.circuitBreaker.cooldownRemainingMs,
            });
        }

        // Separate ingredients into those needing enrichment and those to skip
        const toEnrich: { index: number; ingredient: Ingredient }[] = [];
        const enrichedIngredients: EnrichedIngredient[] = [...ingredients];

        for (let i = 0; i < ingredients.length; i++) {
            const ingredient = ingredients[i];

            // Skip excluded ingredients like water
            if (isExcludedIngredient(ingredient.name)) {
                console.log(`[ENRICH] Skipping excluded ingredient: ${ingredient.name}`);
                continue;
            }

            // Skip if already enriched with Kroger data
            if (ingredient.krogerProductId) {
                console.log(`[ENRICH] Already enriched: ${ingredient.name}`);
                continue;
            }

            toEnrich.push({ index: i, ingredient });
        }

        console.log(`[ENRICH] ${toEnrich.length} ingredients need enrichment`);

        // Process in chunks to avoid overwhelming the API
        const CHUNK_SIZE = KROGER_RATE_LIMITS.MAX_CONCURRENT_REQUESTS;
        let successCount = 0;
        let errorCount = 0;

        for (let chunkStart = 0; chunkStart < toEnrich.length; chunkStart += CHUNK_SIZE) {
            const chunk = toEnrich.slice(chunkStart, chunkStart + CHUNK_SIZE);

            console.log(`[ENRICH] Processing chunk ${Math.floor(chunkStart / CHUNK_SIZE) + 1}/${Math.ceil(toEnrich.length / CHUNK_SIZE)}`);

            // Process chunk in parallel (but limited to CHUNK_SIZE concurrent requests)
            const chunkResults = await Promise.all(
                chunk.map(async ({ index, ingredient }) => {
                    try {
                        let product = await searchKrogerProduct(ingredient.name, {
                            locationId: locationId || undefined,
                        });

                        // If product found but not available, try to find an alternative
                        if (product && !product.available) {
                            console.log(`[ENRICH] Product "${product.name}" unavailable, searching alternative...`);
                            const alternative = await searchAlternativeProduct(ingredient.name, {
                                locationId: locationId || undefined,
                                excludeProductId: product.krogerProductId,
                            });

                            if (alternative && alternative.available) {
                                console.log(`[ENRICH] Found alternative: "${alternative.name}"`);
                                product = alternative;
                            }
                        }

                        if (!product) {
                            console.log(`[ENRICH] No match for: ${ingredient.name}`);
                            return { index, enriched: null };
                        }

                        console.log(`[ENRICH] Matched "${ingredient.name}" -> "${product.name}"`);

                        return {
                            index,
                            enriched: {
                                ...ingredient,
                                krogerProductId: product.krogerProductId,
                                productName: product.name,
                                productImageUrl: product.imageUrl,
                                productSize: product.size,
                                productAisle: product.aisle,
                                price: product.price,
                                soldBy: product.soldBy,
                                stockLevel: product.stockLevel,
                                available: product.available,
                                aisle: ingredient.aisle ?? product.aisle,
                            } as EnrichedIngredient,
                        };
                    } catch (err) {
                        console.error(`[ENRICH] Error enriching ${ingredient.name}:`, err);
                        return { index, enriched: null, error: true };
                    }
                })
            );

            // Apply results to enrichedIngredients array
            for (const result of chunkResults) {
                if (result.enriched) {
                    enrichedIngredients[result.index] = result.enriched;
                    successCount++;
                } else if ('error' in result && result.error) {
                    errorCount++;
                }
            }

            // Small delay between chunks to be gentle on the API
            if (chunkStart + CHUNK_SIZE < toEnrich.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        const enrichedCount = enrichedIngredients.filter(i => i.krogerProductId).length;
        console.log(`[ENRICH] Enriched ${enrichedCount}/${ingredients.length} ingredients (${successCount} new, ${errorCount} errors)`);

        return NextResponse.json({
            success: true,
            ingredients: enrichedIngredients,
            enrichedCount,
            totalCount: ingredients.length,
            newlyEnriched: successCount,
            errors: errorCount,
        });

    } catch (err) {
        console.error("[ENRICH] Error:", err);
        return NextResponse.json(
            { error: "SERVER_ERROR", message: "An unexpected error occurred." },
            { status: 500 }
        );
    }
}
