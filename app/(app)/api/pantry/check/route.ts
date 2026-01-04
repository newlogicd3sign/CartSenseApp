import { NextResponse } from "next/server";
import { checkPantryItems } from "@/lib/pantry";
import { verifyAuth } from "@/lib/authHelper";

type RequestBody = {
  ingredients: string[]; // ingredient names to check
};

/**
 * POST /api/pantry/check
 *
 * Check which ingredients the user likely has in their pantry.
 * Returns ingredient keys that are in pantry (not expired).
 * Requires Authorization header with Firebase ID token.
 */
export async function POST(request: Request) {
  try {
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.success) return auth.error;
    const userId = auth.userId;

    const body = (await request.json()) as RequestBody;

    if (!body.ingredients || !Array.isArray(body.ingredients)) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "Ingredients array is required" },
        { status: 400 }
      );
    }

    const inPantry = await checkPantryItems(userId, body.ingredients);

    return NextResponse.json({
      success: true,
      inPantry: Array.from(inPantry),
    });
  } catch (error) {
    console.error("Error checking pantry items:", error);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Failed to check pantry items" },
      { status: 500 }
    );
  }
}
