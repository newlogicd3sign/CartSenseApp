/**
 * Ingredient Quality Rules
 *
 * These rules help select fresh, healthy versions of products
 * by preferring certain attributes and avoiding processed alternatives.
 */

// Category-level quality rules applied to all items in a category
export const CATEGORY_QUALITY_RULES = {
  protein: {
    preferAttributes: ["lean", "extra lean"],
    avoidKeywords: ["breaded", "battered", "fried", "nuggets", "sticks", "sausages", "patties", "popcorn"],
    maxSaturatedFatPer100g: 5,
    maxSugarPer100g: 3,
    maxSodiumPer100g: 600
  },
  dairy: {
    avoidKeywords: ["flavored", "sugar added", "sweetened", "dessert", "candy", "chocolate"],
    maxSugarPer100g: 8,
    maxSaturatedFatPer100g: 8
  },
  carb: {
    preferKeywords: ["whole grain", "100% whole wheat", "brown", "sprouted", "multigrain"],
    avoidKeywords: ["white bread", "donut", "cake", "frosted", "pastry", "sweet roll", "danish"],
    minFiberPer100g: 5,
    maxSugarPer100g: 10
  },
  produce: {
    preferKeywords: ["fresh", "organic", "whole"],
    avoidKeywords: ["in syrup", "candied", "sweetened", "with sauce", "cream sauce"],
    notes: "Fresh or frozen, no added sugar or sauces"
  },
  fats_oils: {
    preferKeywords: ["extra virgin", "cold pressed", "unrefined"],
    avoidKeywords: ["hydrogenated", "shortening", "palm oil blend", "margarine"],
    maxSaturatedFatPercent: 30
  },
  snacks: {
    preferKeywords: ["unsalted", "lightly salted", "no sugar added", "raw", "dry roasted"],
    avoidKeywords: ["candy", "chocolate coated", "frosted", "deep fried", "honey roasted", "glazed"],
    maxSugarPerServing: 10,
    maxSodiumPerServing: 250
  },
  beans: {
    preferKeywords: ["no salt added", "low sodium", "dried", "organic"],
    avoidKeywords: ["baked beans", "with pork", "with bacon", "bbq", "brown sugar"],
    maxSodiumPerServing: 300
  },
  fruits: {
    preferKeywords: ["fresh", "organic", "whole"],
    avoidKeywords: ["in syrup", "candied", "sweetened", "dried sweetened", "juice"],
    notes: "Fresh or frozen, no added sugar"
  },
  eggs: {
    preferKeywords: ["cage free", "free range", "pasture raised", "organic"],
    avoidKeywords: ["egg substitute", "liquid egg product"],
    notes: "Fresh eggs, preferably cage-free or better"
  }
} as const;

export type CategoryType = keyof typeof CATEGORY_QUALITY_RULES;

// Ingredient-specific quality rules for common healthy items
export interface IngredientQualityRule {
  id: string;
  canonicalName: string;
  category: CategoryType;
  krogerDeptHint?: string;
  matchKeywords: string[];
  avoidKeywords: string[];
  preferAttributes?: string[];
  nutritionTargets?: {
    minProteinPer100g?: number;
    maxSaturatedFatPer100g?: number;
    maxSodiumPer100g?: number;
    maxSugarPer100g?: number;
    minFiberPer100g?: number;
    minFiberPerServing?: number;
    minFiberPerSlice?: number;
    maxSugarPerSlice?: number;
    maxSaturatedFatPerServing?: number;
    maxSugarPerServing?: number;
    maxSodiumPerServing?: number;
    minProteinPerServing?: number;
  };
  notes?: string;
}

export const INGREDIENT_QUALITY_RULES: IngredientQualityRule[] = [
  // ========= PROTEINS =========
  {
    id: "chicken_breast",
    canonicalName: "Chicken Breast, Boneless Skinless",
    category: "protein",
    krogerDeptHint: "Meat & Seafood",
    matchKeywords: ["chicken breast", "boneless skinless chicken breast", "chicken breasts"],
    avoidKeywords: [
      "breaded", "battered", "nuggets", "tenders", "popcorn", "buffalo",
      "fajita seasoned", "teriyaki", "marinated", "stuffed", "cordon bleu"
    ],
    preferAttributes: ["boneless", "skinless", "fresh"],
    nutritionTargets: {
      minProteinPer100g: 20,
      maxSaturatedFatPer100g: 4,
      maxSodiumPer100g: 500
    }
  },
  {
    id: "ground_turkey",
    canonicalName: "Ground Turkey, Lean",
    category: "protein",
    krogerDeptHint: "Meat & Seafood",
    matchKeywords: ["ground turkey"],
    avoidKeywords: ["sausage", "seasoned", "chub", "meatballs", "patties", "burgers"],
    preferAttributes: ["93% lean", "94% lean", "99% fat free", "lean"],
    nutritionTargets: {
      minProteinPer100g: 18,
      maxSaturatedFatPer100g: 5
    }
  },
  {
    id: "ground_beef",
    canonicalName: "Ground Beef, Lean",
    category: "protein",
    krogerDeptHint: "Meat & Seafood",
    matchKeywords: ["ground beef", "ground chuck", "ground sirloin"],
    avoidKeywords: ["patties", "burgers", "meatballs", "seasoned", "taco meat"],
    preferAttributes: ["93% lean", "90% lean", "lean", "grass fed"],
    nutritionTargets: {
      minProteinPer100g: 18,
      maxSaturatedFatPer100g: 6
    }
  },
  {
    id: "salmon_fillet",
    canonicalName: "Salmon Fillet",
    category: "protein",
    krogerDeptHint: "Meat & Seafood",
    matchKeywords: ["salmon fillet", "atlantic salmon", "sockeye salmon", "salmon"],
    avoidKeywords: ["breaded", "burgers", "patty", "smoked spread", "nuggets", "sticks"],
    preferAttributes: ["skinless", "fresh", "fillet", "wild caught"],
    nutritionTargets: {
      minProteinPer100g: 18,
      maxSodiumPer100g: 400
    }
  },
  {
    id: "tilapia",
    canonicalName: "Tilapia Fillet",
    category: "protein",
    krogerDeptHint: "Meat & Seafood",
    matchKeywords: ["tilapia", "tilapia fillet"],
    avoidKeywords: ["breaded", "battered", "fried", "nuggets", "sticks"],
    preferAttributes: ["fresh", "fillet"],
    nutritionTargets: {
      minProteinPer100g: 18
    }
  },
  {
    id: "shrimp",
    canonicalName: "Shrimp",
    category: "protein",
    krogerDeptHint: "Meat & Seafood",
    matchKeywords: ["shrimp", "prawns"],
    avoidKeywords: ["breaded", "battered", "popcorn", "coconut", "tempura", "fried"],
    preferAttributes: ["peeled", "deveined", "raw", "wild caught"],
    nutritionTargets: {
      minProteinPer100g: 18
    }
  },
  {
    id: "eggs",
    canonicalName: "Eggs, Large",
    category: "protein",
    krogerDeptHint: "Dairy & Eggs",
    matchKeywords: ["large eggs", "grade a large eggs", "cage free large eggs", "eggs"],
    avoidKeywords: ["egg substitute", "liquid egg product", "egg beaters", "powdered"],
    preferAttributes: ["cage free", "organic", "pasture raised", "large"]
  },
  {
    id: "greek_yogurt_plain",
    canonicalName: "Greek Yogurt, Plain",
    category: "dairy",
    krogerDeptHint: "Dairy & Eggs",
    matchKeywords: ["greek yogurt", "greek nonfat yogurt", "plain greek yogurt"],
    avoidKeywords: ["vanilla", "strawberry", "honey", "flavored", "fruit on the bottom", "key lime", "blueberry"],
    preferAttributes: ["plain", "unsweetened", "nonfat", "0%"],
    nutritionTargets: {
      minProteinPer100g: 8,
      maxSugarPer100g: 5
    }
  },
  {
    id: "chicken_thighs",
    canonicalName: "Chicken Thighs, Boneless Skinless",
    category: "protein",
    krogerDeptHint: "Meat & Seafood",
    matchKeywords: ["chicken thighs", "boneless chicken thighs"],
    avoidKeywords: ["breaded", "marinated", "teriyaki", "bbq"],
    preferAttributes: ["boneless", "skinless", "fresh"],
    nutritionTargets: {
      minProteinPer100g: 18
    }
  },
  {
    id: "pork_tenderloin",
    canonicalName: "Pork Tenderloin",
    category: "protein",
    krogerDeptHint: "Meat & Seafood",
    matchKeywords: ["pork tenderloin", "pork loin"],
    avoidKeywords: ["marinated", "seasoned", "teriyaki", "bbq", "stuffed"],
    preferAttributes: ["fresh", "whole"],
    nutritionTargets: {
      minProteinPer100g: 20,
      maxSaturatedFatPer100g: 3
    }
  },

  // ========= PRODUCE =========
  {
    id: "banana",
    canonicalName: "Banana, Fresh",
    category: "fruits",
    krogerDeptHint: "Produce",
    matchKeywords: ["banana", "bananas"],
    avoidKeywords: ["bread", "chips", "pudding", "cereal", "flavor", "nut muffin", "dried", "freeze dried"],
    preferAttributes: ["fresh", "whole", "organic"],
    notes: "Fresh bananas only"
  },
  {
    id: "spinach_fresh",
    canonicalName: "Baby Spinach, Fresh",
    category: "produce",
    krogerDeptHint: "Produce",
    matchKeywords: ["baby spinach", "fresh spinach", "spinach"],
    avoidKeywords: ["creamed", "dip", "frozen creamed", "artichoke dip"],
    preferAttributes: ["pre-washed", "baby", "organic", "fresh"]
  },
  {
    id: "broccoli",
    canonicalName: "Broccoli",
    category: "produce",
    krogerDeptHint: "Produce",
    matchKeywords: ["broccoli florets", "fresh broccoli", "broccoli"],
    avoidKeywords: ["cheddar", "cheese sauce", "casserole", "au gratin"],
    preferAttributes: ["florets", "fresh", "organic", "crowns"]
  },
  {
    id: "bell_pepper",
    canonicalName: "Bell Pepper",
    category: "produce",
    krogerDeptHint: "Produce",
    matchKeywords: ["bell pepper", "green bell pepper", "red bell pepper", "yellow bell pepper"],
    avoidKeywords: ["roasted in oil", "marinated", "stuffed", "frozen stuffed"],
    preferAttributes: ["fresh", "whole", "organic"]
  },
  {
    id: "mixed_greens",
    canonicalName: "Mixed Greens / Spring Mix",
    category: "produce",
    krogerDeptHint: "Produce",
    matchKeywords: ["spring mix", "mixed greens", "baby greens", "salad mix"],
    avoidKeywords: ["kit", "salad kit", "with dressing", "bacon bits", "croutons"],
    preferAttributes: ["pre-washed", "organic"]
  },
  {
    id: "tomatoes",
    canonicalName: "Tomatoes",
    category: "produce",
    krogerDeptHint: "Produce",
    matchKeywords: ["tomato", "tomatoes", "roma tomato", "cherry tomatoes", "grape tomatoes"],
    avoidKeywords: ["sun dried in oil", "fried green", "paste", "sauce", "ketchup"],
    preferAttributes: ["fresh", "vine ripened", "organic", "on the vine"]
  },
  {
    id: "onion",
    canonicalName: "Onion",
    category: "produce",
    krogerDeptHint: "Produce",
    matchKeywords: ["onion", "yellow onion", "white onion", "red onion"],
    avoidKeywords: ["onion rings", "fried", "blooming", "dip"],
    preferAttributes: ["fresh", "whole"]
  },
  {
    id: "garlic",
    canonicalName: "Garlic",
    category: "produce",
    krogerDeptHint: "Produce",
    matchKeywords: ["garlic", "garlic cloves", "fresh garlic"],
    avoidKeywords: ["garlic bread", "garlic toast", "garlic salt", "garlic powder"],
    preferAttributes: ["fresh", "whole", "bulb"]
  },
  {
    id: "avocado",
    canonicalName: "Avocado, Fresh",
    category: "produce",
    krogerDeptHint: "Produce",
    matchKeywords: ["avocado", "avocados", "hass avocado"],
    avoidKeywords: ["guacamole", "dip", "chips", "spread"],
    preferAttributes: ["fresh", "whole", "ripe", "organic"]
  },
  {
    id: "sweet_potato",
    canonicalName: "Sweet Potato",
    category: "produce",
    krogerDeptHint: "Produce",
    matchKeywords: ["sweet potato", "sweet potatoes", "yam"],
    avoidKeywords: ["fries", "casserole", "pie", "marshmallow", "candied"],
    preferAttributes: ["fresh", "whole", "organic"]
  },
  {
    id: "potato",
    canonicalName: "Potato",
    category: "produce",
    krogerDeptHint: "Produce",
    matchKeywords: ["potato", "potatoes", "russet potato", "gold potato", "red potato"],
    avoidKeywords: ["fries", "chips", "tots", "hash browns", "mashed instant", "au gratin"],
    preferAttributes: ["fresh", "whole"]
  },
  {
    id: "carrots",
    canonicalName: "Carrots",
    category: "produce",
    krogerDeptHint: "Produce",
    matchKeywords: ["carrots", "baby carrots", "carrot"],
    avoidKeywords: ["cake", "glazed", "candied", "chips"],
    preferAttributes: ["fresh", "whole", "organic", "baby"]
  },
  {
    id: "cucumber",
    canonicalName: "Cucumber",
    category: "produce",
    krogerDeptHint: "Produce",
    matchKeywords: ["cucumber", "english cucumber"],
    avoidKeywords: ["pickles", "relish"],
    preferAttributes: ["fresh", "whole", "seedless"]
  },
  {
    id: "zucchini",
    canonicalName: "Zucchini",
    category: "produce",
    krogerDeptHint: "Produce",
    matchKeywords: ["zucchini", "summer squash"],
    avoidKeywords: ["bread", "noodles packaged", "chips"],
    preferAttributes: ["fresh", "whole", "organic"]
  },
  {
    id: "lemon",
    canonicalName: "Lemon",
    category: "fruits",
    krogerDeptHint: "Produce",
    matchKeywords: ["lemon", "lemons"],
    avoidKeywords: ["lemonade", "lemon curd", "lemon bars", "lemon cake", "lemon juice bottle"],
    preferAttributes: ["fresh", "whole"]
  },
  {
    id: "lime",
    canonicalName: "Lime",
    category: "fruits",
    krogerDeptHint: "Produce",
    matchKeywords: ["lime", "limes"],
    avoidKeywords: ["limeade", "key lime pie", "lime juice bottle"],
    preferAttributes: ["fresh", "whole"]
  },
  {
    id: "apple",
    canonicalName: "Apple",
    category: "fruits",
    krogerDeptHint: "Produce",
    matchKeywords: ["apple", "apples", "gala apple", "fuji apple", "honeycrisp"],
    avoidKeywords: ["apple pie", "apple sauce sweetened", "apple juice", "caramel apple", "apple chips"],
    preferAttributes: ["fresh", "whole", "organic"]
  },
  {
    id: "berries",
    canonicalName: "Berries",
    category: "produce",
    krogerDeptHint: "Produce",
    matchKeywords: ["strawberries", "blueberries", "raspberries", "blackberries", "mixed berries"],
    avoidKeywords: ["jam", "jelly", "pie filling", "syrup", "topping", "dried sweetened"],
    preferAttributes: ["fresh", "organic"]
  },
  {
    id: "mushrooms",
    canonicalName: "Mushrooms",
    category: "produce",
    krogerDeptHint: "Produce",
    matchKeywords: ["mushrooms", "white mushrooms", "cremini", "baby bella", "portobello"],
    avoidKeywords: ["cream of mushroom soup", "stuffed", "breaded", "fried"],
    preferAttributes: ["fresh", "whole", "sliced"]
  },
  {
    id: "celery",
    canonicalName: "Celery",
    category: "produce",
    krogerDeptHint: "Produce",
    matchKeywords: ["celery", "celery stalks"],
    avoidKeywords: ["celery salt"],
    preferAttributes: ["fresh", "whole", "organic"]
  },
  {
    id: "lettuce",
    canonicalName: "Lettuce",
    category: "produce",
    krogerDeptHint: "Produce",
    matchKeywords: ["romaine", "iceberg", "lettuce", "butter lettuce"],
    avoidKeywords: ["salad kit", "with dressing", "croutons"],
    preferAttributes: ["fresh", "whole head", "hearts"]
  },
  {
    id: "kale",
    canonicalName: "Kale",
    category: "produce",
    krogerDeptHint: "Produce",
    matchKeywords: ["kale", "baby kale", "lacinato kale"],
    avoidKeywords: ["kale chips flavored", "kale salad kit"],
    preferAttributes: ["fresh", "organic", "baby"]
  },
  {
    id: "asparagus",
    canonicalName: "Asparagus",
    category: "produce",
    krogerDeptHint: "Produce",
    matchKeywords: ["asparagus"],
    avoidKeywords: ["cream of asparagus", "casserole"],
    preferAttributes: ["fresh", "bunch"]
  },
  {
    id: "green_beans",
    canonicalName: "Green Beans",
    category: "produce",
    krogerDeptHint: "Produce",
    matchKeywords: ["green beans", "string beans", "french beans"],
    avoidKeywords: ["casserole", "with bacon", "almondine frozen"],
    preferAttributes: ["fresh", "whole"]
  },
  {
    id: "cauliflower",
    canonicalName: "Cauliflower",
    category: "produce",
    krogerDeptHint: "Produce",
    matchKeywords: ["cauliflower"],
    avoidKeywords: ["cheese sauce", "au gratin", "mashed loaded"],
    preferAttributes: ["fresh", "whole", "florets"]
  },
  {
    id: "cabbage",
    canonicalName: "Cabbage",
    category: "produce",
    krogerDeptHint: "Produce",
    matchKeywords: ["cabbage", "green cabbage", "red cabbage", "napa cabbage"],
    avoidKeywords: ["coleslaw with dressing", "egg rolls"],
    preferAttributes: ["fresh", "whole"]
  },

  // ========= CARBS / GRAINS =========
  {
    id: "brown_rice",
    canonicalName: "Brown Rice",
    category: "carb",
    krogerDeptHint: "Grains & Pasta",
    matchKeywords: ["brown rice"],
    avoidKeywords: ["seasoned rice", "rice mix", "pilaf", "boxed mix", "fried rice", "spanish rice"],
    preferAttributes: ["long grain", "whole grain", "organic"],
    nutritionTargets: {
      minFiberPer100g: 3
    }
  },
  {
    id: "white_rice",
    canonicalName: "White Rice",
    category: "carb",
    krogerDeptHint: "Grains & Pasta",
    matchKeywords: ["white rice", "jasmine rice", "basmati rice"],
    avoidKeywords: ["seasoned", "rice mix", "pilaf", "fried rice", "spanish rice"],
    preferAttributes: ["long grain", "jasmine", "basmati"]
  },
  {
    id: "rolled_oats",
    canonicalName: "Rolled Oats / Old-Fashioned Oats",
    category: "carb",
    krogerDeptHint: "Breakfast",
    matchKeywords: ["old fashioned oats", "rolled oats", "oatmeal"],
    avoidKeywords: ["instant flavored", "maple", "brown sugar", "apple cinnamon", "peaches cream", "cookies"],
    preferAttributes: ["100% whole grain", "plain", "old fashioned"],
    nutritionTargets: {
      minFiberPer100g: 7,
      maxSugarPer100g: 2
    }
  },
  {
    id: "whole_wheat_bread",
    canonicalName: "100% Whole Wheat Bread",
    category: "carb",
    krogerDeptHint: "Bakery",
    matchKeywords: ["100% whole wheat bread", "whole grain bread", "whole wheat bread"],
    avoidKeywords: ["white bread", "honey wheat", "brioche", "texas toast", "cinnamon", "raisin", "sweet"],
    preferAttributes: ["100% whole wheat", "whole grain"],
    nutritionTargets: {
      minFiberPerSlice: 2,
      maxSugarPerSlice: 3
    }
  },
  {
    id: "whole_wheat_tortilla",
    canonicalName: "Whole Wheat Tortilla",
    category: "carb",
    krogerDeptHint: "Tortillas & Wraps",
    matchKeywords: ["whole wheat tortilla", "whole grain tortilla", "wheat tortilla"],
    avoidKeywords: ["flour tortilla", "burrito size white", "cheese stuffed", "flavored"],
    preferAttributes: ["whole wheat", "high fiber", "low carb"],
    nutritionTargets: {
      minFiberPerServing: 4
    }
  },
  {
    id: "quinoa",
    canonicalName: "Quinoa, Dry",
    category: "carb",
    krogerDeptHint: "Grains & Pasta",
    matchKeywords: ["quinoa"],
    avoidKeywords: ["salad", "ready to eat", "microwave bowl with sauce", "flavored"],
    preferAttributes: ["plain", "dry", "organic"],
    nutritionTargets: {
      minProteinPer100g: 12
    }
  },
  {
    id: "pasta",
    canonicalName: "Pasta",
    category: "carb",
    krogerDeptHint: "Grains & Pasta",
    matchKeywords: ["pasta", "spaghetti", "penne", "rigatoni", "linguine", "fettuccine"],
    avoidKeywords: ["canned", "ravioli", "mac and cheese", "alfredo", "with sauce", "hamburger helper"],
    preferAttributes: ["whole wheat", "whole grain", "protein plus"]
  },
  {
    id: "whole_wheat_pasta",
    canonicalName: "Whole Wheat Pasta",
    category: "carb",
    krogerDeptHint: "Grains & Pasta",
    matchKeywords: ["whole wheat pasta", "whole grain pasta", "whole wheat spaghetti"],
    avoidKeywords: ["with sauce", "ravioli", "stuffed"],
    preferAttributes: ["100% whole wheat", "whole grain"],
    nutritionTargets: {
      minFiberPerServing: 5
    }
  },

  // ========= HEALTHY FATS =========
  {
    id: "olive_oil",
    canonicalName: "Extra Virgin Olive Oil",
    category: "fats_oils",
    krogerDeptHint: "Oils & Dressings",
    matchKeywords: ["extra virgin olive oil", "olive oil"],
    avoidKeywords: ["blend", "canola blend", "spray butter", "light tasting"],
    preferAttributes: ["extra virgin", "cold pressed", "first cold pressed"]
  },
  {
    id: "coconut_oil",
    canonicalName: "Coconut Oil",
    category: "fats_oils",
    krogerDeptHint: "Oils & Dressings",
    matchKeywords: ["coconut oil"],
    avoidKeywords: ["flavored", "spray", "blend"],
    preferAttributes: ["virgin", "unrefined", "organic"]
  },
  {
    id: "avocado_oil",
    canonicalName: "Avocado Oil",
    category: "fats_oils",
    krogerDeptHint: "Oils & Dressings",
    matchKeywords: ["avocado oil"],
    avoidKeywords: ["blend", "spray butter"],
    preferAttributes: ["pure", "cold pressed"]
  },
  {
    id: "butter",
    canonicalName: "Butter",
    category: "fats_oils",
    krogerDeptHint: "Dairy & Eggs",
    matchKeywords: ["butter", "unsalted butter", "salted butter"],
    avoidKeywords: ["margarine", "spread", "light butter", "whipped butter", "garlic butter"],
    preferAttributes: ["grass fed", "unsalted"]
  },
  {
    id: "peanut_butter",
    canonicalName: "Peanut Butter, Natural",
    category: "fats_oils",
    krogerDeptHint: "Peanut Butter & Jelly",
    matchKeywords: ["peanut butter", "natural peanut butter"],
    avoidKeywords: ["honey roasted", "with chocolate", "frosting", "reese's spread", "flavored"],
    preferAttributes: ["natural", "no sugar added", "just peanuts and salt", "creamy"],
    nutritionTargets: {
      maxSugarPerServing: 3
    }
  },
  {
    id: "almond_butter",
    canonicalName: "Almond Butter",
    category: "fats_oils",
    krogerDeptHint: "Peanut Butter & Jelly",
    matchKeywords: ["almond butter"],
    avoidKeywords: ["honey", "chocolate", "flavored", "sweetened"],
    preferAttributes: ["natural", "no sugar added"],
    nutritionTargets: {
      maxSugarPerServing: 3
    }
  },

  // ========= NUTS & SEEDS =========
  {
    id: "almonds",
    canonicalName: "Almonds, Whole",
    category: "snacks",
    krogerDeptHint: "Nuts & Seeds",
    matchKeywords: ["almonds", "whole almonds", "raw almonds"],
    avoidKeywords: ["candy", "chocolate", "honey roasted", "sriracha", "smokehouse", "wasabi"],
    preferAttributes: ["unsalted", "lightly salted", "raw", "dry roasted"],
    nutritionTargets: {
      maxSodiumPerServing: 150
    }
  },
  {
    id: "walnuts",
    canonicalName: "Walnuts",
    category: "snacks",
    krogerDeptHint: "Nuts & Seeds",
    matchKeywords: ["walnuts", "walnut halves", "walnut pieces"],
    avoidKeywords: ["candied", "glazed", "honey"],
    preferAttributes: ["raw", "unsalted", "halves and pieces"]
  },
  {
    id: "cashews",
    canonicalName: "Cashews",
    category: "snacks",
    krogerDeptHint: "Nuts & Seeds",
    matchKeywords: ["cashews", "whole cashews"],
    avoidKeywords: ["honey roasted", "chocolate", "glazed", "sriracha"],
    preferAttributes: ["unsalted", "lightly salted", "raw", "dry roasted"],
    nutritionTargets: {
      maxSodiumPerServing: 150
    }
  },
  {
    id: "mixed_nuts",
    canonicalName: "Mixed Nuts",
    category: "snacks",
    krogerDeptHint: "Nuts & Seeds",
    matchKeywords: ["mixed nuts"],
    avoidKeywords: ["honey roasted", "chocolate", "candy", "trail mix with candy"],
    preferAttributes: ["unsalted", "lightly salted", "dry roasted"],
    nutritionTargets: {
      maxSodiumPerServing: 200
    }
  },
  {
    id: "chia_seeds",
    canonicalName: "Chia Seeds",
    category: "snacks",
    krogerDeptHint: "Nuts & Seeds",
    matchKeywords: ["chia seeds"],
    avoidKeywords: ["pudding cup", "drink", "flavored"],
    preferAttributes: ["whole", "organic"]
  },
  {
    id: "flax_seeds",
    canonicalName: "Flax Seeds",
    category: "snacks",
    krogerDeptHint: "Nuts & Seeds",
    matchKeywords: ["flax seed", "flaxseed", "ground flax"],
    avoidKeywords: ["bread", "crackers"],
    preferAttributes: ["ground", "whole", "organic"]
  },

  // ========= DAIRY / CHEESE =========
  {
    id: "milk",
    canonicalName: "Milk",
    category: "dairy",
    krogerDeptHint: "Dairy & Eggs",
    matchKeywords: ["milk", "whole milk", "2% milk", "skim milk", "1% milk"],
    avoidKeywords: ["chocolate milk", "strawberry milk", "flavored", "sweetened"],
    preferAttributes: ["organic", "grass fed"]
  },
  {
    id: "almond_milk",
    canonicalName: "Almond Milk, Unsweetened",
    category: "dairy",
    krogerDeptHint: "Dairy & Eggs",
    matchKeywords: ["almond milk", "unsweetened almond milk"],
    avoidKeywords: ["vanilla sweetened", "chocolate", "sweetened", "flavored"],
    preferAttributes: ["unsweetened", "plain", "original unsweetened"],
    nutritionTargets: {
      maxSugarPerServing: 1
    }
  },
  {
    id: "oat_milk",
    canonicalName: "Oat Milk, Unsweetened",
    category: "dairy",
    krogerDeptHint: "Dairy & Eggs",
    matchKeywords: ["oat milk", "unsweetened oat milk"],
    avoidKeywords: ["vanilla sweetened", "chocolate", "sweetened", "flavored"],
    preferAttributes: ["unsweetened", "plain"],
    nutritionTargets: {
      maxSugarPerServing: 4
    }
  },
  {
    id: "shredded_mozzarella",
    canonicalName: "Shredded Mozzarella, Part Skim",
    category: "dairy",
    krogerDeptHint: "Dairy & Eggs",
    matchKeywords: ["part skim mozzarella", "low moisture part skim mozzarella", "shredded mozzarella"],
    avoidKeywords: ["whole milk mozzarella", "pizza blend", "4 cheese blend with cheddar"],
    preferAttributes: ["part skim", "low moisture"],
    nutritionTargets: {
      maxSaturatedFatPerServing: 5
    }
  },
  {
    id: "cheddar_cheese",
    canonicalName: "Cheddar Cheese",
    category: "dairy",
    krogerDeptHint: "Dairy & Eggs",
    matchKeywords: ["cheddar cheese", "sharp cheddar", "shredded cheddar"],
    avoidKeywords: ["cheese product", "processed", "velveeta", "cheese sauce"],
    preferAttributes: ["sharp", "block", "natural"]
  },
  {
    id: "cottage_cheese",
    canonicalName: "Cottage Cheese, Low Fat",
    category: "dairy",
    krogerDeptHint: "Dairy & Eggs",
    matchKeywords: ["cottage cheese", "low fat cottage cheese"],
    avoidKeywords: ["pineapple", "fruit mix", "flavored", "with fruit"],
    preferAttributes: ["low fat", "2%", "1%"],
    nutritionTargets: {
      maxSugarPer100g: 5
    }
  },
  {
    id: "parmesan_cheese",
    canonicalName: "Parmesan Cheese",
    category: "dairy",
    krogerDeptHint: "Dairy & Eggs",
    matchKeywords: ["parmesan", "parmigiano reggiano", "grated parmesan"],
    avoidKeywords: ["cheese product", "spray cheese"],
    preferAttributes: ["freshly grated", "wedge", "shredded"]
  },
  {
    id: "feta_cheese",
    canonicalName: "Feta Cheese",
    category: "dairy",
    krogerDeptHint: "Dairy & Eggs",
    matchKeywords: ["feta cheese", "crumbled feta"],
    avoidKeywords: ["flavored", "mediterranean blend with olives"],
    preferAttributes: ["crumbled", "traditional", "block"]
  },
  {
    id: "cream_cheese",
    canonicalName: "Cream Cheese",
    category: "dairy",
    krogerDeptHint: "Dairy & Eggs",
    matchKeywords: ["cream cheese"],
    avoidKeywords: ["strawberry", "honey walnut", "flavored", "cheesecake"],
    preferAttributes: ["plain", "original", "neufchatel"]
  },

  // ========= CANNED / PANTRY PROTEINS =========
  {
    id: "canned_tuna",
    canonicalName: "Canned Tuna",
    category: "protein",
    krogerDeptHint: "Canned Goods",
    matchKeywords: ["canned tuna", "chunk light tuna", "albacore tuna"],
    avoidKeywords: ["tuna salad", "tuna helper", "flavored tuna"],
    preferAttributes: ["in water", "chunk light", "no salt added"],
    nutritionTargets: {
      minProteinPerServing: 15
    }
  },
  {
    id: "canned_salmon",
    canonicalName: "Canned Salmon",
    category: "protein",
    krogerDeptHint: "Canned Goods",
    matchKeywords: ["canned salmon", "pink salmon"],
    avoidKeywords: ["salmon patty mix", "salmon salad"],
    preferAttributes: ["wild caught", "in water", "skinless boneless"]
  },
  {
    id: "canned_chicken",
    canonicalName: "Canned Chicken Breast",
    category: "protein",
    krogerDeptHint: "Canned Goods",
    matchKeywords: ["canned chicken", "chicken breast in water"],
    avoidKeywords: ["chicken salad", "buffalo chicken"],
    preferAttributes: ["in water", "no salt added", "white meat"]
  },
  {
    id: "black_beans",
    canonicalName: "Black Beans",
    category: "beans",
    krogerDeptHint: "Canned Goods",
    matchKeywords: ["black beans", "canned black beans"],
    avoidKeywords: ["refried", "seasoned", "cuban style", "with bacon"],
    preferAttributes: ["no salt added", "low sodium", "organic"],
    nutritionTargets: {
      minFiberPerServing: 5
    }
  },
  {
    id: "chickpeas",
    canonicalName: "Chickpeas / Garbanzo Beans",
    category: "beans",
    krogerDeptHint: "Canned Goods",
    matchKeywords: ["chickpeas", "garbanzo beans"],
    avoidKeywords: ["hummus", "falafel mix", "roasted flavored"],
    preferAttributes: ["no salt added", "low sodium", "organic"]
  },
  {
    id: "kidney_beans",
    canonicalName: "Kidney Beans",
    category: "beans",
    krogerDeptHint: "Canned Goods",
    matchKeywords: ["kidney beans", "red kidney beans"],
    avoidKeywords: ["chili beans seasoned", "with meat"],
    preferAttributes: ["no salt added", "low sodium"]
  },
  {
    id: "lentils",
    canonicalName: "Lentils",
    category: "beans",
    krogerDeptHint: "Canned Goods",
    matchKeywords: ["lentils", "green lentils", "red lentils"],
    avoidKeywords: ["soup", "with bacon"],
    preferAttributes: ["dry", "organic"],
    nutritionTargets: {
      minProteinPer100g: 9,
      minFiberPer100g: 8
    }
  },

  // ========= CANNED VEGETABLES =========
  {
    id: "canned_tomatoes",
    canonicalName: "Canned Tomatoes",
    category: "produce",
    krogerDeptHint: "Canned Goods",
    matchKeywords: ["canned tomatoes", "diced tomatoes", "crushed tomatoes", "tomato sauce"],
    avoidKeywords: ["pasta sauce", "with meat", "stewed with peppers and onions"],
    preferAttributes: ["no salt added", "fire roasted", "san marzano", "organic"]
  },
  {
    id: "tomato_paste",
    canonicalName: "Tomato Paste",
    category: "produce",
    krogerDeptHint: "Canned Goods",
    matchKeywords: ["tomato paste"],
    avoidKeywords: ["pizza sauce"],
    preferAttributes: ["no salt added", "organic", "double concentrated"]
  },

  // ========= CONDIMENTS & SAUCES =========
  {
    id: "salsa",
    canonicalName: "Salsa",
    category: "produce",
    krogerDeptHint: "Condiments",
    matchKeywords: ["salsa", "fresh salsa", "pico de gallo"],
    avoidKeywords: ["queso", "con queso", "cheese dip"],
    preferAttributes: ["fresh", "refrigerated", "low sodium"]
  },
  {
    id: "soy_sauce",
    canonicalName: "Soy Sauce",
    category: "fats_oils",
    krogerDeptHint: "International",
    matchKeywords: ["soy sauce", "tamari"],
    avoidKeywords: ["teriyaki sauce", "stir fry sauce"],
    preferAttributes: ["low sodium", "reduced sodium", "tamari"]
  },
  {
    id: "hot_sauce",
    canonicalName: "Hot Sauce",
    category: "fats_oils",
    krogerDeptHint: "Condiments",
    matchKeywords: ["hot sauce", "sriracha", "cholula", "tabasco"],
    avoidKeywords: ["buffalo wing sauce", "bbq hot sauce"],
    preferAttributes: ["original"]
  },
  {
    id: "mustard",
    canonicalName: "Mustard",
    category: "fats_oils",
    krogerDeptHint: "Condiments",
    matchKeywords: ["mustard", "yellow mustard", "dijon mustard"],
    avoidKeywords: ["honey mustard dressing", "pretzel"],
    preferAttributes: ["dijon", "stone ground"]
  },
  {
    id: "vinegar",
    canonicalName: "Vinegar",
    category: "fats_oils",
    krogerDeptHint: "Condiments",
    matchKeywords: ["vinegar", "apple cider vinegar", "balsamic vinegar", "red wine vinegar"],
    avoidKeywords: ["vinaigrette dressing", "chips"],
    preferAttributes: ["organic", "raw", "unfiltered"]
  },

  // ========= PANTRY / JUICE / SPICES =========
  {
    id: "lemon_juice",
    canonicalName: "Lemon Juice",
    category: "fats_oils",
    krogerDeptHint: "Condiments",
    matchKeywords: ["lemon juice"],
    avoidKeywords: ["lemonade", "lemon drink", "lemon tea", "lemon candy"],
    preferAttributes: ["100%", "pure", "from concentrate", "realemon"],
    notes: "Bottled lemon juice for cooking"
  },
  {
    id: "lime_juice",
    canonicalName: "Lime Juice",
    category: "fats_oils",
    krogerDeptHint: "Condiments",
    matchKeywords: ["lime juice"],
    avoidKeywords: ["limeade", "lime drink", "margarita mix"],
    preferAttributes: ["100%", "pure", "from concentrate", "realime"],
    notes: "Bottled lime juice for cooking"
  },
  {
    id: "black_pepper",
    canonicalName: "Black Pepper",
    category: "fats_oils",
    krogerDeptHint: "Spices",
    matchKeywords: ["black pepper", "ground black pepper", "cracked black pepper"],
    avoidKeywords: ["lemon pepper", "garlic pepper", "seasoned pepper", "pepper blend", "steak seasoning", "and spices"],
    preferAttributes: ["ground", "pure", "whole peppercorns"],
    notes: "Pure black pepper, not seasoning blends"
  },
  {
    id: "salt",
    canonicalName: "Salt",
    category: "fats_oils",
    krogerDeptHint: "Spices",
    matchKeywords: ["salt", "table salt", "sea salt", "kosher salt"],
    avoidKeywords: ["seasoned salt", "garlic salt", "onion salt", "salt substitute", "popcorn salt"],
    preferAttributes: ["iodized", "kosher", "sea salt", "fine"],
    notes: "Plain salt, not seasoning blends"
  },
  {
    id: "garlic_powder",
    canonicalName: "Garlic Powder",
    category: "fats_oils",
    krogerDeptHint: "Spices",
    matchKeywords: ["garlic powder"],
    avoidKeywords: ["garlic salt", "garlic bread seasoning", "garlic pepper"],
    preferAttributes: ["pure", "granulated"],
    notes: "Pure garlic powder"
  },
  {
    id: "onion_powder",
    canonicalName: "Onion Powder",
    category: "fats_oils",
    krogerDeptHint: "Spices",
    matchKeywords: ["onion powder"],
    avoidKeywords: ["onion salt", "onion soup mix"],
    preferAttributes: ["pure", "granulated"],
    notes: "Pure onion powder"
  },
  {
    id: "paprika",
    canonicalName: "Paprika",
    category: "fats_oils",
    krogerDeptHint: "Spices",
    matchKeywords: ["paprika", "smoked paprika"],
    avoidKeywords: ["seasoning blend", "rub"],
    preferAttributes: ["smoked", "hungarian", "sweet"],
    notes: "Pure paprika"
  },
  {
    id: "cumin",
    canonicalName: "Cumin",
    category: "fats_oils",
    krogerDeptHint: "Spices",
    matchKeywords: ["cumin", "ground cumin"],
    avoidKeywords: ["taco seasoning", "chili seasoning"],
    preferAttributes: ["ground", "whole seeds"],
    notes: "Pure cumin"
  },
  {
    id: "italian_seasoning",
    canonicalName: "Italian Seasoning",
    category: "fats_oils",
    krogerDeptHint: "Spices",
    matchKeywords: ["italian seasoning", "italian herbs"],
    avoidKeywords: ["dressing mix", "pasta sauce seasoning"],
    preferAttributes: ["blend", "herbs"],
    notes: "Herb blend for Italian dishes"
  },
  {
    id: "chili_powder",
    canonicalName: "Chili Powder",
    category: "fats_oils",
    krogerDeptHint: "Spices",
    matchKeywords: ["chili powder"],
    avoidKeywords: ["chili seasoning packet", "taco seasoning", "chili starter"],
    preferAttributes: ["pure", "dark"],
    notes: "Pure chili powder"
  },
  {
    id: "cinnamon",
    canonicalName: "Cinnamon",
    category: "fats_oils",
    krogerDeptHint: "Spices",
    matchKeywords: ["cinnamon", "ground cinnamon"],
    avoidKeywords: ["cinnamon sugar", "cinnamon roll", "cinnamon toast"],
    preferAttributes: ["ground", "ceylon", "sticks"],
    notes: "Pure cinnamon"
  }
];

/**
 * Find matching quality rule for an ingredient name.
 * Prefers longer/more specific keyword matches over shorter ones.
 * E.g., "lemon juice" should match the "lemon_juice" rule, not the "lemon" rule.
 */
export function findIngredientRule(ingredientName: string): IngredientQualityRule | null {
  const normalized = ingredientName.toLowerCase().trim();

  let bestMatch: { rule: IngredientQualityRule; keywordLength: number } | null = null;

  for (const rule of INGREDIENT_QUALITY_RULES) {
    for (const keyword of rule.matchKeywords) {
      // Check if ingredient contains keyword or exactly equals it
      if (normalized.includes(keyword) || normalized === keyword) {
        // Prefer longer keyword matches (more specific)
        if (!bestMatch || keyword.length > bestMatch.keywordLength) {
          bestMatch = { rule, keywordLength: keyword.length };
        }
      }
    }
  }

  return bestMatch?.rule ?? null;
}

/**
 * Get category rules for a given category
 */
export function getCategoryRules(category: CategoryType) {
  return CATEGORY_QUALITY_RULES[category] || null;
}

/**
 * Check if a product should be avoided based on quality rules
 * Returns true if product contains avoid keywords
 */
export function shouldAvoidProduct(
  productDescription: string,
  ingredientRule: IngredientQualityRule | null,
  categoryType?: CategoryType
): boolean {
  const desc = productDescription.toLowerCase();

  // Check ingredient-specific avoid keywords
  if (ingredientRule) {
    for (const keyword of ingredientRule.avoidKeywords) {
      if (desc.includes(keyword.toLowerCase())) {
        return true;
      }
    }
  }

  // Check category-level avoid keywords
  if (categoryType && CATEGORY_QUALITY_RULES[categoryType]) {
    const categoryRules = CATEGORY_QUALITY_RULES[categoryType];
    if ('avoidKeywords' in categoryRules) {
      for (const keyword of categoryRules.avoidKeywords) {
        if (desc.includes(keyword.toLowerCase())) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Calculate quality bonus score for a product based on preferred attributes
 * Returns a positive number for quality bonuses
 */
export function getQualityBonus(
  productDescription: string,
  ingredientRule: IngredientQualityRule | null,
  categoryType?: CategoryType
): number {
  const desc = productDescription.toLowerCase();
  let bonus = 0;

  // Check ingredient-specific prefer attributes
  if (ingredientRule?.preferAttributes) {
    for (const attr of ingredientRule.preferAttributes) {
      if (desc.includes(attr.toLowerCase())) {
        bonus += 5;
      }
    }
  }

  // Check category-level prefer keywords
  if (categoryType && CATEGORY_QUALITY_RULES[categoryType]) {
    const categoryRules = CATEGORY_QUALITY_RULES[categoryType];
    if ('preferKeywords' in categoryRules && categoryRules.preferKeywords) {
      for (const keyword of categoryRules.preferKeywords) {
        if (desc.includes(keyword.toLowerCase())) {
          bonus += 4;
        }
      }
    }
    if ('preferAttributes' in categoryRules && categoryRules.preferAttributes) {
      for (const attr of categoryRules.preferAttributes) {
        if (desc.includes(attr.toLowerCase())) {
          bonus += 4;
        }
      }
    }
  }

  return bonus;
}

/**
 * Get quality penalty for a product (negative number)
 * Applies when product has processed/unhealthy indicators
 */
export function getQualityPenalty(
  productDescription: string,
  ingredientRule: IngredientQualityRule | null
): number {
  const desc = productDescription.toLowerCase();
  let penalty = 0;

  // General processed food indicators
  const processedIndicators = [
    'breaded', 'battered', 'fried', 'crispy', 'crunchy coating',
    'with sauce', 'in sauce', 'glazed', 'candied', 'sweetened',
    'flavored', 'seasoned blend', 'helper', 'complete meal'
  ];

  for (const indicator of processedIndicators) {
    if (desc.includes(indicator)) {
      penalty -= 10;
    }
  }

  // If we have specific avoid keywords and match, heavier penalty
  if (ingredientRule) {
    for (const keyword of ingredientRule.avoidKeywords) {
      if (desc.includes(keyword.toLowerCase())) {
        penalty -= 15;
      }
    }
  }

  return penalty;
}

/**
 * Get category for an ingredient name
 * Returns a category type for icon mapping
 */
export function getIngredientCategory(ingredientName: string): CategoryType | "pantry" {
  const normalized = ingredientName.toLowerCase().trim();

  // First try to find a specific rule
  const rule = findIngredientRule(ingredientName);
  if (rule) {
    return rule.category;
  }

  // Check for pantry/spice items FIRST (before produce, since garlic powder != fresh garlic)
  const pantryKeywords = [
    // Spices and seasonings
    'powder', 'ground', 'dried', 'seasoning', 'spice', 'extract', 'flakes',
    'salt', 'pepper', 'paprika', 'cumin', 'coriander', 'turmeric', 'cinnamon',
    'nutmeg', 'oregano', 'thyme', 'rosemary', 'bay leaf', 'chili powder',
    'curry', 'cayenne', 'black pepper', 'white pepper', 'red pepper flakes',
    'italian seasoning', 'garlic powder', 'onion powder', 'garlic salt',
    'seasoned salt', 'old bay', 'taco seasoning', 'ranch seasoning',
    // Baking
    'baking soda', 'baking powder', 'yeast', 'cornstarch', 'vanilla',
    // Canned/jarred pantry
    'minced garlic', 'crushed garlic', 'garlic paste', 'tomato paste',
    'broth', 'stock', 'bouillon',
    // Sweeteners
    'sugar', 'honey', 'maple syrup', 'agave', 'stevia', 'molasses'
  ];

  for (const keyword of pantryKeywords) {
    if (normalized.includes(keyword)) return 'pantry';
  }

  // Fallback keyword matching for common items not in rules
  const proteinKeywords = ['chicken', 'beef', 'pork', 'turkey', 'fish', 'salmon', 'tuna', 'shrimp', 'meat', 'steak', 'bacon', 'sausage', 'lamb', 'duck', 'tofu', 'tempeh', 'seitan'];
  const eggsKeywords = ['egg', 'eggs'];
  const dairyKeywords = ['milk', 'cheese', 'yogurt', 'cream', 'butter', 'sour cream', 'cottage', 'ricotta', 'mozzarella', 'cheddar', 'parmesan'];
  const produceKeywords = ['lettuce', 'spinach', 'kale', 'tomato', 'onion', 'garlic', 'pepper', 'carrot', 'celery', 'broccoli', 'cauliflower', 'cucumber', 'zucchini', 'squash', 'potato', 'sweet potato', 'mushroom', 'avocado', 'cabbage', 'asparagus', 'corn', 'basil', 'cilantro', 'parsley', 'mint', 'ginger', 'jalapeno', 'salad', 'greens', 'arugula', 'chard'];
  const fruitsKeywords = ['lemon', 'lime', 'orange', 'apple', 'banana', 'berry', 'berries', 'strawberry', 'blueberry', 'raspberry', 'grape', 'melon', 'watermelon', 'cantaloupe', 'mango', 'pineapple', 'peach', 'pear', 'plum', 'cherry', 'kiwi', 'papaya', 'fruit'];
  const carbKeywords = ['rice', 'pasta', 'bread', 'tortilla', 'noodle', 'oat', 'quinoa', 'couscous', 'barley', 'flour', 'cereal', 'cracker', 'bagel', 'roll', 'bun', 'pita', 'wrap', 'grain'];
  const fatsOilsKeywords = ['oil', 'olive oil', 'vegetable oil', 'coconut oil', 'sesame oil', 'vinegar', 'mayo', 'mayonnaise', 'dressing', 'sauce', 'mustard', 'ketchup', 'soy sauce', 'sriracha', 'hot sauce'];
  const snacksKeywords = ['nut', 'almond', 'walnut', 'cashew', 'pecan', 'pistachio', 'peanut', 'seed', 'chia', 'flax', 'sunflower', 'pumpkin seed', 'dried fruit', 'raisin', 'cranberry', 'chip', 'pretzel', 'popcorn'];
  const beansKeywords = ['bean', 'beans', 'lentil', 'lentils', 'chickpea', 'chickpeas', 'black bean', 'kidney bean', 'pinto bean', 'cannellini', 'navy bean', 'garbanzo', 'edamame', 'pea', 'peas', 'split pea'];

  for (const keyword of eggsKeywords) {
    if (normalized.includes(keyword)) return 'eggs';
  }
  for (const keyword of proteinKeywords) {
    if (normalized.includes(keyword)) return 'protein';
  }
  for (const keyword of dairyKeywords) {
    if (normalized.includes(keyword)) return 'dairy';
  }
  for (const keyword of beansKeywords) {
    if (normalized.includes(keyword)) return 'beans';
  }
  for (const keyword of fruitsKeywords) {
    if (normalized.includes(keyword)) return 'fruits';
  }
  for (const keyword of produceKeywords) {
    if (normalized.includes(keyword)) return 'produce';
  }
  for (const keyword of carbKeywords) {
    if (normalized.includes(keyword)) return 'carb';
  }
  for (const keyword of fatsOilsKeywords) {
    if (normalized.includes(keyword)) return 'fats_oils';
  }
  for (const keyword of snacksKeywords) {
    if (normalized.includes(keyword)) return 'snacks';
  }

  // Default to pantry for anything else
  return 'pantry';
}
