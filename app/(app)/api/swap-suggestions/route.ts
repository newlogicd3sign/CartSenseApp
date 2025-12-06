import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { searchKrogerProducts } from "@/lib/kroger";

type SwapRequest = {
    userId: string;
    ingredientName: string;
    currentProductId?: string; // Exclude the current product from results
    searchTerm?: string; // Optional: use grocerySearchTerm if available
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

        // Search for alternative products, excluding the current one
        const alternatives = await searchKrogerProducts(termToSearch, {
            locationId,
            excludeProductIds: currentProductId ? [currentProductId] : [],
            limit: 5,
        });

        console.log(`[SWAP] Found ${alternatives.length} alternatives`);

        return NextResponse.json({
            success: true,
            alternatives,
        });

    } catch (error) {
        console.error("Error in /api/swap-suggestions:", error);
        return NextResponse.json(
            { error: "SERVER_ERROR", message: "Failed to get swap suggestions" },
            { status: 500 }
        );
    }
}
