// app/api/kroger/locations/route.ts
import { NextResponse } from "next/server";
import { searchKrogerLocationsByZip } from "@/lib/kroger";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const zip = searchParams.get("zip");

    if (!zip || !zip.trim()) {
        return NextResponse.json(
            { error: "ZIP_REQUIRED", message: "ZIP code is required." },
            { status: 400 },
        );
    }

    try {
        const locations = await searchKrogerLocationsByZip(zip, 10);
        return NextResponse.json({ locations });
    } catch (err) {
        console.error("Error in /api/kroger/locations:", err);
        return NextResponse.json(
            {
                error: "KROGER_LOCATION_ERROR",
                message: "Could not load stores for that ZIP.",
            },
            { status: 500 },
        );
    }
}
