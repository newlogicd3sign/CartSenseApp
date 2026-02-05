import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyAuth } from "@/lib/authHelper";

export const runtime = "nodejs";

export type SavedInstacartRetailer = {
  retailer_key: string;
  name: string;
  retailer_logo_url: string;
  postal_code?: string; // ZIP code used to find this retailer
};

/**
 * GET /api/instacart/retailer
 *
 * Fetch the user's saved Instacart retailer preference.
 *
 * Response:
 * {
 *   success: boolean,
 *   retailer?: SavedInstacartRetailer | null,
 *   error?: string
 * }
 */
export async function GET(request: Request) {
  const auth = await verifyAuth(request);
  if (!auth.success) return auth.error;
  const userId = auth.userId;

  try {
    const userDoc = await adminDb.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json({
        success: true,
        retailer: null,
      });
    }

    const data = userDoc.data();
    const retailer = data?.defaultInstacartRetailer as SavedInstacartRetailer | undefined;

    return NextResponse.json({
      success: true,
      retailer: retailer || null,
    });
  } catch (error) {
    console.error("[Instacart Retailer GET] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch retailer preference",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/instacart/retailer
 *
 * Save the user's preferred Instacart retailer.
 *
 * Request body:
 * {
 *   retailer_key: string,
 *   name: string,
 *   retailer_logo_url: string
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   error?: string
 * }
 */
export async function POST(request: Request) {
  const auth = await verifyAuth(request);
  if (!auth.success) return auth.error;
  const userId = auth.userId;

  try {
    const body = await request.json();
    const { retailer_key, name, retailer_logo_url, postal_code } = body;

    if (!retailer_key || !name) {
      return NextResponse.json(
        { success: false, error: "retailer_key and name are required" },
        { status: 400 }
      );
    }

    const retailer: SavedInstacartRetailer = {
      retailer_key,
      name,
      retailer_logo_url: retailer_logo_url || "",
      postal_code: postal_code || undefined,
    };

    await adminDb.collection("users").doc(userId).set(
      {
        defaultInstacartRetailer: retailer,
      },
      { merge: true }
    );

    console.log("[Instacart Retailer POST] Saved retailer for user:", userId, retailer_key);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("[Instacart Retailer POST] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save retailer preference",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/instacart/retailer
 *
 * Clear the user's Instacart retailer preference.
 *
 * Response:
 * {
 *   success: boolean,
 *   error?: string
 * }
 */
export async function DELETE(request: Request) {
  const auth = await verifyAuth(request);
  if (!auth.success) return auth.error;
  const userId = auth.userId;

  try {
    await adminDb.collection("users").doc(userId).update({
      defaultInstacartRetailer: null,
    });

    console.log("[Instacart Retailer DELETE] Cleared retailer for user:", userId);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("[Instacart Retailer DELETE] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to clear retailer preference",
      },
      { status: 500 }
    );
  }
}
