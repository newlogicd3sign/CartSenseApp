import { NextResponse } from "next/server";

export const runtime = "nodejs";

const INSTACART_API_BASE = process.env.INSTACART_API_BASE_URL || "https://connect.instacart.com";
const INSTACART_API_KEY = process.env.INSTACART_API_KEY;

export type InstacartRetailer = {
  retailer_key: string;
  name: string;
  retailer_logo_url: string;
};

/**
 * GET /api/instacart/retailers
 *
 * Returns a list of Instacart retailers near a given postal code.
 *
 * Query params:
 * - postal_code: Required. The ZIP code to search near.
 *
 * Response:
 * {
 *   success: boolean,
 *   retailers?: InstacartRetailer[],
 *   error?: string
 * }
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postalCode = searchParams.get("postal_code");

  if (!postalCode) {
    return NextResponse.json(
      { success: false, error: "postal_code is required" },
      { status: 400 }
    );
  }

  if (!INSTACART_API_KEY) {
    console.error("INSTACART_API_KEY is not configured");
    return NextResponse.json(
      { success: false, error: "Instacart integration is not configured" },
      { status: 500 }
    );
  }

  try {
    const url = `${INSTACART_API_BASE}/idp/v1/retailers?postal_code=${encodeURIComponent(postalCode)}&country_code=US`;

    console.log("[Instacart Retailers] Fetching retailers for postal code:", postalCode);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${INSTACART_API_KEY}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Instacart Retailers] API error:", response.status, errorText);

      if (response.status === 401) {
        return NextResponse.json(
          { success: false, error: "Instacart API key is invalid or expired" },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { success: false, error: `Instacart API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Extract relevant fields from each retailer
    const retailers: InstacartRetailer[] = (data.retailers || []).map((r: {
      retailer_key: string;
      name: string;
      retailer_logo_url?: string;
    }) => ({
      retailer_key: r.retailer_key,
      name: r.name,
      retailer_logo_url: r.retailer_logo_url || "",
    }));

    console.log("[Instacart Retailers] Found", retailers.length, "retailers");

    return NextResponse.json({
      success: true,
      retailers,
    });
  } catch (error) {
    console.error("[Instacart Retailers] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch retailers",
      },
      { status: 500 }
    );
  }
}
