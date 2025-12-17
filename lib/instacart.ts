"use server-only";

/**
 * Instacart Developer Platform Integration
 *
 * This module generates shoppable recipe/shopping list links via Instacart's
 * Developer Platform API. No OAuth required - uses API key authentication.
 *
 * Users click the generated link and complete their purchase on Instacart.
 */

const INSTACART_API_BASE = process.env.INSTACART_API_BASE_URL || "https://connect.instacart.com";
const INSTACART_API_KEY = process.env.INSTACART_API_KEY;

export type InstacartIngredient = {
  name: string;
  quantity?: number;
  unit?: string;
  display_text?: string;
};

export type InstacartLinkRequest = {
  title: string;
  ingredients: InstacartIngredient[];
  image_url?: string;
  partner_linkback_url?: string;
  enable_pantry_items?: boolean;
};

export type InstacartLinkResponse = {
  success: boolean;
  url?: string;
  error?: string;
};

/**
 * Supported units of measurement for Instacart API
 * https://docs.instacart.com/developer_platform_api/guide/concepts/units/
 */
const SUPPORTED_UNITS = new Set([
  "bag", "bottle", "box", "bunch", "can", "carton", "clove", "container",
  "count", "cup", "dozen", "drop", "each", "fl oz", "g", "gallon", "head",
  "jar", "kg", "large", "lb", "liter", "loaf", "medium", "ml", "oz",
  "pack", "package", "piece", "pint", "quart", "sheet", "slice", "small",
  "sprig", "stick", "strip", "tablespoon", "teaspoon", "tube", "unit"
]);

/**
 * Parse quantity string like "2 cups" or "1 lb" into components
 */
function parseQuantity(quantityStr: string): { quantity?: number; unit?: string } {
  if (!quantityStr) return {};

  // Try to match patterns like "2 cups", "1.5 lb", "3", etc.
  const match = quantityStr.match(/^([\d.\/]+)\s*(.*)$/);

  if (!match) return {};

  let quantity: number | undefined;
  const rawQuantity = match[1];

  // Handle fractions like "1/2"
  if (rawQuantity.includes("/")) {
    const [num, denom] = rawQuantity.split("/");
    quantity = parseFloat(num) / parseFloat(denom);
  } else {
    quantity = parseFloat(rawQuantity);
  }

  if (isNaN(quantity)) {
    quantity = undefined;
  }

  const rawUnit = match[2]?.toLowerCase().trim();
  const unit = rawUnit && SUPPORTED_UNITS.has(rawUnit) ? rawUnit : undefined;

  return { quantity, unit };
}

/**
 * Generate an Instacart shopping link for a list of ingredients
 */
export async function generateInstacartLink(
  request: InstacartLinkRequest
): Promise<InstacartLinkResponse> {
  if (!INSTACART_API_KEY) {
    console.error("INSTACART_API_KEY is not configured");
    return {
      success: false,
      error: "Instacart integration is not configured. Please add INSTACART_API_KEY to your environment.",
    };
  }

  if (!request.ingredients || request.ingredients.length === 0) {
    return {
      success: false,
      error: "No ingredients provided",
    };
  }

  try {
    // Build the request body for Instacart API
    const lineItems = request.ingredients.map((ing) => {
      const item: Record<string, unknown> = {
        name: ing.name,
      };

      // Parse quantity if provided as string
      if (ing.quantity !== undefined || ing.unit) {
        const measurements: Record<string, unknown> = {};
        if (ing.quantity !== undefined) {
          measurements.quantity = ing.quantity;
        }
        if (ing.unit && SUPPORTED_UNITS.has(ing.unit.toLowerCase())) {
          measurements.unit = ing.unit.toLowerCase();
        }
        if (Object.keys(measurements).length > 0) {
          item.measurements = measurements;
        }
      }

      // Add display text for UI
      if (ing.display_text) {
        item.display_text = ing.display_text;
      }

      return item;
    });

    const body: Record<string, unknown> = {
      title: request.title || "Shopping List",
      ingredients: lineItems,
    };

    // Optional fields
    if (request.image_url) {
      body.image_url = request.image_url;
    }

    // Landing page configuration
    const landingConfig: Record<string, unknown> = {};
    if (request.partner_linkback_url) {
      landingConfig.partner_linkback_url = request.partner_linkback_url;
    }
    if (request.enable_pantry_items !== undefined) {
      landingConfig.enable_pantry_items = request.enable_pantry_items;
    }
    if (Object.keys(landingConfig).length > 0) {
      body.landing_page_configuration = landingConfig;
    }

    console.log("[Instacart] Generating link for", lineItems.length, "items");

    const response = await fetch(`${INSTACART_API_BASE}/idp/v1/products/recipe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${INSTACART_API_KEY}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Instacart] API error:", response.status, errorText);

      if (response.status === 401) {
        return {
          success: false,
          error: "Instacart API key is invalid or expired",
        };
      }

      if (response.status === 429) {
        return {
          success: false,
          error: "Too many requests. Please try again in a moment.",
        };
      }

      return {
        success: false,
        error: `Instacart API error: ${response.status}`,
      };
    }

    const data = await response.json();

    if (!data.products_link_url) {
      console.error("[Instacart] No URL in response:", data);
      return {
        success: false,
        error: "Instacart did not return a shopping link",
      };
    }

    console.log("[Instacart] Successfully generated link");

    return {
      success: true,
      url: data.products_link_url,
    };
  } catch (error) {
    console.error("[Instacart] Error generating link:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate Instacart link",
    };
  }
}

/**
 * Helper to convert shopping list items to Instacart ingredients format
 */
export function convertToInstacartIngredients(
  items: Array<{ name: string; quantity?: string; count?: number }>
): InstacartIngredient[] {
  return items.map((item) => {
    const parsed = parseQuantity(item.quantity || "");

    return {
      name: item.name,
      quantity: parsed.quantity ?? item.count ?? 1,
      unit: parsed.unit,
      display_text: item.quantity ? `${item.quantity} ${item.name}` : item.name,
    };
  });
}
