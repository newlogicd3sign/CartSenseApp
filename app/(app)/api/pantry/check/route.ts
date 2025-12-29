import { NextResponse } from "next/server";
import { checkPantryItems } from "@/lib/pantry";

type RequestBody = {
  userId: string;
  ingredients: string[]; // ingredient names to check
};

/**
 * POST /api/pantry/check
 *
 * Check which ingredients the user likely has in their pantry.
 * Returns ingredient keys that are in pantry (not expired).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    if (!body.userId) {
      return NextResponse.json(
        { error: "USER_ID_REQUIRED", message: "User ID is required" },
        { status: 400 }
      );
    }

    if (!body.ingredients || !Array.isArray(body.ingredients)) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "Ingredients array is required" },
        { status: 400 }
      );
    }

    console.log(`[Pantry Check] Checking ${body.ingredients.length} ingredients for user ${body.userId}`);
    const inPantry = await checkPantryItems(body.userId, body.ingredients);
    console.log(`[Pantry Check] Found ${inPantry.size} items in pantry:`, Array.from(inPantry));

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
