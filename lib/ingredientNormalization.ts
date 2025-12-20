// lib/ingredientNormalization.ts

/**
 * Normalize ingredient name to snake_case key for consistent preference tracking.
 * Examples:
 *   "Chicken Breast" -> "chicken_breast"
 *   "Extra Virgin Olive Oil" -> "olive_oil"
 *   "Fresh Baby Spinach" -> "baby_spinach"
 *   "2 cups Flour" -> "flour"
 */
export function normalizeIngredientKey(ingredientName: string): string {
  return ingredientName
    .toLowerCase()
    .trim()
    // Remove quantity prefixes (numbers, fractions, units)
    .replace(
      /^[\d./\s]*(cup|cups|tbsp|tsp|oz|lb|lbs|pound|pounds|gram|grams|g|kg|ml|l|quart|pint|gallon|can|cans|clove|cloves|bunch|bunches|piece|pieces|slice|slices|head|heads|stalk|stalks)\s*/gi,
      ""
    )
    // Remove leading numbers
    .replace(/^[\d./-]+\s*/, "")
    // Remove common modifiers
    .replace(
      /^(fresh|dried|ground|minced|chopped|diced|sliced|whole|organic|large|medium|small|extra|virgin|raw|cooked|frozen|canned|boneless|skinless|lean|low-fat|fat-free|unsalted|salted|plain|natural|pure)\s+/gi,
      ""
    )
    // Remove trailing descriptors after comma
    .replace(/,.*$/, "")
    // Remove parenthetical notes
    .replace(/\s*\([^)]*\)/g, "")
    // Replace spaces/hyphens with underscores
    .replace(/[\s-]+/g, "_")
    // Remove non-alphanumeric except underscores
    .replace(/[^a-z0-9_]/g, "")
    // Collapse multiple underscores
    .replace(/_+/g, "_")
    // Remove leading/trailing underscores
    .replace(/^_|_$/g, "");
}

/**
 * Generate a stable fingerprint for a meal based on key characteristics.
 * Used to identify similar meals across different generations.
 */
export function generateMealFingerprint(meal: {
  ingredients: { name: string }[];
  mealType: string;
}): string {
  const sortedIngredients = meal.ingredients
    .map((i) => normalizeIngredientKey(i.name))
    .filter((key) => key.length > 0)
    .sort()
    .join(",");

  // Simple hash combining ingredients and meal type
  const combined = `${meal.mealType}:${sortedIngredients}`;

  // Create a simple hash
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Extract tags from a meal for preference tracking.
 */
export function extractMealTags(meal: {
  name: string;
  description: string;
  mealType: string;
  cookTimeRange?: { min: number; max: number };
}): string[] {
  const tags: string[] = [];

  // Time-based tags
  if (meal.cookTimeRange) {
    if (meal.cookTimeRange.max <= 20) tags.push("quick");
    else if (meal.cookTimeRange.max <= 35) tags.push("moderate_time");
    else if (meal.cookTimeRange.max >= 60) tags.push("slow_cook");
  }

  // Meal type as tag
  tags.push(meal.mealType);

  // Detect cuisine from name/description
  const text = `${meal.name} ${meal.description}`.toLowerCase();

  const cuisines = [
    "italian",
    "mexican",
    "asian",
    "indian",
    "mediterranean",
    "american",
    "thai",
    "chinese",
    "japanese",
    "korean",
    "greek",
    "french",
    "spanish",
    "vietnamese",
    "middle_eastern",
  ];
  cuisines.forEach((c) => {
    if (text.includes(c.replace("_", " ")) || text.includes(c)) tags.push(c);
  });

  // Detect cooking methods
  const methods = [
    "grilled",
    "baked",
    "fried",
    "steamed",
    "roasted",
    "sauteed",
    "slow_cooked",
    "stir_fry",
    "air_fryer",
    "instant_pot",
    "one_pot",
    "sheet_pan",
  ];
  methods.forEach((m) => {
    if (text.includes(m.replace("_", " ")) || text.includes(m)) tags.push(m);
  });

  // Detect dietary styles
  const styles = [
    "high_protein",
    "low_carb",
    "keto",
    "vegan",
    "vegetarian",
    "gluten_free",
    "dairy_free",
    "meal_prep",
    "budget",
    "healthy",
    "comfort",
    "spicy",
  ];
  styles.forEach((s) => {
    if (text.includes(s.replace("_", " ")) || text.includes(s)) tags.push(s);
  });

  return [...new Set(tags)];
}

/**
 * Get the current context for event logging based on time of day.
 */
export function getCurrentContext(): {
  mealTime: "breakfast" | "lunch" | "dinner" | "snack";
  dayType: "weekday" | "weekend";
} {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  let mealTime: "breakfast" | "lunch" | "dinner" | "snack";
  if (hour >= 5 && hour < 11) mealTime = "breakfast";
  else if (hour >= 11 && hour < 15) mealTime = "lunch";
  else if (hour >= 17 && hour < 21) mealTime = "dinner";
  else mealTime = "snack";

  const dayType = day === 0 || day === 6 ? "weekend" : "weekday";

  return { mealTime, dayType };
}

/**
 * Build a context key string for context-specific scoring.
 * Format: "mealTime|dayType|audience"
 */
export function buildContextKey(context: {
  mealTime?: string;
  dayType?: string;
  audience?: string;
}): string {
  const parts = [
    context.mealTime || "any",
    context.dayType || "any",
    context.audience || "any",
  ];
  return parts.join("|");
}
