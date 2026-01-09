# CartSense API Endpoint Reference

This document provides a complete reference of all API endpoints for Flutter mobile app development.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Meal Generation](#meal-generation)
3. [Meal Editing (Chat)](#meal-editing-chat)
4. [Kroger Integration](#kroger-integration)
5. [Shopping & Cart](#shopping--cart)
6. [Sharing](#sharing)
7. [Subscriptions (Stripe)](#subscriptions-stripe)
8. [Preferences & Learning](#preferences--learning)
9. [Fresh Picks (Recommendations)](#fresh-picks-recommendations)
10. [Diet Restrictions](#diet-restrictions)
11. [Pantry Management](#pantry-management)
12. [Instacart Integration](#instacart-integration)

---

## Authentication

All authenticated endpoints require a Firebase ID token in the `Authorization` header:

```
Authorization: Bearer <firebase_id_token>
```

Use Firebase Auth SDK in Flutter to get the token:
```dart
final token = await FirebaseAuth.instance.currentUser?.getIdToken();
```

---

## Meal Generation

### POST `/api/meals/stream`

**Purpose:** Generate meal suggestions based on user prompt. Returns Server-Sent Events (SSE) stream.

**Auth:** Required (Firebase token)

**Request Body:**
```json
{
  "prompt": "quick chicken dinners",
  "prefs": {
    "dietType": "vegetarian",
    "cookingExperience": "beginner",
    "allergiesAndSensitivities": {
      "allergies": ["peanuts"],
      "sensitivities": ["lactose"]
    }
  },
  "uid": "firebase_user_id",
  "pantryMode": false,
  "ignoreConflicts": false
}
```

**Response (SSE Stream):**
```
data: {"type":"status","message":"Loading your preferences..."}

data: {"type":"meal","meal":{...},"index":0}

data: {"type":"meal_updated","meal":{...with imageUrl},"index":0}

data: {"type":"meta","meta":{"monthlyPromptCount":5,"monthlyPromptLimit":10}}

data: {"type":"done"}
```

**Event Types:**
| Type | Description |
|------|-------------|
| `status` | Progress message |
| `meal` | Initial meal data (no image yet) |
| `meal_updated` | Meal with generated image |
| `meta` | Usage stats, diet instructions used |
| `done` | Stream complete |
| `error` | Error occurred |

**Error Codes:**
- `INVALID_PROMPT` - Empty or invalid prompt
- `NOT_FOOD_REQUEST` - Off-topic prompt
- `PROMPT_LIMIT_REACHED` - Free tier limit exceeded
- `NO_MEALS` - All generated meals violated restrictions

**Meal Object Structure:**
```typescript
{
  id: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  description: string;
  servings: number;
  macros: {
    calories: number;
    protein: number;  // Per serving, calculated from USDA reference data
    carbs: number;
    fiber: number;
    fat: number;
  };
  ingredients: [{
    name: string;
    quantity: string;
    grocerySearchTerm?: string;
    preparation?: string;
    krogerProductId?: string;
    productName?: string;
    productImageUrl?: string;
    price?: number;
    soldBy?: "WEIGHT" | "UNIT";
    stockLevel?: string;
    available?: boolean;
  }];
  steps: string[];
  imageUrl?: string;
  cookTimeRange?: { min: number; max: number };
  estimatedCost?: number;
}
```

**Nutrition & Portion Guidelines:**

Macros are calculated using USDA reference data and represent **per-serving** values. Ingredient quantities follow standard single-serving portions:

| Ingredient Type | Single Serving |
|-----------------|----------------|
| Chicken/beef/pork/fish | 4-6 oz (113-170g) |
| Ground meat | 4 oz (113g) |
| Shrimp | 4-5 oz (113-140g) |
| Rice/pasta (cooked) | 1 cup |
| Vegetables | 1-2 cups |
| Cheese | 1-2 oz (28-56g) |
| Eggs | 2-3 for main dish |

Example: A chicken breast recipe for 1 serving will use ~6 oz chicken and show ~52g protein (not 1 lb with incorrect macros).

---

## Meal Editing (Chat)

### POST `/api/meal-thread`

**Purpose:** AI chat to customize a meal (add/remove ingredients, adjust recipe).

**Auth:** Required (Firebase token)

**Request Body:**
```json
{
  "userId": "firebase_user_id",
  "meal": { /* full meal object */ },
  "prefs": { /* user preferences */ },
  "message": "make it spicier and add more protein",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "originalPrompt": "chicken dinner"
}
```

**Response:**
```json
{
  "reply": "I've added jalapeños and increased the chicken portion...",
  "action": "update_meal",
  "updatedMeal": { /* modified meal object */ },
  "monthlyChatCount": 3,
  "dietaryWarnings": [
    { "ingredientName": "cheese", "violationType": "sensitivity", "restriction": "lactose" }
  ]
}
```

**Actions:**
- `no_change` - No modifications needed
- `update_meal` - Minor edits to existing meal
- `new_meal_variant` - Major change, essentially new meal

**Limits:** Free users get 6 chat messages/month

---

## Kroger Integration

### GET `/api/kroger/auth`

**Purpose:** Initiate Kroger OAuth flow.

**Query Params:**
- `userId` (required) - Firebase user ID
- `returnTo` (optional) - `"setup"` or `"account"`
- `step` (optional) - Setup wizard step number

**Response:** Redirects to Kroger OAuth login page

---

### GET `/api/kroger/callback`

**Purpose:** OAuth callback handler (called by Kroger after user authorizes).

**Query Params:**
- `code` - OAuth authorization code
- `state` - CSRF token with user info

**Response:** Redirects to app with success/error status

---

### GET `/api/kroger/status`

**Purpose:** Check if Kroger account is linked and store is selected.

**Auth:** Required (Firebase token)

**Response:**
```json
{
  "linked": true,
  "hasStore": true,
  "locationCount": 1,
  "storeName": "Kroger - Downtown"
}
```

---

### GET `/api/kroger/profile?userId={uid}`

**Purpose:** Get linked Kroger user profile.

**Response:**
```json
{
  "id": "kroger_user_id",
  "firstName": "John",
  "lastName": "Doe"
}
```

---

### GET `/api/kroger/locations?zip={zipcode}`

**Purpose:** Search for Kroger stores by ZIP code.

**Response:**
```json
{
  "locations": [
    {
      "locationId": "01234567",
      "name": "Kroger",
      "address": {
        "addressLine1": "123 Main St",
        "city": "Cincinnati",
        "state": "OH",
        "zipCode": "45202"
      },
      "chain": "KROGER"
    }
  ]
}
```

---

### POST `/api/kroger/store`

**Purpose:** Set user's default Kroger store.

**Auth:** Required (Firebase token)

**Request Body:**
```json
{
  "locationId": "01234567",
  "name": "Kroger - Downtown",
  "address": "123 Main St, Cincinnati, OH"
}
```

---

### POST `/api/kroger/unlink`

**Purpose:** Disconnect Kroger account.

**Request Body:**
```json
{
  "userId": "firebase_user_id"
}
```

---

### POST `/api/kroger/enrich`

**Purpose:** Enrich meal ingredients with Kroger product data (prices, images, availability).

**Request Body:**
```json
{
  "userId": "firebase_user_id",
  "ingredients": [
    { "name": "chicken breast", "quantity": "1 lb" }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "ingredients": [
    {
      "name": "chicken breast",
      "quantity": "1 lb",
      "krogerProductId": "0001234567890",
      "productName": "Simple Truth Organic Chicken Breast",
      "productImageUrl": "https://...",
      "price": 8.99,
      "soldBy": "WEIGHT",
      "stockLevel": "HIGH",
      "available": true
    }
  ],
  "enrichedCount": 1,
  "totalCount": 1
}
```

---

### GET `/api/kroger/product/{productId}?locationId={locationId}`

**Purpose:** Get details for a specific Kroger product.

**Response:**
```json
{
  "krogerProductId": "0001234567890",
  "name": "Simple Truth Organic Chicken Breast",
  "imageUrl": "https://...",
  "price": 8.99,
  "size": "1 lb",
  "soldBy": "WEIGHT",
  "stockLevel": "HIGH",
  "available": true,
  "aisle": "Meat & Seafood"
}
```

---

## Shopping & Cart

### POST `/api/kroger/cart`

**Purpose:** Add items to user's Kroger online cart.

**Request Body:**
```json
{
  "userId": "firebase_user_id",
  "items": [
    { "id": "item_id", "name": "chicken breast", "quantity": "1 lb", "count": 2 }
  ],
  "enrichOnly": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Added 5 item(s) to your Kroger cart.",
  "enrichedItems": [ /* items with Kroger product details */ ],
  "addedCount": 5,
  "notFoundCount": 0,
  "unavailableCount": 1,
  "alternativesUsedCount": 1
}
```

Set `enrichOnly: true` to update shopping list items with Kroger data without actually adding to cart.

---

### POST `/api/swap-suggestions`

**Purpose:** Find alternative products for an ingredient.

**Auth:** Required (Firebase token)

**Request Body:**
```json
{
  "ingredientName": "chicken breast",
  "currentProductId": "0001234567890",
  "searchTerm": "boneless skinless chicken breast"
}
```

**Response:**
```json
{
  "success": true,
  "alternatives": [
    {
      "krogerProductId": "0009876543210",
      "name": "Kroger Chicken Breast",
      "price": 6.99,
      "avoidWarning": null
    }
  ],
  "searchTermWarning": null
}
```

---

## Sharing

### POST `/api/share`

**Purpose:** Create a shareable link for a meal.

**Auth:** Required (Firebase token)

**Request Body:**
```json
{
  "meal": { /* full meal object */ }
}
```

**Response:**
```json
{
  "shareId": "abc123xyz",
  "publicUrl": "/share/abc123xyz"
}
```

---

### POST `/api/share/claim`

**Purpose:** Save a shared meal to user's account.

**Auth:** Required (Firebase token)

**Request Body:**
```json
{
  "shareId": "abc123xyz"
}
```

**Response:**
```json
{
  "success": true,
  "newMealId": "saved_meal_id"
}
```

---

## Subscriptions (Stripe)

### POST `/api/stripe/checkout`

**Purpose:** Create Stripe checkout session for subscription.

**Auth:** Required (Firebase token)

**Request Body:**
```json
{
  "email": "user@example.com",
  "plan": "individual",
  "billingCycle": "yearly"
}
```

**Plans:** `"individual"` | `"family"`
**Billing:** `"monthly"` | `"yearly"`

**Response:**
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

---

### POST `/api/stripe/portal`

**Purpose:** Get Stripe billing portal URL for subscription management.

**Request Body:**
```json
{
  "uid": "firebase_user_id"
}
```

**Response:**
```json
{
  "url": "https://billing.stripe.com/..."
}
```

---

### POST `/api/stripe/webhook`

**Purpose:** Stripe webhook handler (server-to-server).

**Events Handled:**
- `checkout.session.completed` - Activate subscription
- `customer.subscription.created` - New subscription
- `customer.subscription.updated` - Plan change
- `customer.subscription.deleted` - Cancellation
- `invoice.payment_failed` - Payment issue

---

## Preferences & Learning

### GET `/api/preferences/aggregate`

**Purpose:** Get aggregated user preferences learned from meal history.

**Auth:** Required (Firebase token)

**Response:**
```json
{
  "profile": {
    "version": 1,
    "ingredientScores": {
      "chicken": 5,
      "mushrooms": -3
    },
    "tagScores": {
      "mediterranean": 4
    },
    "contextScores": {
      "dinner": {
        "ingredientScores": { "chicken": 3 },
        "tagScores": {}
      }
    },
    "stats": {
      "totalEvents": 150,
      "acceptedMeals": 45,
      "rejectedMeals": 12
    }
  }
}
```

---

### GET `/api/preferences/locks`

**Purpose:** Get user's preference locks (always/never include items).

**Auth:** Required (Firebase token)

**Response:**
```json
{
  "locks": [
    {
      "id": "lock_id",
      "scope": "ingredient",
      "key": "cilantro",
      "rule": "NEVER_INCLUDE",
      "note": "Tastes like soap"
    }
  ]
}
```

---

### POST `/api/preferences/locks`

**Purpose:** Create a new preference lock.

**Auth:** Required (Firebase token)

**Request Body:**
```json
{
  "scope": "ingredient",
  "key": "cilantro",
  "rule": "NEVER_INCLUDE",
  "note": "Tastes like soap"
}
```

**Scopes:** `"ingredient"` | `"tag"` | `"cuisine"` | `"method"` | `"product"` | `"brand"`
**Rules:** `"ALWAYS_INCLUDE"` | `"NEVER_INCLUDE"` | `"PREFER"` | `"AVOID"`

---

### DELETE `/api/preferences/locks?lockId={id}`

**Purpose:** Delete a preference lock.

**Auth:** Required (Firebase token)

---

## Fresh Picks (Recommendations)

### POST `/api/fresh-picks`

**Purpose:** Get personalized daily meal recommendations based on saved meals.

**Request Body:**
```json
{
  "userId": "firebase_user_id",
  "userTimezoneOffset": -300
}
```

**Response:**
```json
{
  "source": "generated",
  "meals": [
    {
      "id": "fresh-pick-1234-0",
      "mealType": "breakfast",
      "name": "...",
      "isFreshPick": true
    }
  ],
  "generatedAt": "2024-01-15T08:00:00Z"
}
```

**Requirements:** User must have 5+ saved meals to unlock.

**Caching:** Results cached for 24 hours.

---

### POST `/api/fresh-picks/feedback`

**Purpose:** Record like/dislike for a Fresh Pick meal.

**Request Body:**
```json
{
  "userId": "firebase_user_id",
  "meal": { /* meal object */ },
  "action": "like"
}
```

**Actions:** `"like"` | `"dislike"`

---

## Diet Restrictions

### POST `/api/diet-restrictions`

**Purpose:** OCR parse diet instruction photos (e.g., from a healthcare provider or dietary plan).

**Request Body:**
```json
{
  "imageDataUrls": [
    "data:image/jpeg;base64,..."
  ]
}
```

Supports multiple pages (up to ~5 images).

**Response:**
```json
{
  "blockedIngredients": ["bacon", "sausage", "whole milk"],
  "blockedFoodGroups": ["fried foods", "processed meats", "high-sodium foods"],
  "instructionsSummary": "Heart-healthy diet with low sodium and limited saturated fats."
}
```

---

## Pantry Management

### POST `/api/pantry/check`

**Purpose:** Check which ingredients user likely has in pantry.

**Auth:** Required (Firebase token)

**Request Body:**
```json
{
  "ingredients": ["chicken", "rice", "olive oil"]
}
```

**Response:**
```json
{
  "success": true,
  "inPantry": ["olive oil", "rice"]
}
```

---

### POST `/api/pantry/clear`

**Purpose:** Clear all pantry items.

**Auth:** Required (Firebase token)

**Response:**
```json
{
  "success": true,
  "cleared": 15
}
```

---

## Instacart Integration

### POST `/api/instacart/link`

**Purpose:** Generate an Instacart shopping link for a list of items.

**Request Body:**
```json
{
  "items": [
    { "id": "1", "name": "chicken breast", "quantity": "1 lb", "count": 2 }
  ],
  "title": "Dinner Recipe",
  "imageUrl": "https://...",
  "linkbackUrl": "https://cartsense.app/meals/123",
  "linkType": "recipe",
  "userId": "firebase_user_id",
  "instructions": ["Step 1...", "Step 2..."]
}
```

**Link Types:** `"recipe"` (default) | `"shopping_list"`

**Response:**
```json
{
  "success": true,
  "url": "https://instacart.com/...",
  "itemCount": 8
}
```

---

## Flutter Implementation Notes

### HTTP Client Setup

```dart
class ApiClient {
  final String baseUrl = 'https://your-app.vercel.app';

  Future<Map<String, String>> _getHeaders() async {
    final token = await FirebaseAuth.instance.currentUser?.getIdToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<Response> post(String path, Map<String, dynamic> body) async {
    final headers = await _getHeaders();
    return http.post(
      Uri.parse('$baseUrl$path'),
      headers: headers,
      body: jsonEncode(body),
    );
  }
}
```

### SSE Stream Handling (for meal generation)

```dart
import 'package:http/http.dart' as http;

Stream<MealStreamEvent> streamMeals(String prompt) async* {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();
  final request = http.Request('POST', Uri.parse('$baseUrl/api/meals/stream'));
  request.headers['Authorization'] = 'Bearer $token';
  request.headers['Content-Type'] = 'application/json';
  request.body = jsonEncode({'prompt': prompt, 'uid': userId});

  final response = await request.send();

  await for (final chunk in response.stream.transform(utf8.decoder)) {
    for (final line in chunk.split('\n')) {
      if (line.startsWith('data: ')) {
        final json = jsonDecode(line.substring(6));
        yield MealStreamEvent.fromJson(json);
      }
    }
  }
}
```

### Error Handling

All endpoints return errors in this format:
```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable message"
}
```

Common HTTP status codes:
- `400` - Bad request / validation error
- `401` - Not authenticated / token expired
- `403` - Forbidden (e.g., feature requires premium)
- `404` - Resource not found
- `422` - Unprocessable (e.g., insufficient saved meals for Fresh Picks)
- `500` - Server error
- `503` - Service unavailable (e.g., Kroger API rate limited)

---

## Rate Limits & Quotas

| Feature | Free Tier | Premium |
|---------|-----------|---------|
| Meal generations | 10/month | Unlimited |
| Chat messages | 6/month | Unlimited |
| Fresh Picks | Requires 5+ saved meals | Same |
| Kroger API | Subject to Kroger limits | Same |

---

*Document generated for Flutter mobile app migration*
