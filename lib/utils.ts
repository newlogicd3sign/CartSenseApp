// Ingredients that should be completely excluded from shopping lists
// These are items you don't need to buy (tap water, etc.)
const EXCLUDED_INGREDIENTS = new Set([
  "water", "cold water", "warm water", "hot water", "boiling water",
  "ice water", "lukewarm water", "room temperature water", "tap water",
  "filtered water", "ice", "ice cubes",
]);

// Staple items that you typically don't need multiples of (oils, spices, etc.)
// These will be skipped if already in the shopping list
const STAPLE_ITEMS = new Set([
  // Oils and fats
  "olive oil", "vegetable oil", "canola oil", "coconut oil", "sesame oil",
  "avocado oil", "cooking spray", "butter", "ghee", "lard",
  // Vinegars
  "vinegar", "balsamic vinegar", "apple cider vinegar", "red wine vinegar",
  "white wine vinegar", "rice vinegar",
  // Sauces and condiments
  "soy sauce", "fish sauce", "worcestershire sauce", "hot sauce", "sriracha",
  "ketchup", "mustard", "mayonnaise", "honey", "maple syrup", "molasses",
  "bbq sauce", "barbecue sauce", "steak sauce", "teriyaki sauce", "hoisin sauce",
  // Spices and seasonings (these are typically bought once)
  "salt", "pepper", "black pepper", "garlic powder", "onion powder",
  "cumin", "paprika", "chili powder", "oregano", "basil", "thyme",
  "rosemary", "cinnamon", "nutmeg", "cayenne", "turmeric", "ginger powder",
  "bay leaves", "red pepper flakes", "italian seasoning", "curry powder",
  "coriander", "cardamom", "allspice", "cloves",
  // Baking staples
  "flour", "all-purpose flour", "bread flour", "whole wheat flour",
  "sugar", "brown sugar", "powdered sugar", "baking soda", "baking powder",
  "vanilla extract", "almond extract", "cocoa powder", "cornstarch",
  "yeast", "cream of tartar",
  // Pantry staples
  "rice", "pasta", "bread crumbs", "panko", "oats", "quinoa",
  // Dairy staples (typically buy container, not multiple)
  "milk", "cream", "heavy cream", "sour cream", "cream cheese",
  "parmesan cheese", "parmesan",
]);

// Common patterns that indicate countable produce/proteins
const COUNTABLE_PATTERNS = [
  /banana/i, /apple/i, /orange/i, /lemon/i, /lime/i, /avocado/i,
  /tomato/i, /potato/i, /onion/i, /carrot/i, /pepper/i, /cucumber/i,
  /zucchini/i, /squash/i, /eggplant/i, /peach/i, /pear/i, /mango/i,
  /egg/i, /chicken breast/i, /thigh/i, /steak/i, /chop/i, /fillet/i,
  /clove/i, /head/i, /bunch/i, /stalk/i, /rib/i,
];

/**
 * Normalize an ingredient name for comparison
 * Removes common modifiers and lowercases
 */
export function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^(fresh|dried|ground|minced|chopped|diced|sliced|whole|organic|large|medium|small|extra|virgin)\s+/gi, "")
    .replace(/,.*$/, "") // Remove anything after comma
    .trim();
}

/**
 * Check if an ingredient should be completely excluded from shopping lists
 * (e.g., water which comes from the tap)
 */
export function isExcludedIngredient(ingredientName: string): boolean {
  const normalized = normalizeIngredientName(ingredientName);

  // Check exact match
  if (EXCLUDED_INGREDIENTS.has(normalized)) {
    return true;
  }

  // Check if the normalized name is just "water" or ends with "water"
  // This catches variations like "1 cup water" normalized to "water"
  if (normalized === "water" || normalized.endsWith(" water")) {
    return true;
  }

  // Check if it contains an excluded item
  for (const excluded of EXCLUDED_INGREDIENTS) {
    if (normalized === excluded) {
      return true;
    }

    // Partial matching - be careful with short words like "ice" matching "juice"
    if (excluded.length > 3 && normalized.includes(excluded)) {
      return true;
    }

    // For short excluded words, require word boundaries
    if (excluded.length <= 3) {
      const regex = new RegExp(`\\b${excluded}\\b`, 'i');
      if (regex.test(normalized)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Determine if an ingredient is a "staple" item that shouldn't be duplicated
 * vs a "countable" item where quantity should be combined
 */
export function isStapleItem(ingredientName: string): boolean {
  const normalized = normalizeIngredientName(ingredientName);

  // Check if it matches any staple item
  if (STAPLE_ITEMS.has(normalized)) {
    return true;
  }

  // Check if it contains a staple item name
  for (const staple of STAPLE_ITEMS) {
    if (normalized.includes(staple) || staple.includes(normalized)) {
      return true;
    }
  }

  return false;
}

/**
 * Determine if an ingredient is countable (can combine quantities)
 */
export function isCountableItem(ingredientName: string): boolean {
  const normalized = normalizeIngredientName(ingredientName);

  // If it's a staple, it's not countable (we skip staples)
  if (isStapleItem(ingredientName)) {
    return false;
  }

  // Check if it matches countable patterns
  for (const pattern of COUNTABLE_PATTERNS) {
    if (pattern.test(normalized)) {
      return true;
    }
  }

  // Default: treat as countable (combine quantities)
  return true;
}

/**
 * Check if two ingredient names refer to the same item
 */
export function isSameIngredient(name1: string, name2: string): boolean {
  const n1 = normalizeIngredientName(name1);
  const n2 = normalizeIngredientName(name2);

  // Exact match
  if (n1 === n2) return true;

  // One contains the other (e.g., "olive oil" matches "extra virgin olive oil")
  if (n1.includes(n2) || n2.includes(n1)) return true;

  return false;
}

// Design system accent colors (excluding the primary blue to add variety)
export const ACCENT_COLORS: AccentColor[] = [
  { primary: "#10b981", dark: "#059669" }, // green (success)
  { primary: "#f97316", dark: "#ea580c" }, // orange (warning)
  { primary: "#a855f7", dark: "#9333ea" }, // purple
  { primary: "#3b82f6", dark: "#2563eb" }, // blue
  { primary: "#ec4899", dark: "#db2777" }, // pink
  { primary: "#14b8a6", dark: "#0d9488" }, // teal
];

export type AccentColor = { primary: string; dark: string };

export function getRandomAccentColor(): AccentColor {
  return ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];
}

export function getRandomAccentColorExcluding(exclude: AccentColor): AccentColor {
  const filtered = ACCENT_COLORS.filter(c => c.primary !== exclude.primary);
  return filtered[Math.floor(Math.random() * filtered.length)];
}

// Kroger family of stores brand mapping
// The Kroger API returns store names like "Smith's Food & Drug", "Ralphs", "Fred Meyer", etc.
// This extracts the brand name for display purposes
export type StoreBrandInfo = {
  displayName: string;
  tagline: string;
  cartUrl: string;
};

export const KROGER_STORE_BRANDS: Record<string, StoreBrandInfo> = {
  "kroger": { displayName: "Kroger", tagline: "Fresh for Everyone", cartUrl: "https://www.kroger.com/cart" },
  "smith's": { displayName: "Smith's", tagline: "Fresh for Everyone", cartUrl: "https://www.smithsfoodanddrug.com/cart" },
  "smiths": { displayName: "Smith's", tagline: "Fresh for Everyone", cartUrl: "https://www.smithsfoodanddrug.com/cart" },
  "ralphs": { displayName: "Ralphs", tagline: "Fresh for Everyone", cartUrl: "https://www.ralphs.com/cart" },
  "fred meyer": { displayName: "Fred Meyer", tagline: "Fresh for Everyone", cartUrl: "https://www.fredmeyer.com/cart" },
  "king soopers": { displayName: "King Soopers", tagline: "Fresh for Everyone", cartUrl: "https://www.kingsoopers.com/cart" },
  "fry's": { displayName: "Fry's", tagline: "Fresh for Everyone", cartUrl: "https://www.frysfood.com/cart" },
  "frys": { displayName: "Fry's", tagline: "Fresh for Everyone", cartUrl: "https://www.frysfood.com/cart" },
  "dillons": { displayName: "Dillons", tagline: "Fresh for Everyone", cartUrl: "https://www.dillons.com/cart" },
  "qfc": { displayName: "QFC", tagline: "Quality Food Centers", cartUrl: "https://www.qfc.com/cart" },
  "harris teeter": { displayName: "Harris Teeter", tagline: "Fresh for Everyone", cartUrl: "https://www.harristeeter.com/cart" },
  "pick 'n save": { displayName: "Pick 'n Save", tagline: "Fresh for Everyone", cartUrl: "https://www.picknsave.com/cart" },
  "metro market": { displayName: "Metro Market", tagline: "Fresh for Everyone", cartUrl: "https://www.metromarket.net/cart" },
  "mariano's": { displayName: "Mariano's", tagline: "Fresh for Everyone", cartUrl: "https://www.marianos.com/cart" },
  "marianos": { displayName: "Mariano's", tagline: "Fresh for Everyone", cartUrl: "https://www.marianos.com/cart" },
  "food 4 less": { displayName: "Food 4 Less", tagline: "Why Pay More?", cartUrl: "https://www.food4less.com/cart" },
  "foods co": { displayName: "Foods Co", tagline: "Fresh for Everyone", cartUrl: "https://www.foodsco.net/cart" },
  "gerbes": { displayName: "Gerbes", tagline: "Fresh for Everyone", cartUrl: "https://www.gerbes.com/cart" },
  "jay c": { displayName: "Jay C", tagline: "Fresh for Everyone", cartUrl: "https://www.jaycfoods.com/cart" },
  "city market": { displayName: "City Market", tagline: "Fresh for Everyone", cartUrl: "https://www.citymarket.com/cart" },
  "pay less": { displayName: "Pay Less", tagline: "Fresh for Everyone", cartUrl: "https://www.pay-less.com/cart" },
  "owen's": { displayName: "Owen's", tagline: "Fresh for Everyone", cartUrl: "https://www.owensmarket.com/cart" },
  "owens": { displayName: "Owen's", tagline: "Fresh for Everyone", cartUrl: "https://www.owensmarket.com/cart" },
  "baker's": { displayName: "Baker's", tagline: "Fresh for Everyone", cartUrl: "https://www.bakersplus.com/cart" },
  "bakers": { displayName: "Baker's", tagline: "Fresh for Everyone", cartUrl: "https://www.bakersplus.com/cart" },
};

/**
 * Extract the store brand from a Kroger location name.
 * E.g., "Smith's Food & Drug" -> { displayName: "Smith's", tagline: "Fresh for Everyone", cartUrl: "..." }
 */
export function getStoreBrand(locationName: string): StoreBrandInfo {
  const lowerName = locationName.toLowerCase();

  // Check for each known brand
  for (const [key, value] of Object.entries(KROGER_STORE_BRANDS)) {
    if (lowerName.includes(key)) {
      return value;
    }
  }

  // Default to generic Kroger family branding
  return { displayName: "Kroger", tagline: "Kroger Family of Stores", cartUrl: "https://www.kroger.com/cart" };
}

// ============================================
// Quantity Parsing & Calculation Utilities
// ============================================

export type ParsedQuantity = {
  amount: number;
  unit: string;
  raw: string;
};

// Unit conversion to base units (ounces for weight, count for items)
const WEIGHT_TO_OZ: Record<string, number> = {
  "oz": 1,
  "ounce": 1,
  "ounces": 1,
  "lb": 16,
  "lbs": 16,
  "pound": 16,
  "pounds": 16,
  "g": 0.035274,
  "gram": 0.035274,
  "grams": 0.035274,
  "kg": 35.274,
  "kilogram": 35.274,
  "kilograms": 35.274,
};

const VOLUME_TO_FLOZ: Record<string, number> = {
  "fl oz": 1,
  "floz": 1,
  "fluid ounce": 1,
  "fluid ounces": 1,
  "cup": 8,
  "cups": 8,
  "pint": 16,
  "pints": 16,
  "pt": 16,
  "quart": 32,
  "quarts": 32,
  "qt": 32,
  "gallon": 128,
  "gallons": 128,
  "gal": 128,
  "ml": 0.033814,
  "milliliter": 0.033814,
  "milliliters": 0.033814,
  "l": 33.814,
  "liter": 33.814,
  "liters": 33.814,
  "tbsp": 0.5,
  "tablespoon": 0.5,
  "tablespoons": 0.5,
  "tsp": 0.166667,
  "teaspoon": 0.166667,
  "teaspoons": 0.166667,
};

// Count-based units (eggs, pieces, etc.)
const COUNT_UNITS = new Set([
  "egg", "eggs",
  "piece", "pieces", "pc", "pcs",
  "slice", "slices",
  "clove", "cloves",
  "head", "heads",
  "bunch", "bunches",
  "stalk", "stalks",
  "rib", "ribs",
  "can", "cans",
  "jar", "jars",
  "bottle", "bottles",
  "bag", "bags",
  "package", "packages", "pkg",
  "box", "boxes",
  "dozen", "doz",
  "each",
  "", // no unit = count
]);

/**
 * Parse a quantity string like "2 lbs", "12 oz", "6 eggs" into structured data
 */
export function parseQuantity(quantityStr: string): ParsedQuantity | null {
  if (!quantityStr) return null;

  const raw = quantityStr.trim().toLowerCase();

  // Handle fractions like "1/2", "1 1/2"
  let normalized = raw
    .replace(/½/g, "0.5")
    .replace(/¼/g, "0.25")
    .replace(/¾/g, "0.75")
    .replace(/⅓/g, "0.333")
    .replace(/⅔/g, "0.667");

  // Match patterns like "2 lbs", "1.5 lb", "1 1/2 cups", "6 eggs"
  // Pattern: optional number (with decimals/fractions), optional space, optional unit
  const match = normalized.match(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)?\s*(.*)$/);

  if (!match) return null;

  let amount = 1;
  let unit = "";

  if (match[1]) {
    // Handle mixed fractions like "1 1/2"
    const parts = match[1].trim().split(/\s+/);
    if (parts.length === 2 && parts[1].includes("/")) {
      const [num, denom] = parts[1].split("/").map(Number);
      amount = Number(parts[0]) + (num / denom);
    } else if (parts[0].includes("/")) {
      const [num, denom] = parts[0].split("/").map(Number);
      amount = num / denom;
    } else {
      amount = Number(parts[0]);
    }
  }

  if (match[2]) {
    unit = match[2].trim();
  }

  return { amount, unit, raw };
}

/**
 * Parse a product size string from Kroger (e.g., "1 lb", "16 oz", "12 ct")
 */
export function parseProductSize(sizeStr: string | undefined): ParsedQuantity | null {
  if (!sizeStr) return null;

  // Kroger often uses formats like "1 lb", "16 oz", "12 ct", "1 gal"
  return parseQuantity(sizeStr);
}

/**
 * Convert a parsed quantity to a base unit for comparison
 * Returns { value, type } where type is "weight_oz", "volume_floz", or "count"
 */
export function toBaseUnit(parsed: ParsedQuantity): { value: number; type: "weight_oz" | "volume_floz" | "count" } | null {
  const unit = parsed.unit.toLowerCase().trim();

  // Check weight units
  if (WEIGHT_TO_OZ[unit]) {
    return { value: parsed.amount * WEIGHT_TO_OZ[unit], type: "weight_oz" };
  }

  // Check volume units
  if (VOLUME_TO_FLOZ[unit]) {
    return { value: parsed.amount * VOLUME_TO_FLOZ[unit], type: "volume_floz" };
  }

  // Check count units
  if (COUNT_UNITS.has(unit)) {
    // Special case: dozen = 12
    if (unit === "dozen" || unit === "doz") {
      return { value: parsed.amount * 12, type: "count" };
    }
    return { value: parsed.amount, type: "count" };
  }

  // Unknown unit - default to count
  return { value: parsed.amount, type: "count" };
}

export type CalculatedQuantity = {
  unitsNeeded: number;
  recipeAmount: string;
  productSize: string;
  calculation: string;
  soldBy: "WEIGHT" | "UNIT";
};

/**
 * Calculate how many units of a product are needed to satisfy a recipe quantity
 *
 * @param recipeQuantity - The quantity string from the recipe (e.g., "2 lbs")
 * @param productSize - The size string from Kroger product (e.g., "1 lb")
 * @param soldBy - How the product is sold ("WEIGHT" or "UNIT")
 * @param itemCount - How many times this ingredient appears across meals (default 1)
 * @returns The number of units to add to cart
 */
export function calculateUnitsNeeded(
  recipeQuantity: string,
  productSize: string | undefined,
  soldBy: "WEIGHT" | "UNIT" | undefined,
  itemCount: number = 1
): CalculatedQuantity {
  const defaultResult: CalculatedQuantity = {
    unitsNeeded: itemCount,
    recipeAmount: recipeQuantity,
    productSize: productSize || "unknown",
    calculation: "default (1 unit per recipe)",
    soldBy: soldBy || "UNIT",
  };

  // Parse recipe quantity
  const recipeParsed = parseQuantity(recipeQuantity);
  if (!recipeParsed) {
    return defaultResult;
  }

  // For WEIGHT-based products (deli counter items), quantity IS the weight
  if (soldBy === "WEIGHT") {
    // Convert recipe to base unit (oz)
    const recipeBase = toBaseUnit(recipeParsed);
    if (recipeBase && recipeBase.type === "weight_oz") {
      // Convert oz to lbs for the API (Kroger uses lbs for weight-based items)
      const lbsNeeded = (recipeBase.value / 16) * itemCount;
      return {
        unitsNeeded: Math.ceil(lbsNeeded * 10) / 10, // Round to 1 decimal
        recipeAmount: recipeQuantity,
        productSize: "sold by weight",
        calculation: `${recipeQuantity} × ${itemCount} = ${lbsNeeded.toFixed(1)} lbs`,
        soldBy: "WEIGHT",
      };
    }
    // If we can't parse as weight, default to 1 unit
    // (raw amount without a weight unit isn't meaningful for Kroger's weight-based API)
    return {
      unitsNeeded: itemCount,
      recipeAmount: recipeQuantity,
      productSize: "sold by weight",
      calculation: `default (1 unit, could not parse "${recipeQuantity}" as weight)`,
      soldBy: "WEIGHT",
    };
  }

  // For UNIT-based products, calculate how many packages needed
  const productParsed = parseProductSize(productSize);
  if (!productParsed) {
    // Can't parse product size - default to item count
    return defaultResult;
  }

  const recipeBase = toBaseUnit(recipeParsed);
  const productBase = toBaseUnit(productParsed);

  if (!recipeBase || !productBase) {
    return defaultResult;
  }

  // Check if units are compatible
  if (recipeBase.type !== productBase.type) {
    // Incompatible units (e.g., recipe is "2 cups" but product is "1 lb")
    // This happens - just use 1 unit per recipe occurrence
    return {
      unitsNeeded: itemCount,
      recipeAmount: recipeQuantity,
      productSize: productSize || "unknown",
      calculation: `incompatible units: ${recipeParsed.unit} vs ${productParsed.unit}`,
      soldBy: "UNIT",
    };
  }

  // Calculate units needed
  const totalNeeded = recipeBase.value * itemCount;
  const unitsNeeded = Math.ceil(totalNeeded / productBase.value);

  return {
    unitsNeeded: Math.max(1, unitsNeeded), // At least 1 unit
    recipeAmount: recipeQuantity,
    productSize: productSize || "unknown",
    calculation: `${recipeQuantity} × ${itemCount} = ${totalNeeded.toFixed(2)} ${recipeBase.type.replace("_", " ")} / ${productSize} = ${unitsNeeded} units`,
    soldBy: "UNIT",
  };
}