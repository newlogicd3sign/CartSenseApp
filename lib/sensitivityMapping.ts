/**
 * Maps dietary sensitivities and allergies to common ingredient keywords
 * Used for pre-submission validation to warn users when their prompt
 * conflicts with their dietary restrictions
 */

// Mapping of allergy/sensitivity names to keywords that might appear in prompts
export const sensitivityKeywords: Record<string, string[]> = {
    // Allergies
    "dairy": [
        "milk", "cheese", "yogurt", "butter", "cream", "ice cream", "whey",
        "casein", "ghee", "paneer", "ricotta", "mozzarella", "cheddar",
        "parmesan", "brie", "feta", "gouda", "swiss", "provolone",
        "cream cheese", "sour cream", "cottage cheese", "custard"
    ],
    "eggs": [
        "egg", "eggs", "omelette", "omelet", "frittata", "quiche",
        "meringue", "mayonnaise", "mayo", "hollandaise", "aioli",
        "scrambled", "fried egg", "poached egg", "benedict"
    ],
    "fish": [
        "fish", "salmon", "tuna", "cod", "tilapia", "halibut", "trout",
        "sardine", "anchovy", "mackerel", "snapper", "bass", "catfish",
        "flounder", "sole", "haddock", "swordfish", "mahi", "grouper"
    ],
    "shellfish": [
        "shrimp", "crab", "lobster", "clam", "mussel", "oyster", "scallop",
        "crawfish", "crayfish", "prawn", "calamari", "squid", "octopus"
    ],
    "peanuts": [
        "peanut", "peanuts", "peanut butter", "groundnut"
    ],
    "tree nuts": [
        "almond", "walnut", "cashew", "pecan", "pistachio", "macadamia",
        "hazelnut", "brazil nut", "chestnut", "pine nut", "praline"
    ],
    "wheat/gluten": [
        "bread", "pasta", "noodle", "pizza", "sandwich", "wrap", "tortilla",
        "flour", "cake", "pastry", "croissant", "bagel", "muffin",
        "pancake", "waffle", "cracker", "pretzel", "pita", "naan", "ramen",
        "spaghetti", "linguine", "fettuccine", "lasagna", "ravioli", "gnocchi",
        "couscous", "bulgur", "seitan", "breaded", "crusted", "battered"
    ],
    "soy": [
        "soy", "tofu", "tempeh", "edamame", "miso", "soy sauce", "tamari"
    ],
    "sesame": [
        "sesame", "tahini", "hummus", "halvah"
    ],

    // Sensitivities
    "lactose": [
        "milk", "cream", "ice cream", "soft cheese", "ricotta", "cottage cheese",
        "yogurt", "whey", "buttermilk"
    ],
    "gluten sensitivity": [
        "bread", "pasta", "noodle", "pizza", "sandwich", "wrap", "tortilla",
        "flour", "cake", "pastry", "croissant", "bagel", "muffin",
        "pancake", "waffle", "cracker", "pretzel", "pita", "naan", "ramen",
        "spaghetti", "linguine", "fettuccine", "lasagna", "ravioli",
        "couscous", "bulgur", "seitan", "breaded", "crusted", "battered"
    ],
    "artificial sweeteners": [
        "diet", "sugar-free", "zero sugar", "aspartame", "sucralose", "stevia"
    ],
    "added sugars": [
        "candy", "sweet", "sugary", "frosting", "syrup", "caramel"
    ],
    "high-sodium foods": [
        "salty", "salted", "pickled", "cured", "smoked", "bacon", "ham",
        "sausage", "hot dog", "deli", "jerky", "chips"
    ],
    "spicy foods": [
        "spicy", "hot", "jalapeno", "habanero", "sriracha", "buffalo",
        "cajun", "curry", "chili", "pepper", "wasabi", "horseradish"
    ],
    "red meat": [
        // Beef
        "beef", "steak", "ground beef", "beef burger", "ribeye", "sirloin",
        "tenderloin", "filet", "t-bone", "prime rib", "brisket", "roast beef",
        "pot roast", "corned beef", "pastrami",
        // Pork
        "pork", "bacon", "ham", "pulled pork", "pork chop", "pork belly",
        "carnitas", "spare ribs", "pork ribs",
        // Lamb/Other
        "lamb", "veal", "venison", "bison", "goat",
        // Processed (specifically red meat)
        "pepperoni", "salami", "prosciutto", "chorizo", "bratwurst", "kielbasa"
    ],
    "corn syrup": [
        "corn syrup", "high fructose"
    ],
    "msg": [
        "msg", "monosodium glutamate"
    ]
};

// Diet type restrictions - what ingredients conflict with each diet
export const dietTypeConflicts: Record<string, string[]> = {
    "vegetarian": [
        // Poultry
        "chicken", "turkey", "duck", "goose", "quail", "pheasant",
        // Red meat
        "beef", "pork", "lamb", "veal", "venison", "bison", "goat",
        "steak", "burger", "hamburger", "meatball", "meatloaf", "meat",
        "bacon", "ham", "sausage", "hot dog", "pepperoni", "salami",
        "prosciutto", "chorizo", "bratwurst", "kielbasa", "jerky",
        "ribs", "brisket", "roast", "tenderloin", "sirloin", "ribeye",
        // Fish (all types)
        "fish", "salmon", "tuna", "cod", "tilapia", "halibut", "trout",
        "sardine", "anchovy", "mackerel", "snapper", "bass", "catfish",
        "flounder", "sole", "haddock", "swordfish", "mahi", "grouper",
        "herring", "perch", "pollock", "rockfish", "whitefish",
        // Shellfish
        "shrimp", "crab", "lobster", "clam", "mussel", "oyster", "scallop",
        "crawfish", "crayfish", "prawn", "calamari", "squid", "octopus"
    ],
    "vegan": [
        // Poultry
        "chicken", "turkey", "duck", "goose", "quail", "pheasant",
        // Red meat
        "beef", "pork", "lamb", "veal", "venison", "bison", "goat",
        "steak", "burger", "hamburger", "meatball", "meatloaf", "meat",
        "bacon", "ham", "sausage", "hot dog", "pepperoni", "salami",
        "prosciutto", "chorizo", "bratwurst", "kielbasa", "jerky",
        "ribs", "brisket", "roast", "tenderloin", "sirloin", "ribeye",
        // Fish (all types)
        "fish", "salmon", "tuna", "cod", "tilapia", "halibut", "trout",
        "sardine", "anchovy", "mackerel", "snapper", "bass", "catfish",
        "flounder", "sole", "haddock", "swordfish", "mahi", "grouper",
        "herring", "perch", "pollock", "rockfish", "whitefish",
        // Shellfish
        "shrimp", "crab", "lobster", "clam", "mussel", "oyster", "scallop",
        "crawfish", "crayfish", "prawn", "calamari", "squid", "octopus",
        // Dairy
        "cheese", "milk", "cream", "butter", "yogurt", "ice cream", "whey",
        "casein", "ghee", "paneer", "ricotta", "mozzarella", "cheddar",
        "parmesan", "brie", "feta", "gouda", "swiss", "provolone",
        "cream cheese", "sour cream", "cottage cheese", "custard",
        // Eggs
        "egg", "eggs", "omelette", "omelet", "frittata", "quiche",
        "meringue", "mayonnaise", "mayo",
        // Other animal products
        "honey", "gelatin", "lard"
    ],
    "pescatarian": [
        // Poultry
        "chicken", "turkey", "duck", "goose", "quail", "pheasant",
        // Red meat
        "beef", "pork", "lamb", "veal", "venison", "bison", "goat",
        "steak", "burger", "hamburger", "meatball", "meatloaf", "meat",
        "bacon", "ham", "sausage", "hot dog", "pepperoni", "salami",
        "prosciutto", "chorizo", "bratwurst", "kielbasa", "jerky",
        "ribs", "brisket", "roast", "tenderloin", "sirloin", "ribeye"
    ],
    "keto": [
        // Grains and starches
        "bread", "pasta", "rice", "potato", "potatoes", "corn", "oatmeal", "cereal",
        "noodle", "noodles", "tortilla", "pita", "naan", "bagel", "muffin",
        "pancake", "waffle", "croissant", "biscuit", "roll", "bun",
        "couscous", "quinoa", "barley", "farro",
        // Legumes
        "beans", "lentils", "chickpeas", "hummus",
        // High-sugar fruits
        "banana", "apple", "orange", "grape", "grapes", "mango", "pineapple",
        // Sugars
        "sugar", "honey", "syrup", "candy", "chocolate", "cake", "cookie",
        "ice cream", "soda", "juice"
    ],
    "gluten free": [
        // Wheat-based products
        "bread", "pasta", "noodle", "pizza", "sandwich", "wrap", "tortilla",
        "flour", "cake", "pastry", "croissant", "bagel", "muffin",
        "pancake", "waffle", "cracker", "pretzel", "pita", "naan", "ramen",
        "spaghetti", "linguine", "fettuccine", "lasagna", "ravioli", "gnocchi",
        "couscous", "bulgur", "seitan", "breaded", "crusted", "battered",
        // Grains with gluten
        "wheat", "barley", "rye", "spelt", "farro"
    ],
    "dairy free": [
        "cheese", "milk", "cream", "butter", "yogurt", "ice cream", "whey",
        "casein", "ghee", "paneer", "ricotta", "mozzarella", "cheddar",
        "parmesan", "brie", "feta", "gouda", "swiss", "provolone",
        "cream cheese", "sour cream", "cottage cheese", "custard",
        "buttermilk", "half and half", "heavy cream"
    ]
};

// Smart keyword expansion for dislikes
// Maps disliked foods to related search terms, with exclusion patterns for false positives
export const dislikeKeywordExpansions: Record<string, { keywords: string[], exclude?: string[] }> = {
    "bell pepper": {
        keywords: ["bell pepper", "bell peppers", "stuffed pepper", "stuffed peppers"],
        exclude: ["black pepper", "white pepper", "red pepper flakes", "pepper seasoning", "peppercorn", "cayenne pepper"]
    },
    "bell peppers": {
        keywords: ["bell pepper", "bell peppers", "stuffed pepper", "stuffed peppers"],
        exclude: ["black pepper", "white pepper", "red pepper flakes", "pepper seasoning", "peppercorn", "cayenne pepper"]
    },
    "mushroom": {
        keywords: ["mushroom", "mushrooms", "portobello", "shiitake", "cremini"],
        exclude: ["mushroom powder", "mushroom extract", "mushroom broth"]
    },
    "mushrooms": {
        keywords: ["mushroom", "mushrooms", "portobello", "shiitake", "cremini"],
        exclude: ["mushroom powder", "mushroom extract", "mushroom broth"]
    },
    "onion": {
        keywords: ["onion", "onions", "yellow onion", "white onion", "red onion", "sweet onion"],
        exclude: ["onion powder", "onion salt", "onion seasoning"]
    },
    "onions": {
        keywords: ["onion", "onions", "yellow onion", "white onion", "red onion", "sweet onion"],
        exclude: ["onion powder", "onion salt", "onion seasoning"]
    },
    "tomato": {
        keywords: ["tomato", "tomatoes", "fresh tomato", "sliced tomato", "diced tomato", "cherry tomato"],
        exclude: ["tomato sauce", "tomato paste", "ketchup", "marinara", "tomato powder"]
    },
    "tomatoes": {
        keywords: ["tomato", "tomatoes", "fresh tomato", "sliced tomato", "diced tomato", "cherry tomato"],
        exclude: ["tomato sauce", "tomato paste", "ketchup", "marinara", "tomato powder"]
    }
};

export type ConflictResult = {
    hasConflict: boolean;
    conflicts: {
        type: "allergy" | "sensitivity" | "diet" | "diet_restricted" | "dislike";
        restriction: string;
        matchedKeyword: string;
        person?: string; // Name of the person (undefined = primary user, string = family member name)
    }[];
};

// Simplified family member dietary data for conflict checking
export type FamilyMemberRestrictions = {
    name: string;
    allergies: string[];
    sensitivities: string[];
    dietType?: string;
    blockedIngredients: string[];
    blockedGroups: string[];
    dislikes: string[];
};

// Words that negate or exclude ingredients
const negatingPhrases = [
    // Direct exclusions
    "without",
    "no ",
    "skip ",
    "hold the",
    "minus",
    "except",
    "excluding",
    "exclude",

    // Removal requests
    "leave out",
    "leave off",
    "remove",
    "omit",
    "cut the",
    "drop the",
    "lose the",
    "ditch the",
    "nix the",
    "86 ",  // restaurant slang for "remove"

    // Substitution requests
    "substitute",
    "swap out",
    "swap the",
    "replace",
    "instead of",
    "in place of",
    "rather than",

    // Avoidance language
    "avoid",
    "staying away from",
    "stay away from",
    "keep away from",
    "steer clear of",

    // Negation words
    "not ",
    "never ",
    "none of",
    "nothing with",

    // Dietary labels
    "free",  // as in "gluten free", "dairy free"
    "-free", // as in "gluten-free"

    // Preference expressions
    "don't want",
    "dont want",
    "don't like",
    "dont like",
    "don't include",
    "dont include",
    "don't add",
    "dont add",
    "don't need",
    "dont need",
    "do not want",
    "do not include",
    "can't have",
    "cant have",
    "can't eat",
    "cant eat",
    "cannot have",
    "cannot eat",
    "shouldn't have",
    "shouldnt have",
    "not a fan of",
    "hate ",
    "dislike",

    // Medical/dietary reasons
    "allergic to",
    "allergy to",
    "intolerant to",
    "intolerance to",
    "sensitive to",
    "sensitivity to",
    "react to",
    "reaction to",

    // Limiting language
    "limit ",
    "limiting",
    "reduce ",
    "reducing",
    "less ",
    "low ",
    "lower ",
    "cut back on",
    "cutting out",
    "cut out",
    "eliminate",
    "eliminating",
];

/**
 * Check if a keyword match in the prompt is negated (e.g., "without steak")
 * Returns true if the keyword appears to be excluded/negated
 */
function isKeywordNegated(promptLower: string, keyword: string): boolean {
    const keywordLower = keyword.toLowerCase();
    const keywordIndex = promptLower.indexOf(keywordLower);

    if (keywordIndex === -1) return false;

    // Get the text before the keyword (up to 30 chars for context)
    const startIndex = Math.max(0, keywordIndex - 30);
    const textBefore = promptLower.substring(startIndex, keywordIndex);

    // Check if any negating phrase appears before the keyword
    for (const phrase of negatingPhrases) {
        if (textBefore.includes(phrase)) {
            return true;
        }
    }

    return false;
}

/**
 * Check if a keyword is present in the prompt and NOT negated
 */
function keywordPresentAndNotNegated(promptLower: string, keyword: string): boolean {
    const keywordLower = keyword.toLowerCase();
    if (!promptLower.includes(keywordLower)) {
        return false;
    }
    return !isKeywordNegated(promptLower, keyword);
}

/**
 * Check a single person's restrictions against the prompt
 */
function checkPersonRestrictions(
    promptLower: string,
    allergies: string[],
    sensitivities: string[],
    dietType: string | undefined,
    customBlockedIngredients: string[],
    customBlockedGroups: string[],
    dislikes: string[],
    personName?: string // undefined = primary user
): ConflictResult["conflicts"] {
    const conflicts: ConflictResult["conflicts"] = [];

    // Check allergies (most critical)
    for (const allergy of allergies) {
        const allergyLower = allergy.toLowerCase();
        const keywords = sensitivityKeywords[allergyLower] || [];

        for (const keyword of keywords) {
            if (keywordPresentAndNotNegated(promptLower, keyword)) {
                conflicts.push({
                    type: "allergy",
                    restriction: allergy,
                    matchedKeyword: keyword,
                    person: personName
                });
                break; // Only report first match per allergy
            }
        }

        // Also check if the allergy name itself is in the prompt
        if (keywordPresentAndNotNegated(promptLower, allergy)) {
            const alreadyFound = conflicts.some(
                c => c.type === "allergy" && c.restriction === allergy && c.person === personName
            );
            if (!alreadyFound) {
                conflicts.push({
                    type: "allergy",
                    restriction: allergy,
                    matchedKeyword: allergy,
                    person: personName
                });
            }
        }
    }

    // Check sensitivities
    for (const sensitivity of sensitivities) {
        const sensitivityLower = sensitivity.toLowerCase();
        const keywords = sensitivityKeywords[sensitivityLower] || [];

        for (const keyword of keywords) {
            if (keywordPresentAndNotNegated(promptLower, keyword)) {
                conflicts.push({
                    type: "sensitivity",
                    restriction: sensitivity,
                    matchedKeyword: keyword,
                    person: personName
                });
                break;
            }
        }

        // Also check if the sensitivity name itself is in the prompt
        if (keywordPresentAndNotNegated(promptLower, sensitivity)) {
            const alreadyFound = conflicts.some(
                c => c.type === "sensitivity" && c.restriction === sensitivity && c.person === personName
            );
            if (!alreadyFound) {
                conflicts.push({
                    type: "sensitivity",
                    restriction: sensitivity,
                    matchedKeyword: sensitivity,
                    person: personName
                });
            }
        }
    }

    // Check diet type conflicts
    if (dietType) {
        const dietLower = dietType.toLowerCase();
        const dietConflictKeywords = dietTypeConflicts[dietLower] || [];

        for (const keyword of dietConflictKeywords) {
            if (keywordPresentAndNotNegated(promptLower, keyword)) {
                conflicts.push({
                    type: "diet",
                    restriction: dietType,
                    matchedKeyword: keyword,
                    person: personName
                });
                break;
            }
        }
    }

    // Check custom blocked ingredients
    for (const blocked of customBlockedIngredients) {
        if (keywordPresentAndNotNegated(promptLower, blocked)) {
            conflicts.push({
                type: "diet_restricted",
                restriction: `Restricted: ${blocked}`,
                matchedKeyword: blocked,
                person: personName
            });
        }
    }

    // Check custom blocked groups
    for (const group of customBlockedGroups) {
        if (keywordPresentAndNotNegated(promptLower, group)) {
            conflicts.push({
                type: "diet_restricted",
                restriction: `Restricted group: ${group}`,
                matchedKeyword: group,
                person: personName
            });
        }
    }

    // Check dislikes with smart keyword expansion
    for (const dislike of dislikes) {
        const dislikeLower = dislike.toLowerCase();
        const expansion = dislikeKeywordExpansions[dislikeLower];

        if (expansion) {
            // Use expanded keywords with exclusion patterns
            const { keywords, exclude = [] } = expansion;

            for (const keyword of keywords) {
                if (keywordPresentAndNotNegated(promptLower, keyword)) {
                    // Check if this match should be excluded (e.g., "black pepper" when dislike is "bell pepper")
                    let shouldExclude = false;
                    for (const excludePattern of exclude) {
                        if (promptLower.includes(excludePattern.toLowerCase())) {
                            shouldExclude = true;
                            break;
                        }
                    }

                    if (!shouldExclude) {
                        conflicts.push({
                            type: "dislike",
                            restriction: `Disliked food: ${dislike}`,
                            matchedKeyword: keyword,
                            person: personName
                        });
                        break; // Only report first match per dislike
                    }
                }
            }
        } else {
            // No expansion defined, use direct matching
            if (keywordPresentAndNotNegated(promptLower, dislike)) {
                conflicts.push({
                    type: "dislike",
                    restriction: `Disliked food: ${dislike}`,
                    matchedKeyword: dislike,
                    person: personName
                });
            }
        }
    }

    return conflicts;
}

/**
 * Check if a user's prompt conflicts with their dietary restrictions
 * and those of their family members
 */
export function checkPromptForConflicts(
    prompt: string,
    allergies: string[],
    sensitivities: string[],
    dietType?: string,
    customBlockedIngredients?: string[],
    customBlockedGroups?: string[],
    dislikes?: string[],
    familyMembers?: FamilyMemberRestrictions[]
): ConflictResult {
    const promptLower = prompt.toLowerCase();
    const conflicts: ConflictResult["conflicts"] = [];

    // Check primary user's restrictions
    const primaryUserConflicts = checkPersonRestrictions(
        promptLower,
        allergies,
        sensitivities,
        dietType,
        customBlockedIngredients || [],
        customBlockedGroups || [],
        dislikes || [],
        undefined // primary user has no name attribution
    );
    conflicts.push(...primaryUserConflicts);

    // Check each family member's restrictions
    if (familyMembers) {
        for (const member of familyMembers) {
            const memberConflicts = checkPersonRestrictions(
                promptLower,
                member.allergies,
                member.sensitivities,
                member.dietType,
                member.blockedIngredients,
                member.blockedGroups,
                member.dislikes,
                member.name
            );
            conflicts.push(...memberConflicts);
        }
    }

    return {
        hasConflict: conflicts.length > 0,
        conflicts
    };
}

/**
 * Generate a user-friendly message about the conflicts found
 */
export function formatConflictMessage(conflicts: ConflictResult["conflicts"]): string {
    if (conflicts.length === 0) return "";

    const allergyConflicts = conflicts.filter(c => c.type === "allergy");
    const sensitivityConflicts = conflicts.filter(c => c.type === "sensitivity");
    const dietConflicts = conflicts.filter(c => c.type === "diet");
    const customRestrictionConflicts = conflicts.filter(c => c.type === "diet_restricted");

    const parts: string[] = [];

    if (allergyConflicts.length > 0) {
        const items = allergyConflicts.map(c => `"${c.matchedKeyword}" (${c.restriction} allergy)`);
        parts.push(`Allergy warning: ${items.join(", ")}`);
    }

    if (customRestrictionConflicts.length > 0) {
        const items = customRestrictionConflicts.map(c => `"${c.matchedKeyword}"`);
        parts.push(`Restricted: ${items.join(", ")}`);
    }

    if (sensitivityConflicts.length > 0) {
        const items = sensitivityConflicts.map(c => `"${c.matchedKeyword}" (${c.restriction})`);
        parts.push(`Sensitivity: ${items.join(", ")}`);
    }

    if (dietConflicts.length > 0) {
        const items = dietConflicts.map(c => `"${c.matchedKeyword}" conflicts with ${c.restriction} diet`);
        parts.push(items.join(", "));
    }

    return parts.join("\n");
}

/**
 * Check which diets a list of ingredients complies with
 * Returns a list of diet names (e.g. "vegan", "keto")
 */
export function getCompliantDiets(ingredients: { name: string }[]): string[] {
    const compliantDiets: string[] = [];

    // Get all defined diets
    const diets = Object.keys(dietTypeConflicts);

    for (const diet of diets) {
        let isCompliant = true;
        const conflicts = dietTypeConflicts[diet] || [];

        // Check if any ingredient conflicts with this diet
        for (const ingredient of ingredients) {
            const ingredientLower = ingredient.name.toLowerCase();

            // Check against each conflict keyword for this diet
            for (const conflictKeyword of conflicts) {
                // We use simple inclusion checking here
                // Ideally this would reuse the more robust keyword matching from checkPersonRestrictions
                // but we want to be conservative for auto-badging
                if (ingredientLower.includes(conflictKeyword.toLowerCase())) {
                    isCompliant = false;
                    break;
                }
            }

            if (!isCompliant) break;
        }

        if (isCompliant) {
            compliantDiets.push(diet);
        }
    }

    return compliantDiets;
}
