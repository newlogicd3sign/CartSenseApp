import { NextResponse } from "next/server";
import { generateInstacartLink, convertToInstacartIngredients, type InstacartLinkType } from "@/lib/instacart";
import { addToPantry } from "@/lib/pantry";

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
  imageUrl?: string;
  linkbackUrl?: string;
  linkType?: InstacartLinkType; // "recipe" (default) or "shopping_list"
  userId?: string; // Optional - if provided, save items to pantry
  instructions?: string[]; // Recipe cooking instructions/steps
  retailerKey?: string; // Pre-select a specific Instacart retailer
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

    // Determine link type - shopping_list for shopping list page, recipe for meals
    const linkType = body.linkType || "recipe";
    const isShoppingList = linkType === "shopping_list";

    // Generate the Instacart link
    const result = await generateInstacartLink({
      title: body.title || "CartSense Shopping List",
      ingredients,
      image_url: body.imageUrl,
      partner_linkback_url: body.linkbackUrl,
      enable_pantry_items: !isShoppingList, // Only for recipes
      link_type: linkType,
      instructions: body.instructions, // Pass recipe instructions for recipes
      retailer_key: body.retailerKey, // Pre-select retailer if specified
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Save items to pantry if userId is provided
    if (body.userId) {
      try {
        const pantryItems = validItems.map((item) => ({
          name: item.name,
          quantity: item.count || 1,
        }));
        await addToPantry(body.userId, pantryItems, "cart_added");
      } catch (pantryErr) {
        console.error("Error saving to pantry:", pantryErr);
        // Don't fail the request - link was generated successfully
      }
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
