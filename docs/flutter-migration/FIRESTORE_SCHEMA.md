# CartSense Firestore Schema Reference

This document provides a complete reference of all Firestore collections and their document structures for Flutter mobile app development.

---

## Table of Contents

1. [Collection Overview](#collection-overview)
2. [User Data](#user-data)
3. [Meals & Recipes](#meals--recipes)
4. [Shopping & Cart](#shopping--cart)
5. [Preferences & Learning](#preferences--learning)
6. [System Collections](#system-collections)
7. [Security Rules Summary](#security-rules-summary)
8. [Flutter Implementation Notes](#flutter-implementation-notes)

---

## Collection Overview

| Collection Path | Description | Access |
|----------------|-------------|--------|
| `users/{uid}` | User profiles, settings, subscription | User-only |
| `users/{uid}/familyMembers/{memberId}` | Family member profiles | User-only |
| `users/{uid}/mealFeedback/{feedbackId}` | Fresh Picks like/dislike feedback | User-only |
| `users/{uid}/freshPicks/daily` | Cached daily recommendations | User-only |
| `savedMeals/{uid}/meals/{mealId}` | User's saved meals | User-only |
| `shoppingLists/{uid}/items/{itemId}` | Shopping list items | User-only |
| `krogerLocations/{uid}/locations/{locationId}` | Saved Kroger stores | User-only |
| `pantryItems/{uid}/items/{itemId}` | Pantry inventory | User-only |
| `userEvents/{uid}/events/{eventId}` | Legacy user events | User-only (read/create) |
| `foodEvents/{uid}/events/{eventId}` | Food events for preferences | Server-only |
| `preferenceLocks/{uid}/locks/{lockId}` | Explicit preference rules | Server-only |
| `sharedMeals/{shareId}` | Public shared meal links | Server-only |
| `mealImageCache/{documentId}` | Cached meal images | Public read, server write |
| `krogerProductSearchCache/{docId}` | Kroger search cache | Server-only |
| `krogerRateLimits/{key}` | API rate limiting | Server-only |

---

## User Data

### Collection: `users/{uid}`

**Description:** Core user profile with settings, dietary preferences, and subscription status.

```typescript
{
  // Basic Info
  email: string;
  name?: string;
  emailVerified: boolean;
  createdAt: Timestamp;

  // Dietary Preferences
  dietType?: "none" | "vegetarian" | "vegan" | "keto" | "paleo" | "gluten-free" | "pescatarian" | "mediterranean";
  cookingExperience?: "beginner" | "intermediate" | "advanced";

  allergiesAndSensitivities?: {
    allergies?: string[];      // e.g., ["peanuts", "shellfish", "dairy"]
    sensitivities?: string[];  // e.g., ["lactose", "gluten"]
  };

  dislikedFoods?: string[];    // e.g., ["mushrooms", "olives", "cilantro"]

  // Diet Instructions (Premium Feature)
  dietInstructions?: {
    hasActiveNote: boolean;
    sourceType?: "photo" | "manual";
    summaryText?: string;
    blockedIngredients?: string[];   // e.g., ["bacon", "sausage"]
    blockedGroups?: string[];        // e.g., ["fried foods", "red meat"]
    updatedAt?: Timestamp;
  };

  // Shopping Preferences
  shoppingPreference?: "kroger" | "instacart" | "other";
  krogerLinked?: boolean;
  defaultKrogerLocationId?: string;

  // Kroger OAuth Tokens (SERVER-ONLY - do not read from client)
  krogerTokens?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;       // Unix timestamp in ms
    updatedAt: number;
  };

  // Subscription & Billing
  isPremium: boolean;
  planType: "free" | "individual" | "family";
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeSubscriptionStatus?: "active" | "canceled" | "past_due" | "trialing";
  subscriptionCurrentPeriodEnd?: Timestamp;
  premiumSince?: Timestamp;
  previousPlanType?: string;
  canceledAt?: Timestamp;
  hasPaymentIssue?: boolean;
  lastPaymentFailure?: Timestamp;

  // Usage Tracking
  monthlyPromptCount: number;          // Free tier: 10/month
  promptPeriodStart?: Timestamp;       // Resets every 30 days
  monthlyChatCount?: number;           // Free tier: 6/month
  chatPeriodStart?: Timestamp;
}
```

**Flutter Model:**
```dart
class UserProfile {
  final String email;
  final String? name;
  final bool emailVerified;
  final DateTime createdAt;

  final String? dietType;
  final String? cookingExperience;
  final List<String> allergies;
  final List<String> sensitivities;
  final List<String> dislikedFoods;

  final DietInstructions? dietInstructions;

  final String? shoppingPreference;
  final bool krogerLinked;
  final String? defaultKrogerLocationId;

  final bool isPremium;
  final String planType;

  final int monthlyPromptCount;
  final int monthlyChatCount;
}
```

---

### Subcollection: `users/{uid}/familyMembers/{memberId}`

**Description:** Family member profiles for Family plan users. Each member's dietary restrictions are combined during meal generation.

```typescript
{
  name: string;
  isActive: boolean;              // Toggle to include/exclude from meal generation

  dietType?: string;
  allergiesAndSensitivities?: {
    allergies?: string[];
    sensitivities?: string[];
  };
  dislikedFoods?: string[];

  // Family members can also have diet instructions
  dietInstructions?: {
    hasActiveNote?: boolean;
    blockedIngredients?: string[];
    blockedGroups?: string[];
    summaryText?: string;
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Limits:** Family plan supports up to 5 family members.

---

### Subcollection: `users/{uid}/mealFeedback/{feedbackId}`

**Description:** Feedback on Fresh Picks meals (likes/dislikes).

```typescript
{
  mealName: string;
  mealId?: string;           // May be virtual ID for generated meals
  action: "like" | "dislike";
  mealData: {
    name: string;
    description: string;
    ingredients: Ingredient[];
    mealType: string;
    macros: Macros;
  };
  timestamp: Timestamp;
}
```

---

### Subcollection: `users/{uid}/freshPicks/daily`

**Description:** Cached daily Fresh Picks recommendations. Regenerates every 24 hours.

```typescript
{
  meals: Meal[];              // Array of 4 meals (breakfast, lunch, dinner, snack)
  generatedAt: Timestamp;
}
```

---

## Meals & Recipes

### Collection: `savedMeals/{uid}/meals/{mealId}`

**Description:** User's saved favorite meals.

```typescript
{
  // Meal Identity
  name: string;
  description: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";

  // Nutrition
  servings: number;
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fiber: number;
    fat: number;
  };

  // Recipe
  ingredients: [{
    name: string;           // Display name: "Boneless Skinless Chicken Breast"
    quantity: string;       // "1 lb" or "2 cups"
    grocerySearchTerm?: string;  // Raw product: "chicken breast"
    preparation?: string;   // "diced", "minced", etc.

    // Kroger enrichment (optional)
    krogerProductId?: string;
    productName?: string;
    productImageUrl?: string;
    productSize?: string;
    productAisle?: string;
    price?: number;
    soldBy?: "WEIGHT" | "UNIT";
    stockLevel?: string;    // "HIGH", "LOW", "TEMPORARILY_OUT_OF_STOCK"
    available?: boolean;
  }];

  steps: string[];          // Cooking instructions

  // Metadata
  imageUrl?: string;        // Cloudinary URL
  cookTimeRange?: {
    min: number;            // Minutes
    max: number;
  };
  estimatedCost?: number;   // USD

  // Save Info
  savedAt: Timestamp;
  prompt?: string;          // Original prompt that generated this meal

  // Sharing
  source?: "prompt" | "shared_link";
  originalShareId?: string;
  sharerId?: string;        // UID of user who shared (if from shared link)
}
```

**Flutter Model:**
```dart
class Meal {
  final String id;
  final String name;
  final String description;
  final String mealType;
  final int servings;
  final Macros macros;
  final List<Ingredient> ingredients;
  final List<String> steps;
  final String? imageUrl;
  final CookTimeRange? cookTimeRange;
  final double? estimatedCost;
  final DateTime? savedAt;
}

class Ingredient {
  final String name;
  final String quantity;
  final String? grocerySearchTerm;
  final String? preparation;

  // Kroger data
  final String? krogerProductId;
  final String? productName;
  final String? productImageUrl;
  final double? price;
  final String? soldBy;
  final String? stockLevel;
  final bool? available;
}

class Macros {
  final int calories;
  final int protein;
  final int carbs;
  final int fiber;
  final int fat;
}
```

---

### Collection: `sharedMeals/{shareId}`

**Description:** Publicly accessible shared meal data. Created when user shares a meal.

```typescript
{
  originalMealId: string;     // ID of meal in user's saved meals
  sharerId: string;           // UID of user who shared

  mealData: {
    // Sanitized public data - no sensitive info
    name: string;
    description: string;
    mealType: string;
    macros: Macros;
    ingredients: Ingredient[];
    steps: string[];
    cookTimeRange?: CookTimeRange;
    imageUrl?: string;
    servings: number;
  };

  createdAt: Timestamp;
}
```

**Access:** Server-only write. Read access for public share pages.

---

## Shopping & Cart

### Collection: `shoppingLists/{uid}/items/{itemId}`

**Description:** User's shopping list items aggregated from meal ingredients.

```typescript
{
  // Item Info
  name: string;               // Ingredient name
  quantity: string;           // "1 lb", "2 cups"
  count: number;              // How many times this item appears (from multiple meals)
  checked: boolean;           // User marked as purchased

  // Source Meal
  mealId?: string;
  mealName?: string;
  mealImageUrl?: string;

  // Kroger Product Match
  krogerProductId?: string;
  productName?: string;
  productImageUrl?: string;
  productSize?: string;
  productAisle?: string;
  price?: number;
  soldBy?: "WEIGHT" | "UNIT";
  stockLevel?: string;

  // Cart Calculation
  cartQuantity?: number;      // Calculated units to add to cart
  cartCalculation?: string;   // "Recipe needs 2 lbs, product is 1 lb → 2 units"

  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

---

### Collection: `krogerLocations/{uid}/locations/{locationId}`

**Description:** User's saved Kroger store locations.

```typescript
{
  krogerLocationId: string;   // Kroger's location ID
  name?: string;              // "Kroger - Downtown"
  address?: string;           // Full address string
  updatedAt: number;          // Unix timestamp
}
```

---

### Collection: `pantryItems/{uid}/items/{itemId}`

**Description:** Tracks ingredients user has purchased/has at home.

```typescript
{
  name: string;               // Normalized ingredient name
  normalizedKey: string;      // Normalized key for matching
  quantity: number;           // How many units
  source: "cart_added" | "manual";
  addedAt: Timestamp;
  expiresAt?: Timestamp;      // Optional expiration date
}
```

---

## Preferences & Learning

### Collection: `foodEvents/{uid}/events/{eventId}`

**Description:** Events tracking user behavior for preference learning.

```typescript
{
  createdAt: Timestamp;
  type: FoodEventType;        // See enum below
  mealId?: string;
  mealFingerprint?: string;   // Hash of ingredients for dedup
  source?: "prompt" | "saved" | "regenerated" | "manual";

  context: {
    mealTime?: "breakfast" | "lunch" | "dinner" | "snack";
    dayType?: "weekday" | "weekend";
    audience?: "solo" | "family";
    storeProvider?: "instacart" | "kroger" | "walmart" | "other";
    storeId?: string;
  };

  payload: {
    ingredientKey?: string;     // Normalized: "chicken_breast"
    ingredientText?: string;    // Display: "Chicken Breast"
    fromIngredientKey?: string; // For swaps
    toIngredientKey?: string;
    tag?: string;
    reason?: string;
    quantityDelta?: number;
    productId?: string;
    fromProductId?: string;
    toProductId?: string;
    mealTags?: string[];
    mealName?: string;          // For variety tracking
  };

  clientEventId?: string;       // Dedup key
}
```

**Event Types:**
| Type | Weight | Description |
|------|--------|-------------|
| `MEAL_GENERATED` | 0 | Meal was generated |
| `MEAL_ACCEPTED` | +1 | User accepted/used meal |
| `MEAL_REJECTED` | -2 | User skipped/rejected meal |
| `MEAL_SAVED` | +2 | User saved meal to favorites |
| `MEAL_REPEATED` | +3 | User cooked same meal again |
| `MEAL_EDITED` | 0 | User modified meal (edits logged separately) |
| `INGREDIENT_ADDED` | +1.5 | User added ingredient via chat |
| `INGREDIENT_REMOVED` | -1.5 | User removed ingredient via chat |
| `INGREDIENT_SWAPPED` | 0 | User swapped ingredient (from -1, to +1) |
| `CART_ADDED` | +0.5 | Item added to cart |
| `CART_REMOVED` | -0.5 | Item removed from cart |
| `PRODUCT_SWAPPED` | 0 | User swapped Kroger product |

---

### Collection: `preferenceLocks/{uid}/locks/{lockId}`

**Description:** Explicit user preference rules that override learned preferences.

```typescript
{
  createdAt: Timestamp;
  updatedAt: Timestamp;

  scope: "ingredient" | "tag" | "cuisine" | "method" | "product" | "brand";
  key: string;                  // Normalized key: "mushroom", "spicy", "air_fryer"
  rule: "ALWAYS_INCLUDE" | "NEVER_INCLUDE" | "PREFER" | "AVOID";

  context?: {
    mealTime?: "breakfast" | "lunch" | "dinner" | "snack";
    dayType?: "weekday" | "weekend";
    audience?: "solo" | "family";
  };

  note?: string;                // User's note: "Tastes like soap"
  confidence: number;           // Usually 1.0 since user-confirmed
}
```

**Rule Score Boosts:**
| Rule | Score Boost |
|------|-------------|
| `ALWAYS_INCLUDE` | +10 |
| `NEVER_INCLUDE` | -10 |
| `PREFER` | +5 |
| `AVOID` | -5 |

---

### Collection: `userEvents/{uid}/events/{eventId}` (Legacy)

**Description:** Legacy user event tracking. Still used for some read operations.

```typescript
{
  createdAt: Timestamp;
  type: string;
  mealId?: string;
  prompt?: string;
  message?: string;
}
```

---

## System Collections

### Collection: `mealImageCache/{documentId}`

**Description:** Cached AI-generated meal images. `documentId` is SHA256 hash of meal characteristics.

```typescript
{
  imageUrl: string;           // Cloudinary permanent URL
  mealName: string;
  createdAt: Timestamp;
}
```

**Access:** Public read, server-only write.

---

### Collection: `krogerProductSearchCache/{docId}`

**Description:** Cached Kroger product search results. Expires after 24 hours.

```typescript
{
  query: string;
  locationId: string;
  products: KrogerProduct[];
  cachedAt: Timestamp;
  expiresAt: Timestamp;
}
```

**Access:** Server-only.

---

### Collection: `krogerRateLimits/{key}`

**Description:** Rate limiting counters for Kroger API.

```typescript
{
  count: number;
  windowStart: Timestamp;
  lastRequest: Timestamp;
}
```

Key formats: `second:{timestamp}`, `hour:{timestamp}`

**Access:** Server-only.

---

### Collection: `krogerCacheWarmingStats/{locationId}`

**Description:** Statistics for background cache warming jobs.

```typescript
{
  lastRun: Timestamp;
  productsCached: number;
  errors: number;
  duration: number;           // ms
}
```

**Access:** Server-only (Cloud Functions).

---

## Security Rules Summary

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own document
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // User subcollections
    match /users/{uid}/familyMembers/{memberId} {
      allow read, create, update, delete: if request.auth.uid == uid;
    }

    match /savedMeals/{uid}/meals/{mealId} {
      allow read, create, update, delete: if request.auth.uid == uid;
    }

    match /shoppingLists/{uid}/items/{itemId} {
      allow read, create, update, delete: if request.auth.uid == uid;
    }

    match /krogerLocations/{uid}/locations/{locationId} {
      allow read, create, update, delete: if request.auth.uid == uid;
    }

    match /pantryItems/{uid}/items/{itemId} {
      allow read, create, update, delete: if request.auth.uid == uid;
    }

    match /userEvents/{uid}/events/{eventId} {
      allow create, read: if request.auth.uid == uid;
      // No update/delete from client
    }

    // Public read, server write
    match /mealImageCache/{documentId} {
      allow read: if true;
      allow write: if false;  // Server only
    }

    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## Flutter Implementation Notes

### Firestore Setup

```dart
import 'package:cloud_firestore/cloud_firestore.dart';

final db = FirebaseFirestore.instance;

// User profile reference
DocumentReference userDoc(String uid) => db.collection('users').doc(uid);

// Saved meals reference
CollectionReference savedMeals(String uid) =>
    db.collection('savedMeals').doc(uid).collection('meals');

// Shopping list reference
CollectionReference shoppingList(String uid) =>
    db.collection('shoppingLists').doc(uid).collection('items');
```

### Real-time Listeners

```dart
// Listen to saved meals
Stream<List<Meal>> watchSavedMeals(String uid) {
  return savedMeals(uid)
      .orderBy('savedAt', descending: true)
      .snapshots()
      .map((snapshot) => snapshot.docs
          .map((doc) => Meal.fromFirestore(doc))
          .toList());
}

// Listen to shopping list
Stream<List<ShoppingItem>> watchShoppingList(String uid) {
  return shoppingList(uid)
      .orderBy('createdAt', descending: true)
      .snapshots()
      .map((snapshot) => snapshot.docs
          .map((doc) => ShoppingItem.fromFirestore(doc))
          .toList());
}
```

### Model Conversion

```dart
class Meal {
  factory Meal.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Meal(
      id: doc.id,
      name: data['name'] as String,
      description: data['description'] as String,
      mealType: data['mealType'] as String,
      servings: data['servings'] as int,
      macros: Macros.fromMap(data['macros']),
      ingredients: (data['ingredients'] as List)
          .map((i) => Ingredient.fromMap(i))
          .toList(),
      steps: List<String>.from(data['steps']),
      imageUrl: data['imageUrl'] as String?,
      savedAt: (data['savedAt'] as Timestamp?)?.toDate(),
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'name': name,
      'description': description,
      'mealType': mealType,
      'servings': servings,
      'macros': macros.toMap(),
      'ingredients': ingredients.map((i) => i.toMap()).toList(),
      'steps': steps,
      'imageUrl': imageUrl,
      'savedAt': FieldValue.serverTimestamp(),
    };
  }
}
```

### Offline Support

```dart
// Enable offline persistence (enabled by default on mobile)
FirebaseFirestore.instance.settings = Settings(
  persistenceEnabled: true,
  cacheSizeBytes: Settings.CACHE_SIZE_UNLIMITED,
);

// Handle offline writes
try {
  await savedMeals(uid).add(meal.toFirestore());
} catch (e) {
  // Will sync when back online
  print('Saved locally, will sync when online');
}
```

### Pagination

```dart
// Paginated saved meals query
Query paginatedMeals(String uid, {DocumentSnapshot? lastDoc, int limit = 20}) {
  var query = savedMeals(uid)
      .orderBy('savedAt', descending: true)
      .limit(limit);

  if (lastDoc != null) {
    query = query.startAfterDocument(lastDoc);
  }

  return query;
}
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        User Actions                         │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
│  Generate    │    │   Save/Edit  │    │   Shopping/Cart  │
│    Meals     │    │    Meals     │    │                  │
└──────────────┘    └──────────────┘    └──────────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
│ foodEvents/  │    │ savedMeals/  │    │ shoppingLists/   │
│   events     │◄───│    meals     │───►│     items        │
└──────────────┘    └──────────────┘    └──────────────────┘
        │                                         │
        ▼                                         ▼
┌──────────────────┐                    ┌──────────────────┐
│ Preference       │                    │ Kroger API       │
│ Aggregation      │                    │ (enrich/cart)    │
└──────────────────┘                    └──────────────────┘
        │                                         │
        ▼                                         ▼
┌──────────────────┐                    ┌──────────────────┐
│ preferenceLocks/ │                    │ pantryItems/     │
│     locks        │                    │     items        │
└──────────────────┘                    └──────────────────┘
```

---

*Document generated for Flutter mobile app migration*
