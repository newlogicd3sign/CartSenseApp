# CartSense Feature & Business Logic Specification

This document details all features, their business rules, and implementation logic for Flutter mobile app development.

---

## Table of Contents

1. [Core Features Overview](#core-features-overview)
2. [Authentication & Onboarding](#authentication--onboarding)
3. [Meal Generation](#meal-generation)
4. [Dietary Conflict Detection](#dietary-conflict-detection)
5. [Meal Editing (AI Chat)](#meal-editing-ai-chat)
6. [Saved Meals](#saved-meals)
7. [Fresh Picks (Recommendations)](#fresh-picks-recommendations)
8. [Shopping List Management](#shopping-list-management)
9. [Kroger Integration](#kroger-integration)
10. [Preference Learning System](#preference-learning-system)
11. [Subscription & Payments](#subscription--payments)
12. [Sharing System](#sharing-system)
13. [Family Management](#family-management)
14. [Diet Instructions](#diet-instructions)

---

## Core Features Overview

| Feature | Free Tier | Premium (Individual) | Premium (Family) |
|---------|-----------|---------------------|------------------|
| Meal generations | 10/month | Unlimited | Unlimited |
| AI chat edits | 6/month | Unlimited | Unlimited |
| Fresh Picks | Requires 5+ saved meals | Same | Same |
| Saved meals | Unlimited | Unlimited | Unlimited |
| Shopping lists | Unlimited | Unlimited | Unlimited |
| Kroger integration | Full | Full | Full |
| Diet instructions | No | Yes | Yes |
| Family members | 0 | 0 | Up to 5 |
| Price | Free | $9.99/mo or $79.99/yr | $14.99/mo or $119.99/yr |

---

## Authentication & Onboarding

### Auth Flow

```
1. Sign Up
   ├── Enter email + password
   ├── Create Firebase Auth user
   ├── Send verification email (via Resend API)
   └── Show "Check your email" screen

2. Email Verification
   ├── User clicks link in email
   ├── Firestore user doc created with emailVerified: true
   └── Redirect to login

3. Login
   ├── Firebase Auth sign in
   ├── Check emailVerified flag
   │   ├── If false → Redirect to verification screen
   │   └── If true → Continue
   └── Redirect to Setup (first time) or Home

4. Setup Wizard (First-time users)
   ├── Step 1: Diet type selection
   ├── Step 2: Allergies & sensitivities
   ├── Step 3: Cooking experience level
   ├── Step 4: Kroger account linking (optional)
   └── Step 5: Store selection (if Kroger linked)
```

### Setup Screen Data Collection

```typescript
// Collected during onboarding
{
  dietType: "none" | "vegetarian" | "vegan" | "keto" | "paleo" |
            "gluten-free" | "pescatarian" | "mediterranean";

  cookingExperience: "beginner" | "intermediate" | "advanced";

  allergiesAndSensitivities: {
    allergies: string[];      // Life-threatening
    sensitivities: string[];  // Non-critical
  };

  dislikedFoods: string[];
}
```

---

## Meal Generation

### Prompt Processing Flow

```
User enters prompt
        │
        ▼
┌───────────────────┐
│ Domain Validation │ → Block non-food requests
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Content Moderation│ → OpenAI moderation API
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Conflict Detection│ → Check allergies/diet
└───────────────────┘   → Show warning modal if conflict
        │
        ▼
┌───────────────────┐
│ Check Free Tier   │ → If limit reached, show upgrade
│      Limit        │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Load User Context │ → Preferences, family, recent meals
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Generate Meals   │ → OpenAI GPT-4o-mini streaming
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Validate Meals    │ → Check against all restrictions
└───────────────────┘   → Filter out violating meals
        │
        ▼
┌───────────────────┐
│ Generate Images   │ → DALL-E 2 → Cloudinary (permanent)
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Log Events        │ → Track for preference learning
└───────────────────┘
```

### Request Types Detection

```typescript
// Broad meal plan request (returns 4-7 varied meals)
function isBroadMealPlanRequest(prompt: string): boolean {
  const broadPatterns = [
    /meal\s*plan/i,
    /week('s)?\s*(worth|of)?\s*meals?/i,
    /daily\s*meals?/i,
    /full\s*day/i,
    /breakfast.*lunch.*dinner/i,
    /what\s*(should|can)\s*i\s*eat/i,
  ];
  // Returns true if matches broad pattern AND no specific ingredient
}

// Specific recipe request (returns 3-4 similar options)
// e.g., "chicken dinners", "salmon recipes", "pasta dishes"
```

### Meal Output Structure

```typescript
type Meal = {
  id: string;                    // UUID generated server-side
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  description: string;           // 1 sentence max
  servings: number;              // Default to household size
  macros: {
    calories: number;            // Per serving
    protein: number;
    carbs: number;
    fiber: number;
    fat: number;
  };
  ingredients: Ingredient[];
  steps: string[];               // 5-7 detailed steps
  imageUrl?: string;             // Cloudinary URL
  cookTimeRange?: {
    min: number;                 // Minutes
    max: number;
  };
  estimatedCost?: number;        // USD, rounded to nearest $5
};
```

### Ingredient Rules

```typescript
// grocerySearchTerm MUST be raw, uncooked product
// Examples:
//   "Grilled Chicken" → grocerySearchTerm: "boneless skinless chicken breast"
//   "Diced Tomatoes" → grocerySearchTerm: "roma tomatoes"
//   "Ground Chicken" → grocerySearchTerm: "ground chicken" (NOT "chicken breast")

type Ingredient = {
  name: string;           // Display name with preparation
  quantity: string;       // For 1 serving
  grocerySearchTerm: string;  // Raw product for Kroger search
  preparation?: string;   // "diced", "minced", etc.
};
```

### Cooking Experience Guidance

```typescript
// Beginner
// - Simple techniques: boiling, baking, pan-frying
// - 5-7 ingredients max
// - Avoid complex knife work
// - Clear, detailed steps

// Intermediate
// - Can handle sautéing, roasting, sauces
// - 8-12 ingredients
// - Multi-step recipes

// Advanced
// - Complex techniques: braising, reduction sauces
// - Intricate recipes with many components
```

### Pantry Mode

When enabled, generates recipes using ONLY ingredients the user lists, plus basic staples (salt, pepper, oil). Does not suggest additional purchases.

### Variety Tracking

```typescript
// System tracks last 14 days of meal names
// AI instructed to NOT repeat exact recipes
// CAN reuse same ingredients in different dishes
// e.g., If "Honey Garlic Chicken" was recent, can still suggest
//       "Lemon Herb Chicken" or "Chicken Stir Fry"
```

---

## Dietary Conflict Detection

### Pre-Submission Validation

Before meal generation, check if user's prompt conflicts with their restrictions:

```typescript
function checkPromptForConflicts(
  prompt: string,
  allergies: string[],
  sensitivities: string[],
  dietType?: string,
  customBlockedIngredients?: string[],
  customBlockedGroups?: string[],
  dislikes?: string[],
  familyMembers?: FamilyMemberRestrictions[]
): ConflictResult;
```

### Conflict Types

| Type | Severity | Behavior |
|------|----------|----------|
| `allergy` | Critical | Block generation, require explicit override |
| `diet_restricted` | Critical | Block generation, require explicit override |
| `sensitivity` | Warning | Show warning, allow proceed |
| `diet` | Warning | Show warning, allow proceed |
| `dislike` | Notice | Show notice, allow proceed |

### Negation Detection

System detects when user is EXCLUDING an ingredient:

```typescript
// These phrases negate the ingredient that follows:
const negatingPhrases = [
  "without", "no ", "skip ", "hold the", "minus",
  "leave out", "remove", "omit", "don't include",
  "allergic to", "can't have", "avoiding",
  // ... and more
];

// "chicken without peanuts" → peanuts is EXCLUDED, not a conflict
// "peanut butter chicken" → peanuts IS present, potential conflict
```

### Sensitivity Keyword Mapping

```typescript
// Each allergy/sensitivity maps to multiple keywords
const sensitivityKeywords = {
  "dairy": ["milk", "cheese", "yogurt", "butter", "cream", "whey", "casein", ...],
  "eggs": ["egg", "eggs", "omelette", "mayonnaise", "aioli", ...],
  "peanuts": ["peanut", "peanuts", "peanut butter", "groundnut"],
  "shellfish": ["shrimp", "crab", "lobster", "clam", "scallop", "prawn", ...],
  // ... etc
};
```

### Diet Type Conflicts

```typescript
const dietTypeConflicts = {
  "vegetarian": [
    // All meats including fish
    "chicken", "beef", "pork", "fish", "shrimp", ...
  ],
  "vegan": [
    // All animal products
    ...vegetarianConflicts,
    "cheese", "milk", "egg", "honey", ...
  ],
  "keto": [
    // High-carb foods
    "bread", "pasta", "rice", "potato", "sugar", "banana", ...
  ],
  "gluten free": [
    "bread", "pasta", "flour", "wheat", "couscous", "seitan", ...
  ],
  // ... etc
};
```

### Dislike Handling (Semantic)

```typescript
// User dislikes are handled semantically:
// "tomatoes" → blocks whole/raw tomatoes
//           → ALLOWS tomato sauce, paste, ketchup
// "mushrooms" → blocks all whole mushrooms
//            → ALLOWS mushroom powder/broth
// "onions" → blocks raw/chunky onions
//         → ALLOWS onion powder

// Rule: If disliked item creates TEXTURE or VISIBLE PIECES = banned
//       Smooth/indistinguishable processed forms = allowed
```

---

## Meal Editing (AI Chat)

### Chat Flow

```
User views meal detail
        │
        ▼
Opens chat interface
        │
        ▼
Enters modification request
  (e.g., "make it spicier", "swap chicken for tofu")
        │
        ▼
┌───────────────────┐
│ Check Chat Quota  │ → Free: 6/month, Premium: unlimited
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Send to OpenAI    │ → Include meal, prefs, history
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Validate Changes  │ → Check against restrictions
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Log Events        │ → Track ingredient add/remove
└───────────────────┘
        │
        ▼
Return updated meal (or reply if no change needed)
```

### Response Actions

```typescript
type MealThreadReply = {
  reply: string;                    // Explanation of changes
  action: "no_change" | "update_meal" | "new_meal_variant";
  updatedMeal?: Meal;               // Present if action != no_change
  dietaryWarnings?: DietaryViolation[];  // If any
};

// Actions:
// "no_change" - Request doesn't require changes (e.g., "looks good!")
// "update_meal" - Minor edits to existing meal
// "new_meal_variant" - Major change, essentially new recipe
```

### Event Logging for Chat

```typescript
// When meal is edited, log these events:
MEAL_EDITED       // General edit event
INGREDIENT_ADDED  // For each new ingredient
INGREDIENT_REMOVED // For each removed ingredient

// These events feed into preference learning
```

---

## Saved Meals

### Save Flow

```
User views generated meal
        │
        ▼
Taps "Save" button
        │
        ▼
┌───────────────────┐
│ Create savedMeals │ → Copy meal data + savedAt timestamp
│     document      │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Log MEAL_SAVED    │ → For preference learning
│      event        │
└───────────────────┘
```

### Saved Meal Data

```typescript
// savedMeals/{uid}/meals/{mealId}
{
  ...mealData,           // All meal fields
  savedAt: Timestamp,    // When saved
  prompt?: string,       // Original generation prompt
  source?: "prompt" | "shared_link",
  originalShareId?: string,  // If from shared link
  sharerId?: string,     // Who shared it
}
```

### Saved Meals Screen Features

- Search by meal name
- Filter by meal type
- Sort by date saved
- Delete meals
- Quick re-cook (add to shopping list)
- Share meals

---

## Fresh Picks (Recommendations)

### Unlock Requirements

- User must have 5+ saved meals
- Premium feature indicator but available to all

### Generation Flow

```
User navigates to Fresh Picks
        │
        ▼
┌───────────────────┐
│ Check Cache       │ → If < 24 hours old, serve cached
└───────────────────┘
        │
        ▼ (cache miss or expired)
┌───────────────────┐
│ Check Saved Count │ → If < 5, show unlock message
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Load User Data    │ → Saved meals, feedback history
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Generate with AI  │ → Based on saved meal patterns
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Cache Results     │ → Valid for 24 hours
└───────────────────┘
        │
        ▼
Return 4 meals (breakfast, lunch, dinner, snack)
```

### Feedback System

```typescript
// User can like/dislike Fresh Pick meals
// Feedback stored in users/{uid}/mealFeedback

// Liked meals → Future picks will be MORE similar
// Disliked meals → Future picks will AVOID similar patterns
```

### Cache Behavior

- Fresh Picks cached for 24 hours per user
- When user provides feedback, that meal is filtered from cache
- Full regeneration on cache expiry

---

## Shopping List Management

### Add to Shopping List Flow

```
User taps "Add to Cart" on meal
        │
        ▼
┌───────────────────┐
│ Extract Ingredients│ → From meal.ingredients
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Filter Excluded   │ → Remove water, ice, etc.
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Check Duplicates  │ → Against existing shopping list
└───────────────────┘
        │
        ├── If STAPLE (oil, spices) → Skip if already exists
        │
        └── If COUNTABLE (produce, protein) → Combine quantities
                │
                ▼
┌───────────────────┐
│ Add/Update Items  │ → In shoppingLists/{uid}/items
└───────────────────┘
```

### Ingredient Categories

```typescript
// EXCLUDED - Never add to shopping list
const EXCLUDED_INGREDIENTS = [
  "water", "cold water", "warm water", "ice", "ice cubes", ...
];

// STAPLES - Skip duplicates (buy once)
const STAPLE_ITEMS = [
  // Oils
  "olive oil", "vegetable oil", "coconut oil", ...
  // Spices
  "salt", "pepper", "garlic powder", "cumin", "paprika", ...
  // Condiments
  "soy sauce", "ketchup", "mustard", ...
  // Baking
  "flour", "sugar", "baking powder", ...
];

// COUNTABLE - Combine quantities
// Everything else (produce, proteins, dairy)
```

### Quantity Aggregation

```typescript
// When same ingredient appears multiple times:
// 1. Normalize names: "chicken breast" = "boneless skinless chicken breast"
// 2. Parse quantities: "2 lbs", "12 oz", "6 eggs"
// 3. Convert to base units: weight → oz, volume → fl oz, count → count
// 4. Sum and round up
// 5. Store combined total

// Example:
// Meal 1: "1 lb chicken breast"
// Meal 2: "12 oz chicken breast"
// Combined: "1.75 lbs chicken breast" → rounds to "2 lbs"
```

### Shopping List Item Structure

```typescript
{
  name: string;              // Ingredient name
  quantity: string;          // Total quantity needed
  count: number;             // Times ingredient appears
  checked: boolean;          // User marked as purchased

  mealId?: string;           // Source meal (latest)
  mealName?: string;
  mealImageUrl?: string;

  // Kroger enrichment (added after Kroger enrich)
  krogerProductId?: string;
  productName?: string;
  productImageUrl?: string;
  price?: number;
  stockLevel?: string;

  createdAt: Timestamp;
}
```

---

## Kroger Integration

### OAuth Flow

```
User taps "Connect Kroger"
        │
        ▼
Redirect to Kroger OAuth
(with userId in state param)
        │
        ▼
User logs in to Kroger
        │
        ▼
Kroger redirects to /api/kroger/callback
        │
        ▼
┌───────────────────┐
│ Verify State      │ → CSRF protection
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Exchange Code     │ → Get access + refresh tokens
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Store Tokens      │ → Encrypted in Firestore
└───────────────────┘
        │
        ▼
Redirect to app with success
```

### Token Refresh

```typescript
// Tokens expire after ~30 minutes
// Before each API call:
// 1. Check if expiresAt < now + 5 minutes buffer
// 2. If expired, call refresh endpoint
// 3. Store new tokens
// 4. Proceed with API call

// If refresh fails → Mark account as unlinked
```

### Product Search & Matching

```typescript
// Product Engine features:
// 1. Intelligent search with spelling corrections
// 2. Quality scoring to find best match
// 3. Rate limiting (Kroger limits: 10/sec, 10,000/hour)
// 4. Circuit breaker for API failures
// 5. 24-hour caching layer

// Search flow:
// 1. Normalize ingredient name
// 2. Check cache
// 3. If miss, search Kroger API
// 4. Score results by relevance
// 5. Return best match with stock/price
```

### Add to Cart Calculation

```typescript
// calculateUnitsNeeded(recipeQty, productSize, soldBy, itemCount)

// For WEIGHT products (deli counter):
// Recipe: "2 lbs chicken" → Add 2.0 lbs to cart

// For UNIT products (packaged):
// Recipe: "2 lbs chicken", Product: "1 lb package"
// → Need 2 units

// Handles unit conversions:
// oz ↔ lbs, cups ↔ fl oz, count-based items
```

### Store Brand Detection

```typescript
// Kroger family of stores:
const KROGER_STORE_BRANDS = {
  "kroger": { displayName: "Kroger", cartUrl: "kroger.com/cart" },
  "smith's": { displayName: "Smith's", cartUrl: "smithsfoodanddrug.com/cart" },
  "ralphs": { displayName: "Ralphs", cartUrl: "ralphs.com/cart" },
  "fred meyer": { displayName: "Fred Meyer", cartUrl: "fredmeyer.com/cart" },
  // ... 15+ more brands
};

// Display correct brand name and cart URL based on user's store
```

---

## Preference Learning System

### Event Types & Weights

```typescript
const SCORE_WEIGHTS = {
  MEAL_GENERATED: 0,      // Neutral
  MEAL_ACCEPTED: 1,       // User used the meal
  MEAL_REJECTED: -2,      // User skipped/rejected
  MEAL_SAVED: 2,          // User saved to favorites
  MEAL_REPEATED: 3,       // User cooked same meal again
  MEAL_EDITED: 0,         // Neutral (edits tracked separately)
  INGREDIENT_ADDED: 1.5,  // Added via chat
  INGREDIENT_REMOVED: -1.5, // Removed via chat
  INGREDIENT_SWAPPED: 0,  // from -1, to +1
  CART_ADDED: 0.5,        // Added to shopping cart
  CART_REMOVED: -0.5,     // Removed from cart
  PRODUCT_SWAPPED: 0,     // from -1, to +1
};
```

### Preference Lock Overrides

```typescript
const LOCK_BOOSTS = {
  ALWAYS_INCLUDE: 10,   // Strong positive
  NEVER_INCLUDE: -10,   // Strong negative
  PREFER: 5,            // Moderate positive
  AVOID: -5,            // Moderate negative
};

// User can explicitly set locks via UI
// Locks override learned preferences
```

### Aggregation Logic

```typescript
// Every 90 days of events aggregated into:
{
  ingredientScores: {
    "chicken_breast": 8,   // User likes
    "mushroom": -5,        // User avoids
  },
  tagScores: {
    "quick": 10,           // Prefers quick recipes
    "spicy": 2,            // Slightly prefers spicy
  },
  contextScores: {
    "dinner|weekday|family": {
      ingredientScores: {...},
      tagScores: {...}
    }
  }
}

// Only scores with |value| >= 1 are kept
```

### Usage in Meal Generation

```typescript
// Preferences passed to AI prompt:
// - preferredIngredients: top 10 positive-scoring
// - avoidIngredients: top 10 negative-scoring
// - preferredTags: top 5 positive-scoring
// - avoidTags: top 5 negative-scoring

// These are SOFT preferences, not hard blocks
// AI prioritizes but doesn't force
```

---

## Subscription & Payments

### Plan Tiers

```typescript
const PLANS = {
  free: {
    price: 0,
    promptLimit: 10,        // Per month
    chatLimit: 6,           // Per month
    familyMembers: 0,
    dietInstructions: false,
  },
  individual: {
    priceMonthly: 9.99,
    priceYearly: 79.99,     // ~33% savings
    promptLimit: Infinity,
    chatLimit: Infinity,
    familyMembers: 0,
    dietInstructions: true,
  },
  family: {
    priceMonthly: 14.99,
    priceYearly: 119.99,    // ~33% savings
    promptLimit: Infinity,
    chatLimit: Infinity,
    familyMembers: 5,
    dietInstructions: true,
  }
};
```

### Usage Tracking

```typescript
// Free tier limits tracked per user:
{
  monthlyPromptCount: number;     // Resets every 30 days
  promptPeriodStart: Timestamp;   // When period started
  monthlyChatCount: number;       // Resets every 30 days
  chatPeriodStart: Timestamp;
}

// Check before generation:
if (!isPremium && monthlyPromptCount >= 10) {
  // Show upgrade prompt
  // Calculate days until reset
}
```

### Webhook Events

```typescript
// Stripe webhooks handled:
"checkout.session.completed" → Activate subscription
"customer.subscription.updated" → Handle plan changes
"customer.subscription.deleted" → Downgrade to free
"invoice.payment_failed" → Mark payment issue
```

---

## Sharing System

### Share Flow

```
User taps "Share" on meal
        │
        ▼
┌───────────────────┐
│ Create sharedMeals│ → Sanitized meal data (no user info)
│     document      │
└───────────────────┘
        │
        ▼
Generate share URL: /share/{shareId}
        │
        ▼
Show share options:
  - Copy link
  - Share to Facebook
  - Share to Twitter
  - Email
```

### Public Share Page

```
Non-logged-in user visits /share/{shareId}
        │
        ▼
┌───────────────────┐
│ Load sharedMeals  │ → Public read access
│     document      │
└───────────────────┘
        │
        ▼
Display meal preview:
  - Name, description
  - Image
  - Macros
  - Ingredients (without Kroger data)
  - Prep time
        │
        ▼
CTA: "Sign up to save this meal!"
```

### Claim Flow (Logged-in User)

```
Logged-in user visits /share/{shareId}
        │
        ▼
Show meal preview + "Save to My Meals" button
        │
        ▼
On save → Copy to user's savedMeals with:
  - source: "shared_link"
  - originalShareId: shareId
  - sharerId: original sharer's uid
```

---

## Family Management

### Add Family Member

```
User navigates to Account → Family
        │
        ▼
Taps "Add Family Member"
        │
        ▼
Fill in details:
  - Name
  - Diet type (optional)
  - Allergies (optional)
  - Sensitivities (optional)
  - Dislikes (optional)
        │
        ▼
Create familyMembers subcollection doc
        │
        ▼
Toggle isActive to include in meal generation
```

### Restriction Combination

```typescript
// During meal generation, ALL active family members' restrictions are combined:

function combineFamilyRestrictions(
  userDoc,
  userDietContext,
  familyMembers
): CombinedDietaryRestrictions {
  return {
    householdMembers: [...],
    combinedAllergies: union of all allergies,
    combinedSensitivities: union of all sensitivities,
    combinedDislikes: union of all dislikes,
    combinedBlockedIngredients: union of all blocked,
    combinedBlockedGroups: union of all groups,
    dietTypes: all unique diet types,
    cookingExperience: primary user's level,
  };
}

// Generated meals must satisfy ALL restrictions from ALL active members
```

### Conflict Attribution

```typescript
// When conflict detected, show which family member has the restriction:
{
  type: "allergy",
  restriction: "peanuts",
  matchedKeyword: "peanut butter",
  person: "Sarah"  // Family member name, or undefined for primary user
}

// UI shows: "Sarah is allergic to peanuts"
```

---

## Diet Instructions

### Upload Flow

```
User navigates to Account → Diet Instructions
        │
        ▼
Taps "Upload Photo(s)"
        │
        ▼
Select 1-5 photos of diet instructions
        │
        ▼
┌───────────────────┐
│ Convert to base64 │ → Data URLs
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Send to OCR API   │ → GPT-4o-mini vision
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Parse restrictions│ → Extract ingredients & groups
└───────────────────┘
        │
        ▼
Return structured data:
  - blockedIngredients: ["bacon", "sausage", ...]
  - blockedFoodGroups: ["fried foods", "red meat", ...]
  - instructionsSummary: "Heart-healthy diet with low sodium..."
        │
        ▼
User reviews and confirms
        │
        ▼
Save to user doc:
  dietInstructions: {
    hasActiveNote: true,
    blockedIngredients: [...],
    blockedGroups: [...],
    summaryText: "...",
    sourceType: "photo"
  }
```

### Usage in Meal Generation

```typescript
// When hasActiveNote is true:
// 1. Load blocked ingredients and groups
// 2. Add to system prompt as STRICT restrictions
// 3. Post-validate generated meals
// 4. Show "Diet Guardrails Active" badge in UI
// 5. Filter out any meals that violate restrictions
```

---

## Implementation Notes for Flutter

### State Management Recommendations

```dart
// Recommended: Riverpod for state management

// Providers to create:
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>(...);
final userProvider = StreamProvider<UserProfile?>(...);
final savedMealsProvider = StreamProvider<List<Meal>>(...);
final shoppingListProvider = StreamProvider<List<ShoppingItem>>(...);
final preferencesProvider = FutureProvider<PreferenceProfile?>(...);
```

### Offline Support

```dart
// Firestore offline persistence enabled by default on mobile
// Shopping list works offline
// Meal generation requires network

// Handle offline gracefully:
if (!hasNetwork) {
  showSnackbar("You're offline. Meal generation requires internet.");
}
```

### Push Notifications (Future)

```dart
// Consider implementing:
// - Fresh Picks available notification (daily at 8am)
// - Shopping list reminder
// - New shared meal received
```

### Deep Linking

```dart
// Handle these deep links:
// /share/{shareId} → Open shared meal
// /meals/{mealId} → Open saved meal
// /upgrade → Open upgrade page
```

---

*Document generated for Flutter mobile app migration*
