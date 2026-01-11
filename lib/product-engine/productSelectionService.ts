/**
 * Product Selection Service - The "Selection Brain"
 *
 * This service orchestrates intelligent product selection by combining:
 * 1. Quality rules (prefer fresh, avoid processed)
 * 2. Ingredient-specific rules (e.g., chicken breast should be boneless/skinless)
 * 3. Category-level rules (e.g., all proteins should avoid breaded items)
 * 4. Basic filtering (pet food, non-food, availability)
 *
 * The service is designed to be the single source of truth for product selection logic,
 * keeping the Kroger API code clean and making selection logic testable.
 */

import {
  CATEGORY_QUALITY_RULES,
  INGREDIENT_QUALITY_RULES,
  findIngredientRule,
  getCategoryRules,
  shouldAvoidProduct,
  getQualityBonus,
  getQualityPenalty,
  type CategoryType,
  type IngredientQualityRule,
} from "./ingredientQualityRules";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductCandidate {
  productId: string;
  description: string;
  brand?: string | null;
  categories?: string[];
  category?: string | null;
  department?: string | null;
  price?: number | null;
  stockLevel?: string | null;
  isInStock?: boolean | null;
  size?: string | null;
}

export interface SelectionResult {
  product: ProductCandidate;
  score: number;
  qualityScore: number;
  reasons: string[];
}

export interface SelectionOptions {
  ingredientName?: string;
  categoryHint?: CategoryType;
  excludeProductIds?: Set<string>;
  preferFresh?: boolean;
  debugLogging?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pet Food & Non-Food Filtering (moved from kroger.ts for centralization)
// ─────────────────────────────────────────────────────────────────────────────

const PET_FOOD_BRANDS = [
  "purina", "pedigree", "iams", "blue buffalo", "meow mix", "fancy feast",
  "friskies", "alpo", "beneful", "cesar", "nutro", "rachael ray nutrish",
  "wellness pet", "hill's science diet", "royal canin", "blue wilderness",
  "taste of the wild", "orijen", "acana", "merrick", "canidae", "fromm",
  "nutrisource", "diamond naturals", "earthborn", "zignature", "instinct",
];

const PET_FOOD_KEYWORDS = [
  "dog food", "cat food", "pet food", "dog treat", "cat treat", "pet treat",
  "kibble", "puppy food", "kitten food", "canine", "feline", "for dogs",
  "for cats", "for pets", "dog biscuit", "cat litter", "pet supplies",
];

const NON_FOOD_KEYWORDS = [
  // Oral care
  "toothpaste", "toothbrush", "mouthwash", "dental floss", "denture",
  // Personal care / beauty
  "shampoo", "conditioner", "body wash", "soap bar", "hand soap", "lotion",
  "deodorant", "antiperspirant", "razor", "shaving cream", "aftershave",
  "makeup", "mascara", "lipstick", "foundation", "concealer", "nail polish",
  "hair dye", "hair color", "styling gel", "hairspray", "mousse",
  "face wash", "cleanser", "moisturizer", "sunscreen", "tanning",
  "cotton balls", "cotton swabs", "q-tips",
  // Health / medicine
  "medicine", "aspirin", "ibuprofen", "acetaminophen", "tylenol", "advil",
  "allergy relief", "cold medicine", "cough syrup", "antacid", "laxative",
  "bandage", "band-aid", "first aid", "thermometer", "heating pad",
  "vitamin supplement", "multivitamin", "fiber supplement",
  // Baby (non-food)
  "diaper", "baby wipe", "baby powder", "baby lotion", "baby shampoo",
  // Cleaning products
  "dish soap", "dishwasher detergent", "laundry detergent", "fabric softener",
  "bleach", "all-purpose cleaner", "glass cleaner", "disinfectant", "lysol",
  "toilet cleaner", "drain cleaner", "oven cleaner", "carpet cleaner",
  "air freshener", "febreze", "sponge", "scrub brush", "mop", "broom",
  "trash bag", "garbage bag", "aluminum foil", "plastic wrap", "parchment",
  // Paper products
  "paper towel", "toilet paper", "tissue", "napkin", "paper plate", "paper cup",
  // Laundry
  "stain remover", "dryer sheet", "laundry pod",
  // Batteries / household
  "battery", "light bulb", "candle",
];

const NON_FOOD_CATEGORIES = [
  "pet", "dog", "cat", "health", "beauty", "personal care", "oral care",
  "household", "cleaning", "laundry", "paper products", "baby care",
  "pharmacy", "medicine", "first aid", "cosmetics", "hair care", "skin care",
];

const BABY_FOOD_KEYWORDS = [
  "baby food", "toddler", "pouch", "puree", "infant", "newborn",
  "crawler", "sitter", "squeezy", "spout", "pedialyte", "gerber",
  "beech-nut", "earth's best", "happy baby", "plum organics",
  "cereal for baby", "teether", "puffs", "melts", "lil' bits",
];

const BABY_FOOD_CATEGORIES = [
  "baby", "toddler", "diapers", "nursing", "feeding",
];

// ─────────────────────────────────────────────────────────────────────────────
// Core Filtering Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a product is pet food - these should NEVER be shown for human food searches.
 */
export function isPetFood(product: ProductCandidate): boolean {
  const desc = (product.description || "").toLowerCase();
  const brand = (product.brand || "").toLowerCase();

  // Check brand names
  if (PET_FOOD_BRANDS.some((b) => brand.includes(b) || desc.includes(b))) {
    return true;
  }

  // Check keywords
  if (PET_FOOD_KEYWORDS.some((keyword) => desc.includes(keyword))) {
    return true;
  }

  // Check categories
  const categories = getProductCategories(product);
  if (categories.some((c) => c.includes("pet") || c.includes("dog") || c.includes("cat"))) {
    return true;
  }

  return false;
}

/**
 * Check if a product is a non-food item (household, health, beauty, etc.)
 */
export function isNonFoodProduct(product: ProductCandidate): boolean {
  const desc = (product.description || "").toLowerCase();

  // Check non-food keywords
  if (NON_FOOD_KEYWORDS.some((keyword) => desc.includes(keyword))) {
    return true;
  }

  // Check categories
  const categories = getProductCategories(product);
  if (categories.some((c) => NON_FOOD_CATEGORIES.some((nf) => c.includes(nf)))) {
    return true;
  }

  return false;
}

/**
 * Check if a product is intended for babies/toddlers.
 */
export function isBabyFood(product: ProductCandidate): boolean {
  const desc = (product.description || "").toLowerCase();

  // Check keywords
  if (BABY_FOOD_KEYWORDS.some((keyword) => desc.includes(keyword))) {
    return true;
  }

  // Check categories
  const categories = getProductCategories(product);
  if (categories.some((c) => BABY_FOOD_CATEGORIES.some((bc) => c.includes(bc)))) {
    return true;
  }

  return false;
}

/**
 * Check if a product is available based on stock level.
 */
export function isProductAvailable(product: ProductCandidate): boolean {
  if (product.isInStock === false) {
    return false;
  }
  if (product.stockLevel === "TEMPORARILY_OUT_OF_STOCK") {
    return false;
  }
  return true;
}

/**
 * Helper to get all category strings from a product.
 */
function getProductCategories(product: ProductCandidate): string[] {
  const categories: string[] = [];

  if (product.categories && Array.isArray(product.categories)) {
    categories.push(...product.categories.map((c) => c.toLowerCase()));
  }
  if (product.category) {
    categories.push(product.category.toLowerCase());
  }
  if (product.department) {
    categories.push(product.department.toLowerCase());
  }

  return categories;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quality-Based Scoring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate the quality score for a product based on ingredient-specific and category rules.
 * This is separate from the basic search relevance score.
 */
export function calculateQualityScore(
  product: ProductCandidate,
  ingredientRule: IngredientQualityRule | null,
  categoryType?: CategoryType,
): { score: number; reasons: string[] } {
  const desc = (product.description || "").toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  // ─────────────────────────────────────────────────────────────────────────
  // Check for avoid keywords (heavy penalties)
  // ─────────────────────────────────────────────────────────────────────────
  if (shouldAvoidProduct(desc, ingredientRule, categoryType)) {
    score -= 50;
    reasons.push("Contains avoided keywords");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Check ingredient-specific avoid keywords (extra penalty)
  // ─────────────────────────────────────────────────────────────────────────
  if (ingredientRule) {
    for (const keyword of ingredientRule.avoidKeywords) {
      if (desc.includes(keyword.toLowerCase())) {
        score -= 20;
        reasons.push(`Avoid: "${keyword}"`);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Check for preferred attributes (bonuses)
  // ─────────────────────────────────────────────────────────────────────────
  const qualityBonus = getQualityBonus(desc, ingredientRule, categoryType);
  if (qualityBonus > 0) {
    score += qualityBonus;
    reasons.push(`Quality bonus: +${qualityBonus}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Check for ingredient-specific preferred attributes
  // ─────────────────────────────────────────────────────────────────────────
  if (ingredientRule?.preferAttributes) {
    for (const attr of ingredientRule.preferAttributes) {
      if (desc.includes(attr.toLowerCase())) {
        score += 8;
        reasons.push(`Prefer: "${attr}"`);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Fresh produce bonuses
  // ─────────────────────────────────────────────────────────────────────────
  const categories = getProductCategories(product);
  const freshProduceCategories = ["produce", "fruit", "vegetable", "fresh fruit", "fresh vegetable"];
  const isInFreshCategory = categories.some((c) =>
    freshProduceCategories.some((fp) => c.includes(fp)) && !c.includes("frozen")
  );

  if (isInFreshCategory) {
    score += 15;
    reasons.push("Fresh produce category");
  }

  // Bonus for "fresh" in description
  if (desc.includes("fresh") || desc.startsWith("fresh ")) {
    score += 10;
    reasons.push("Fresh indicator in name");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Processed food penalties
  // ─────────────────────────────────────────────────────────────────────────
  const processedIndicators = [
    "breaded", "battered", "fried", "crispy coating", "crunchy coating",
    "with sauce", "in sauce", "glazed", "candied", "sweetened",
    "flavored", "seasoned blend", "helper", "complete meal", "ready to eat",
    "nuggets", "sticks", "patties", "popcorn", "ravioli", "pasta", "tortellini",
    "dumpling", "potsticker", "wonton", "puree", "mashed", "whipped",
  ];

  for (const indicator of processedIndicators) {
    if (desc.includes(indicator)) {
      score -= 15;
      reasons.push(`Processed: "${indicator}"`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Frozen penalties (unless it's frozen produce which can be acceptable)
  // ─────────────────────────────────────────────────────────────────────────
  const frozenIndicators = ["frozen", "steamable", "steam-in-bag", "microwaveable"];
  const isFrozen = frozenIndicators.some((w) => desc.includes(w)) ||
    categories.some((c) => c.includes("frozen"));

  if (isFrozen && !isInFreshCategory) {
    score -= 12;
    reasons.push("Frozen product");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Raw/whole ingredient bonuses
  // ─────────────────────────────────────────────────────────────────────────
  const rawIndicators = ["bunch", "single", "each", "per lb", "- lb", "/lb", "whole", "raw"];
  if (rawIndicators.some((w) => desc.includes(w))) {
    score += 8;
    reasons.push("Raw/whole indicator");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stock level adjustments
  // ─────────────────────────────────────────────────────────────────────────
  if (product.stockLevel === "HIGH") {
    score += 3;
    reasons.push("High stock");
  } else if (product.stockLevel === "LOW") {
    score -= 2;
    reasons.push("Low stock");
  }

  return { score, reasons };
}

/**
 * Calculate basic search relevance score (how well product matches search term).
 */
export function calculateRelevanceScore(
  product: ProductCandidate,
  searchTerm: string,
): { score: number; reasons: string[] } {
  const desc = (product.description || "").toLowerCase();
  const term = searchTerm.toLowerCase().trim();
  const reasons: string[] = [];
  let score = 0;

  // Basic text match
  if (desc.includes(term)) {
    score += 5;
    reasons.push("Text match");
  }

  // Exact word match
  const wordRegex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
  if (wordRegex.test(desc)) {
    score += 3;
    reasons.push("Exact word match");
  }

  // Category relevance
  const categories = getProductCategories(product);
  const goodCategoryHints = ["meat", "seafood", "dairy", "cheese", "eggs", "pantry", "spices", "baking", "produce"];

  if (categories.some((c) => goodCategoryHints.some((g) => c.includes(g)))) {
    score += 4;
    reasons.push("Relevant category");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Category mismatch penalties (vegetables vs fruits, etc.)
  // ─────────────────────────────────────────────────────────────────────────
  const vegetableIndicators = ["vegetable", "vegetables", "veggie", "veggies"];
  const fruitIndicators = ["fruit", "fruits", "melon", "berry", "berries", "apple", "orange", "grape", "mango", "pineapple", "watermelon", "cantaloupe", "honeydew", "peach", "pear", "plum", "cherry", "kiwi", "papaya", "banana"];

  const searchingForVegetables = vegetableIndicators.some(v => term.includes(v));
  const searchingForFruits = fruitIndicators.some(f => term.includes(f) && !term.includes("vegetable"));

  // If searching for vegetables, heavily penalize fruit products
  if (searchingForVegetables) {
    const productIsFruit = fruitIndicators.some(f => desc.includes(f));
    if (productIsFruit) {
      score -= 50;
      reasons.push("Fruit product when searching for vegetables");
    }
  }

  // If searching for fruits, penalize vegetable products
  if (searchingForFruits) {
    const productIsVegetable = vegetableIndicators.some(v => desc.includes(v));
    if (productIsVegetable) {
      score -= 50;
      reasons.push("Vegetable product when searching for fruits");
    }
  }

  // Penalize beverages when not searching for beverages
  if (!term.includes("juice") && !term.includes("drink") && !term.includes("beverage")) {
    const beverageWords = [
      "soda", "soft drink", "pop", "cola", "energy drink", "sports drink",
      "sprite", "coke", "pepsi", "mountain dew", "lemonade", "beverage",
    ];
    if (beverageWords.some((w) => desc.includes(w))) {
      score -= 10;
      reasons.push("Beverage penalty");
    }
  }

  // Shorter descriptions often indicate simpler/raw products
  if (desc.length < 40) {
    score += 2;
    reasons.push("Short description");
  }

  return { score, reasons };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Selection Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filter products to only include valid food items that are available.
 */
export function filterValidProducts(
  products: ProductCandidate[],
  options: SelectionOptions = {},
): ProductCandidate[] {
  const excludeIds = options.excludeProductIds || new Set();

  // Fix #2: Hard-block produce when ingredient category is pantry
  const ingredientName = options.ingredientName;
  const ingredientRule = ingredientName ? findIngredientRule(ingredientName) : null;
  const isPantryIngredient = ingredientRule?.category === 'pantry';

  return products.filter((product) => {
    // Exclude specific product IDs
    if (excludeIds.has(product.productId)) {
      return false;
    }

    // Never show pet food
    if (isPetFood(product)) {
      return false;
    }

    // Never show non-food items
    if (isNonFoodProduct(product)) {
      return false;
    }

    // Never show baby food unless user is specifically looking for it (handled by caller logic usually, but here strict)
    // Note: If Ingredient Name contains "baby", we might allow it.
    const searchTerm = (options.ingredientName || "").toLowerCase();
    if (!searchTerm.includes("baby") && isBabyFood(product)) {
      return false;
    }

    // Only show available products
    if (!isProductAvailable(product)) {
      return false;
    }

    // Fix #2 Implementation
    if (isPantryIngredient) {
      const categories = getProductCategories(product);
      const isProduce = categories.some(c =>
        c.includes('produce') ||
        c.includes('fresh vegetables') ||
        c.includes('fresh fruit')
      );

      // If we want a pantry item (spice), forbid fresh produce
      if (isProduce) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Select the best product from a list of candidates based on quality and relevance.
 */
export function selectBestProduct(
  products: ProductCandidate[],
  searchTerm: string,
  options: SelectionOptions = {},
): SelectionResult | null {
  // First, filter to valid products
  const validProducts = filterValidProducts(products, options);

  if (validProducts.length === 0) {
    return null;
  }

  // Find ingredient-specific rule
  const ingredientName = options.ingredientName || searchTerm;
  const ingredientRule = findIngredientRule(ingredientName);
  const categoryType = options.categoryHint || ingredientRule?.category;

  // Score all products
  const scoredProducts: SelectionResult[] = validProducts.map((product) => {
    const qualityResult = calculateQualityScore(product, ingredientRule, categoryType);
    const relevanceResult = calculateRelevanceScore(product, searchTerm);

    // Combined score: quality is weighted more heavily
    const totalScore = (qualityResult.score * 1.5) + relevanceResult.score;

    return {
      product,
      score: totalScore,
      qualityScore: qualityResult.score,
      reasons: [...qualityResult.reasons, ...relevanceResult.reasons],
    };
  });

  // Sort by score (highest first)
  scoredProducts.sort((a, b) => b.score - a.score);

  // Debug logging if enabled
  if (options.debugLogging) {
    console.log("\n🧠 Product Selection Brain - Scoring Results");
    console.log("Search Term:", searchTerm);
    console.log("Ingredient Rule:", ingredientRule?.canonicalName || "None");
    console.log("Category:", categoryType || "None");
    console.log("\nTop 5 candidates:");
    scoredProducts.slice(0, 5).forEach((result, i) => {
      console.log(`  ${i + 1}. ${result.product.description}`);
      console.log(`     Score: ${result.score.toFixed(1)} (Quality: ${result.qualityScore})`);
      console.log(`     Reasons: ${result.reasons.join(", ")}`);
    });
    console.log("");
  }

  // Return the best product (or first if all have negative scores)
  const best = scoredProducts[0];

  // If best score is very negative, still return it but log warning
  if (best.score < -20 && options.debugLogging) {
    console.log("⚠️ Warning: Best product has low score:", best.score);
  }

  return best;
}

/**
 * Select multiple products from a list of candidates, sorted by quality.
 */
export function selectTopProducts(
  products: ProductCandidate[],
  searchTerm: string,
  limit: number = 5,
  options: SelectionOptions = {},
): SelectionResult[] {
  // First, filter to valid products
  const validProducts = filterValidProducts(products, options);

  if (validProducts.length === 0) {
    return [];
  }

  // Find ingredient-specific rule
  const ingredientName = options.ingredientName || searchTerm;
  const ingredientRule = findIngredientRule(ingredientName);
  const categoryType = options.categoryHint || ingredientRule?.category;

  // Score all products
  const scoredProducts: SelectionResult[] = validProducts.map((product) => {
    const qualityResult = calculateQualityScore(product, ingredientRule, categoryType);
    const relevanceResult = calculateRelevanceScore(product, searchTerm);

    const totalScore = (qualityResult.score * 1.5) + relevanceResult.score;

    return {
      product,
      score: totalScore,
      qualityScore: qualityResult.score,
      reasons: [...qualityResult.reasons, ...relevanceResult.reasons],
    };
  });

  // Sort by score and return top N
  scoredProducts.sort((a, b) => b.score - a.score);
  return scoredProducts.slice(0, limit);
}

/**
 * Check if a product passes quality standards for a given ingredient.
 * Returns true if the product is acceptable, false if it should be avoided.
 */
export function passesQualityCheck(
  product: ProductCandidate,
  ingredientName: string,
): { passes: boolean; reasons: string[] } {
  const ingredientRule = findIngredientRule(ingredientName);
  const categoryType = ingredientRule?.category;
  const desc = (product.description || "").toLowerCase();

  const reasons: string[] = [];

  // Check ingredient-specific avoid keywords
  if (ingredientRule) {
    for (const keyword of ingredientRule.avoidKeywords) {
      if (desc.includes(keyword.toLowerCase())) {
        reasons.push(`Contains "${keyword}" (avoid for ${ingredientRule.canonicalName})`);
      }
    }
  }

  // Check category-level avoid keywords
  if (categoryType && CATEGORY_QUALITY_RULES[categoryType]) {
    const categoryRules = CATEGORY_QUALITY_RULES[categoryType];
    if ("avoidKeywords" in categoryRules) {
      for (const keyword of categoryRules.avoidKeywords) {
        if (desc.includes(keyword.toLowerCase())) {
          reasons.push(`Contains "${keyword}" (avoid for ${categoryType} category)`);
        }
      }
    }
  }

  return {
    passes: reasons.length === 0,
    reasons,
  };
}

/**
 * Get quality recommendations for an ingredient.
 * Returns what to look for and what to avoid.
 */
export function getQualityRecommendations(ingredientName: string): {
  lookFor: string[];
  avoid: string[];
  notes?: string;
} {
  const rule = findIngredientRule(ingredientName);

  if (!rule) {
    return {
      lookFor: ["fresh", "whole", "plain"],
      avoid: ["processed", "breaded", "flavored"],
    };
  }

  return {
    lookFor: rule.preferAttributes || [],
    avoid: rule.avoidKeywords,
    notes: rule.notes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports for external use
// ─────────────────────────────────────────────────────────────────────────────

export {
  CATEGORY_QUALITY_RULES,
  INGREDIENT_QUALITY_RULES,
  findIngredientRule,
  getCategoryRules,
};
