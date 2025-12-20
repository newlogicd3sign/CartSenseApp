import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { searchKrogerProducts } from "@/lib/product-engine/kroger";
import { normalizeIngredientKey } from "@/lib/ingredientNormalization";

type SwapRequest = {
    userId: string;
    ingredientName: string;
    currentProductId?: string; // Exclude the current product from results
    searchTerm?: string; // Optional: use grocerySearchTerm if available
};

type PreferenceLock = {
    scope: string;
    key: string;
    rule: "NEVER_INCLUDE" | "AVOID" | "ALWAYS_INCLUDE" | "PREFER";
    note?: string;
};

type AvoidedIngredient = {
    key: string;
    rule: "NEVER_INCLUDE" | "AVOID";
    note?: string;
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

async function getUserAvoidedIngredients(userId: string): Promise<AvoidedIngredient[]> {
    try {
        const locksRef = adminDb
            .collection("preferenceLocks")
            .doc(userId)
            .collection("locks");

        const snapshot = await locksRef
            .where("scope", "==", "ingredient")
            .get();

        const avoided: AvoidedIngredient[] = [];

        snapshot.docs.forEach((doc) => {
            const data = doc.data() as PreferenceLock;
            if (data.rule === "NEVER_INCLUDE" || data.rule === "AVOID") {
                avoided.push({
                    key: data.key,
                    rule: data.rule,
                    note: data.note,
                });
            }
        });

        return avoided;
    } catch (err) {
        console.error("Error fetching user preference locks:", err);
        return [];
    }
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as SwapRequest;
        const { userId, ingredientName, currentProductId, searchTerm } = body;

        if (!userId) {
            return NextResponse.json(
                { error: "USER_ID_REQUIRED", message: "User ID is required" },
                { status: 400 }
            );
        }

        if (!ingredientName) {
            return NextResponse.json(
                { error: "INVALID_REQUEST", message: "Missing ingredient name" },
                { status: 400 }
            );
        }

        // Check if Kroger is linked
        const krogerLinked = await isKrogerLinked(userId);
        if (!krogerLinked) {
            return NextResponse.json(
                { error: "NOT_LINKED", message: "Kroger account is not linked" },
                { status: 400 }
            );
        }

        // Get user's default location
        const locationId = await getUserDefaultLocationId(userId);
        if (!locationId) {
            return NextResponse.json(
                { error: "NO_STORE", message: "No Kroger store selected" },
                { status: 400 }
            );
        }

        // Use the searchTerm if provided (grocerySearchTerm), otherwise use ingredient name
        const termToSearch = searchTerm || ingredientName;

        console.log(`[SWAP] Searching for alternatives to "${ingredientName}" (search: "${termToSearch}")`);

        // Fetch avoided ingredients and search in parallel
        const [alternatives, avoidedIngredients] = await Promise.all([
            searchKrogerProducts(termToSearch, {
                locationId,
                excludeProductIds: currentProductId ? [currentProductId] : [],
                limit: 5,
            }),
            getUserAvoidedIngredients(userId),
        ]);

        console.log(`[SWAP] Found ${alternatives.length} alternatives, ${avoidedIngredients.length} avoided ingredients`);

        // Check if search term itself matches an avoided ingredient
        const normalizedSearchTerm = normalizeIngredientKey(termToSearch);
        const searchTermWarning = avoidedIngredients.find(
            (avoided) => normalizedSearchTerm.includes(avoided.key) || avoided.key.includes(normalizedSearchTerm)
        );

        // Add warning flags to alternatives that match avoided ingredients
        const alternativesWithWarnings = alternatives.map((alt) => {
            const normalizedProductName = normalizeIngredientKey(alt.name);
            const matchedAvoid = avoidedIngredients.find(
                (avoided) =>
                    normalizedProductName.includes(avoided.key) ||
                    avoided.key.includes(normalizedProductName)
            );

            return {
                ...alt,
                avoidWarning: matchedAvoid ? {
                    rule: matchedAvoid.rule,
                    note: matchedAvoid.note,
                } : undefined,
            };
        });

        return NextResponse.json({
            success: true,
            alternatives: alternativesWithWarnings,
            searchTermWarning: searchTermWarning ? {
                ingredient: searchTermWarning.key,
                rule: searchTermWarning.rule,
                note: searchTermWarning.note,
            } : undefined,
        });

    } catch (error) {
        console.error("Error in /api/swap-suggestions:", error);
        return NextResponse.json(
            { error: "SERVER_ERROR", message: "Failed to get swap suggestions" },
            { status: 500 }
        );
    }
}
