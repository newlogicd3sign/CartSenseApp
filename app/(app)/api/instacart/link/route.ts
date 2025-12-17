import { NextResponse } from "next/server";
import { generateInstacartLink, convertToInstacartIngredients } from "@/lib/instacart";

export const runtime = "nodejs";

type ShoppingItem = {
  id: string;
  name: string;
  quantity?: string;
  count?: number;
};

type RequestBody = {
  items: ShoppingItem[];
  title?: string;
  linkbackUrl?: string;
};

/**
 * POST /api/instacart/link
 *
 * Generates an Instacart shopping link for a list of items.
 * No user authentication required - uses server-side API key.
 *
 * Request body:
 * {
 *   items: [{ id, name, quantity?, count? }],
 *   title?: string,
 *   linkbackUrl?: string
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   url?: string,
 *   error?: string
 * }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: "No items provided" },
        { status: 400 }
      );
    }

    // Filter out any items without names
    const validItems = body.items.filter((item) => item.name?.trim());

    if (validItems.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid items provided" },
        { status: 400 }
      );
    }

    // Convert shopping list items to Instacart format
    const ingredients = convertToInstacartIngredients(validItems);

    // Generate the Instacart link
    const result = await generateInstacartLink({
      title: body.title || "CartSense Shopping List",
      ingredients,
      partner_linkback_url: body.linkbackUrl,
      enable_pantry_items: true, // Let users mark items they already have
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url: result.url,
      itemCount: validItems.length,
    });
  } catch (error) {
    console.error("[Instacart Link API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate Instacart link",
      },
      { status: 500 }
    );
  }
}
