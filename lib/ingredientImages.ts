/**
 * Utility for generating ingredient images from Spoonacular CDN
 */

// Common ingredient aliases (map to Spoonacular CDN names)
const INGREDIENT_ALIASES: Record<string, string> = {
  // Dairy & Yogurt
  'plain greek yogurt': 'plain-yogurt',
  'greek yogurt': 'plain-yogurt',
  'plain yogurt': 'plain-yogurt',
  'vanilla yogurt': 'plain-yogurt',
  'yogurt': 'plain-yogurt',
  // Broths & Stocks
  'chicken broth': 'broth',
  'chicken stock': 'broth',
  'beef broth': 'broth',
  'beef stock': 'broth',
  'vegetable broth': 'broth',
  'vegetable stock': 'broth',
  'broth': 'broth',
  // Seasonings & Spices
  'italian seasoning': 'oregano',
  'italian herbs': 'oregano',
  'herbs de provence': 'herbs-de-provence',
  'cajun seasoning': 'cajun-seasoning',
  'taco seasoning': 'taco-seasoning',
  'chili powder': 'chili-powder',
  'paprika': 'paprika',
  'smoked paprika': 'paprika',
  'cumin': 'cumin',
  'ground cumin': 'cumin',
  'oregano': 'oregano',
  'dried oregano': 'oregano',
  'basil': 'basil',
  'dried basil': 'basil',
  'thyme': 'thyme',
  'dried thyme': 'thyme',
  'rosemary': 'rosemary',
  'dried rosemary': 'rosemary',
  'bay leaves': 'bay-leaves',
  'bay leaf': 'bay-leaves',
  'cinnamon': 'cinnamon',
  'ground cinnamon': 'cinnamon',
  'nutmeg': 'nutmeg',
  'ground nutmeg': 'nutmeg',
  'ginger': 'ginger',
  'ground ginger': 'ginger',
  'fresh ginger': 'ginger',
  // Onions & Alliums
  'onion': 'brown-onion',
  'yellow onion': 'brown-onion',
  'white onion': 'brown-onion',
  'red onion': 'red-onion',
  'sweet onion': 'brown-onion',
  'vidalia onion': 'brown-onion',
  'shallot': 'shallots',
  'shallots': 'shallots',
  'leek': 'leek',
  'leeks': 'leek',
  'green onions': 'spring-onions',
  'green onion': 'spring-onions',
  'scallions': 'spring-onions',
  'scallion': 'spring-onions',
  'garlic cloves': 'garlic',
  'garlic clove': 'garlic',
  'cloves garlic': 'garlic',
  'clove garlic': 'garlic',
  'minced garlic': 'garlic',
  'chives': 'fresh-chives',
  'fresh chives': 'fresh-chives',
  // Bell Peppers
  'bell pepper': 'bell-pepper-orange',
  'red bell pepper': 'bell-pepper-orange',
  'green bell pepper': 'bell-pepper-orange',
  'yellow bell pepper': 'bell-pepper-orange',
  'orange bell pepper': 'bell-pepper-orange',
  'carrot': 'carrots',
  'carrots': 'carrots',
  'broccoli florets': 'broccoli',
  'broccoli floret': 'broccoli',
  'chicken breast': 'chicken-breasts',
  'chicken breasts': 'chicken-breasts',
  'chicken thighs': 'chicken-thigh',
  'chicken thigh': 'chicken-thigh',
  'olive oil': 'olive-oil',
  'vegetable oil': 'vegetable-oil',
  'soy sauce': 'soy-sauce',
  'sriracha': 'hot-sauce-or-tabasco',
  'siracha': 'hot-sauce-or-tabasco',
  'sriracha sauce': 'hot-sauce-or-tabasco',
  'hot sauce': 'hot-sauce-or-tabasco',
  'tabasco': 'hot-sauce-or-tabasco',
  'tabasco sauce': 'hot-sauce-or-tabasco',
  'cholula': 'hot-sauce-or-tabasco',
  'tapatio': 'hot-sauce-or-tabasco',
  'franks red hot': 'hot-sauce-or-tabasco',
  'franks redhot': 'hot-sauce-or-tabasco',
  'buffalo sauce': 'hot-sauce-or-tabasco',
  'chili sauce': 'hot-sauce-or-tabasco',
  'louisiana hot sauce': 'hot-sauce-or-tabasco',
  'crystal hot sauce': 'hot-sauce-or-tabasco',
  'valentina': 'hot-sauce-or-tabasco',
  'heavy cream': 'fluid-cream',
  'whipping cream': 'fluid-cream',
  'cream cheese': 'cream-cheese',
  'sour cream': 'sour-cream',
  'all-purpose flour': 'flour',
  'all purpose flour': 'flour',
  'ap flour': 'flour',
  'brown sugar': 'dark-brown-sugar',
  'powdered sugar': 'powdered-sugar',
  'confectioners sugar': 'powdered-sugar',
  'black pepper': 'pepper',
  'ground black pepper': 'pepper',
  'kosher salt': 'salt',
  'sea salt': 'salt',
  'table salt': 'salt',
  'lime juice': 'lime-juice',
  'lemon juice': 'lemon-juice',
  'lemon zest': 'lemon',
  'orange juice': 'orange-juice',
  'parmesan cheese': 'parmesan',
  'parmigiano reggiano': 'parmesan',
  'mozzarella cheese': 'mozzarella',
  'cheddar cheese': 'cheddar',
  'cherry tomatoes': 'cherry-tomatoes',
  'grape tomatoes': 'cherry-tomatoes',
  'roma tomatoes': 'tomatoes',
  'plum tomatoes': 'tomatoes',
  'whole grain wraps': 'flour-tortillas',
  'whole wheat wraps': 'flour-tortillas',
  'wraps': 'flour-tortillas',
  'tortillas': 'flour-tortillas',
  'flour tortillas': 'flour-tortillas',
  'mixed salad greens': 'spinach',
  'salad greens': 'spinach',
  'mixed greens': 'spinach',
  'salmon fillets': 'salmon',
  'salmon fillet': 'salmon',
  'ground beef': 'fresh-ground-beef',
  'ground turkey': 'turkey-breast',
  'lean ground turkey': 'turkey-breast',
  'ground chicken': 'chicken-breasts',
  'lean ground chicken': 'chicken-breasts',
  'ground pork': 'pork-sausage',
  'bacon': 'raw-bacon',
  'eggs': 'egg',
  'egg': 'egg',
  'butter': 'butter-sliced',
  'rice': 'uncooked-white-rice',
  'white rice': 'uncooked-white-rice',
  'brown rice': 'rice-brown-background',
  'pasta': 'penne',
  'spaghetti': 'spaghetti',
  'penne': 'penne',
  'linguine': 'linguine',
  'fettuccine': 'fettuccine',
  'rigatoni': 'rigatoni',
  'macaroni': 'elbow-macaroni',
  'elbow macaroni': 'elbow-macaroni',
  // Seafood
  'crab': 'crabmeat',
  'crab meat': 'crabmeat',
  'lump crab meat': 'crabmeat',
  'lobster': 'lobster-tails',
  'lobster tail': 'lobster-tails',
  'lobster tails': 'lobster-tails',
  'mayo': 'mayonnaise',
  'mayonnaise': 'mayonnaise',
  // Bread & Buns
  'hot dog buns': 'hot-dog-buns',
  'hot dog bun': 'hot-dog-buns',
  'hamburger buns': 'hamburger-bun',
  'hamburger bun': 'hamburger-bun',
};

// Prefixes/modifiers to remove
const REMOVE_PREFIXES = [
  'fresh', 'dried', 'frozen', 'canned', 'raw', 'cooked',
  'chopped', 'diced', 'minced', 'sliced', 'crushed', 'ground', 'grated', 'shredded',
  'whole', 'halved', 'quartered',
  'large', 'medium', 'small', 'extra-large',
  'boneless', 'skinless', 'bone-in', 'skin-on',
  'organic', 'low-sodium', 'low-fat', 'fat-free', 'unsalted', 'salted',
  'ripe', 'unripe', 'firm', 'soft',
  'hot', 'cold', 'warm', 'room temperature',
  'finely', 'roughly', 'thinly', 'thickly',
];

// Trailing unit words to remove
const TRAILING_UNITS = [
  'cloves', 'clove', 'stalks', 'stalk', 'heads', 'head',
  'bunches', 'bunch', 'sprigs', 'sprig', 'pieces', 'piece',
  'leaves', 'leaf', 'strips', 'strip', 'slices', 'slice',
  'florets', 'floret', 'wedges', 'wedge', 'cubes', 'cube',
];

/**
 * Normalize ingredient name for Spoonacular CDN
 */
export function normalizeIngredientName(name: string): string {
  let normalized = name.toLowerCase().trim();

  // Check for alias match first
  for (const [key, value] of Object.entries(INGREDIENT_ALIASES)) {
    if (normalized === key || normalized.includes(key)) {
      return value;
    }
  }

  // Remove common prefixes/modifiers
  for (const prefix of REMOVE_PREFIXES) {
    normalized = normalized.replace(new RegExp(`\\b${prefix}\\b`, 'g'), '');
  }

  // Remove trailing unit words (e.g., "garlic cloves" -> "garlic")
  for (const unit of TRAILING_UNITS) {
    normalized = normalized.replace(new RegExp(`\\s+${unit}$`, 'g'), '');
  }

  // Remove quantities at the start (e.g., "2 cups", "1/2 lb")
  normalized = normalized.replace(
    /^[\d\/\.\s]+(cups?|tbsp|tsp|oz|lb|g|kg|ml|l|cloves?|pieces?|cans?|bunche?s?|stalks?|heads?|sprigs?)\s*/i,
    ''
  );

  // Clean up
  normalized = normalized
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove multiple hyphens
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .trim();

  return normalized;
}

/**
 * Generate Spoonacular CDN URL for ingredient images
 */
export function getIngredientImageUrl(name: string, size: '100x100' | '250x250' | '500x500' = '250x250'): string {
  const normalized = normalizeIngredientName(name);
  return `https://img.spoonacular.com/ingredients_${size}/${normalized}.jpg`;
}
