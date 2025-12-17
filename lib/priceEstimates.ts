/**
 * Simple price estimation for ingredients when Kroger data isn't available
 * These are rough US grocery store averages as of 2024
 */

type IngredientCategory =
    | 'protein'
    | 'seafood'
    | 'dairy'
    | 'produce_weight'
    | 'produce_unit'
    | 'grains'
    | 'pantry'
    | 'spices'
    | 'oils'
    | 'eggs'
    | 'deli'
    | 'default';

// Average prices per category (in USD)
// soldByWeight indicates if the price is per pound
const CATEGORY_PRICES: Record<IngredientCategory, { min: number; max: number; soldByWeight: boolean }> = {
    protein: { min: 4.99, max: 9.99, soldByWeight: true },       // chicken, beef, pork (per lb)
    seafood: { min: 7.99, max: 14.99, soldByWeight: true },      // fish, shrimp, salmon (per lb)
    deli: { min: 6.99, max: 12.99, soldByWeight: true },         // deli meats, cheeses (per lb)
    dairy: { min: 2.99, max: 5.99, soldByWeight: false },        // milk, cheese, yogurt
    produce_weight: { min: 1.49, max: 3.99, soldByWeight: true }, // fruits, veggies sold by weight (per lb)
    produce_unit: { min: 0.99, max: 2.99, soldByWeight: false },  // fruits, veggies sold by unit
    grains: { min: 1.99, max: 4.99, soldByWeight: false },       // bread, rice, pasta
    pantry: { min: 2.49, max: 5.99, soldByWeight: false },       // canned goods, sauces
    spices: { min: 2.99, max: 6.99, soldByWeight: false },       // herbs, spices, seasonings
    oils: { min: 4.99, max: 9.99, soldByWeight: false },         // olive oil, cooking oils
    eggs: { min: 3.49, max: 5.99, soldByWeight: false },         // eggs
    default: { min: 2.99, max: 5.99, soldByWeight: false },      // fallback
};

// Keywords to categorize ingredients
const CATEGORY_KEYWORDS: Record<IngredientCategory, string[]> = {
    protein: [
        'chicken', 'beef', 'pork', 'turkey', 'steak', 'ground beef', 'ground turkey',
        'ground pork', 'ground chicken', 'lamb', 'veal', 'brisket', 'roast',
        'chicken breast', 'chicken thigh', 'pork chop', 'pork loin', 'ribeye',
        'sirloin', 'tenderloin', 'chuck', 'flank'
    ],
    seafood: [
        'fish', 'salmon', 'tuna', 'shrimp', 'cod', 'tilapia', 'crab', 'lobster',
        'scallop', 'halibut', 'mahi', 'trout', 'bass', 'snapper', 'swordfish',
        'catfish', 'prawns', 'clam', 'mussel', 'oyster', 'calamari', 'squid'
    ],
    deli: [
        'ham', 'bacon', 'sausage', 'prosciutto', 'chorizo', 'salami', 'pepperoni',
        'deli turkey', 'deli chicken', 'roast beef', 'pastrami', 'bologna',
        'hot dog', 'bratwurst', 'kielbasa', 'andouille'
    ],
    dairy: [
        'milk', 'cheese', 'yogurt', 'cream', 'butter', 'sour cream', 'cottage',
        'ricotta', 'mozzarella', 'cheddar', 'parmesan', 'feta', 'brie', 'gouda',
        'cream cheese', 'half and half', 'whipping cream', 'greek yogurt',
        'tofu', 'tempeh'
    ],
    produce_weight: [
        'apple', 'banana', 'orange', 'grape', 'peach', 'pear', 'plum', 'nectarine',
        'cherry', 'strawberry', 'blueberry', 'raspberry', 'blackberry', 'mango',
        'pineapple', 'watermelon', 'cantaloupe', 'honeydew', 'kiwi', 'papaya',
        'tomato', 'potato', 'sweet potato', 'onion', 'carrot', 'zucchini', 'squash',
        'eggplant', 'cucumber', 'bell pepper', 'mushroom', 'green bean'
    ],
    produce_unit: [
        'lettuce', 'cabbage', 'broccoli', 'cauliflower', 'celery', 'asparagus',
        'spinach', 'kale', 'arugula', 'romaine', 'avocado', 'lemon', 'lime',
        'garlic', 'ginger', 'jalapeño', 'scallion', 'green onion', 'shallot',
        'leek', 'cilantro', 'parsley', 'basil', 'mint', 'dill', 'rosemary', 'thyme',
        'corn', 'artichoke', 'fennel'
    ],
    grains: [
        'bread', 'rice', 'pasta', 'noodle', 'tortilla', 'flour', 'oat', 'cereal',
        'quinoa', 'couscous', 'barley', 'farro', 'bulgur', 'pita', 'bagel',
        'cracker', 'breadcrumb', 'panko'
    ],
    pantry: [
        'can', 'canned', 'sauce', 'broth', 'stock', 'tomato paste', 'beans',
        'chickpea', 'lentil', 'coconut milk', 'soy sauce', 'vinegar', 'mustard',
        'ketchup', 'mayo', 'mayonnaise', 'honey', 'maple syrup', 'sugar', 'jam',
        'peanut butter', 'almond butter', 'salsa', 'hot sauce', 'worcestershire'
    ],
    spices: [
        'salt', 'pepper', 'cumin', 'paprika', 'oregano', 'cinnamon', 'nutmeg',
        'cayenne', 'chili powder', 'curry', 'turmeric', 'coriander', 'bay leaf',
        'sage', 'italian seasoning', 'garlic powder', 'onion powder',
        'red pepper flakes', 'vanilla', 'allspice', 'cardamom', 'clove'
    ],
    oils: [
        'olive oil', 'vegetable oil', 'canola oil', 'coconut oil', 'sesame oil',
        'avocado oil', 'cooking spray', 'oil'
    ],
    eggs: [
        'egg', 'eggs'
    ],
    default: [],
};

function categorizeIngredient(name: string): IngredientCategory {
    const lowerName = name.toLowerCase();

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [IngredientCategory, string[]][]) {
        if (category === 'default') continue;
        for (const keyword of keywords) {
            if (lowerName.includes(keyword)) {
                return category;
            }
        }
    }

    return 'default';
}

export type PriceEstimate = {
    min: number;
    max: number;
    soldByWeight: boolean;
};

export function getEstimatedPrice(ingredientName: string): PriceEstimate {
    const category = categorizeIngredient(ingredientName);
    return CATEGORY_PRICES[category];
}

export function formatPriceRange(estimate: PriceEstimate): string {
    const suffix = estimate.soldByWeight ? '/lb' : '';
    return `$${estimate.min.toFixed(2)} - $${estimate.max.toFixed(2)}${suffix}`;
}
