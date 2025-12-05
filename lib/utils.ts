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
export const KROGER_STORE_BRANDS: Record<string, { displayName: string; tagline: string }> = {
  "kroger": { displayName: "Kroger", tagline: "Fresh for Everyone" },
  "smith's": { displayName: "Smith's", tagline: "Fresh for Everyone" },
  "smiths": { displayName: "Smith's", tagline: "Fresh for Everyone" },
  "ralphs": { displayName: "Ralphs", tagline: "Fresh for Everyone" },
  "fred meyer": { displayName: "Fred Meyer", tagline: "Fresh for Everyone" },
  "king soopers": { displayName: "King Soopers", tagline: "Fresh for Everyone" },
  "fry's": { displayName: "Fry's", tagline: "Fresh for Everyone" },
  "frys": { displayName: "Fry's", tagline: "Fresh for Everyone" },
  "dillons": { displayName: "Dillons", tagline: "Fresh for Everyone" },
  "qfc": { displayName: "QFC", tagline: "Quality Food Centers" },
  "harris teeter": { displayName: "Harris Teeter", tagline: "Fresh for Everyone" },
  "pick 'n save": { displayName: "Pick 'n Save", tagline: "Fresh for Everyone" },
  "metro market": { displayName: "Metro Market", tagline: "Fresh for Everyone" },
  "mariano's": { displayName: "Mariano's", tagline: "Fresh for Everyone" },
  "marianos": { displayName: "Mariano's", tagline: "Fresh for Everyone" },
  "food 4 less": { displayName: "Food 4 Less", tagline: "Why Pay More?" },
  "foods co": { displayName: "Foods Co", tagline: "Fresh for Everyone" },
  "gerbes": { displayName: "Gerbes", tagline: "Fresh for Everyone" },
  "jay c": { displayName: "Jay C", tagline: "Fresh for Everyone" },
  "city market": { displayName: "City Market", tagline: "Fresh for Everyone" },
  "pay less": { displayName: "Pay Less", tagline: "Fresh for Everyone" },
  "owen's": { displayName: "Owen's", tagline: "Fresh for Everyone" },
  "owens": { displayName: "Owen's", tagline: "Fresh for Everyone" },
  "baker's": { displayName: "Baker's", tagline: "Fresh for Everyone" },
  "bakers": { displayName: "Baker's", tagline: "Fresh for Everyone" },
};

/**
 * Extract the store brand from a Kroger location name.
 * E.g., "Smith's Food & Drug" -> { displayName: "Smith's", tagline: "Fresh for Everyone" }
 */
export function getStoreBrand(locationName: string): { displayName: string; tagline: string } {
  const lowerName = locationName.toLowerCase();

  // Check for each known brand
  for (const [key, value] of Object.entries(KROGER_STORE_BRANDS)) {
    if (lowerName.includes(key)) {
      return value;
    }
  }

  // Default to generic Kroger family branding
  return { displayName: "Kroger", tagline: "Kroger Family of Stores" };
}