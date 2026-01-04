import { NextRequest, NextResponse } from "next/server";
import { getKrogerProductDetails } from "@/lib/product-engine/kroger";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ productId: string }> }
) {
    try {
        const { productId } = await params;

        if (!productId) {
            return NextResponse.json(
                { error: "Product ID is required" },
                { status: 400 }
            );
        }

        const searchParams = request.nextUrl.searchParams;
        const locationId = searchParams.get("locationId") ?? undefined;

        const details = await getKrogerProductDetails(productId, { locationId });

        if (!details) {
            return NextResponse.json(
                { error: "Product not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(details);
    } catch (error) {
        console.error("Error fetching product details:", error);
        return NextResponse.json(
            { error: "Failed to fetch product details" },
            { status: 500 }
        );
    }
}
