import { NextResponse } from "next/server";
import { clearPantry } from "@/lib/pantry";
import { verifyAuth } from "@/lib/authHelper";

/**
 * POST /api/pantry/clear
 *
 * Clear all pantry items for the authenticated user.
 * Requires Authorization header with Firebase ID token.
 */
export async function POST(request: Request) {
  try {
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.success) return auth.error;
    const userId = auth.userId;

    const count = await clearPantry(userId);

    return NextResponse.json({ success: true, cleared: count });
  } catch (error) {
    console.error("Error clearing pantry:", error);
    return NextResponse.json(
      { error: "Failed to clear pantry" },
      { status: 500 }
    );
  }
}
