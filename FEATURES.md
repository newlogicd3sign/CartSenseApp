# CartSense - Features & Functionality Documentation

**Purpose:** Reference document for AI prompting sessions to avoid repeated codebase searches.

---

## Application Overview

**CartSense** is an AI-powered meal planning and grocery shopping application that generates personalized recipes and adds ingredients directly to your Kroger cart.

### Tech Stack
- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend:** Next.js API routes, Firebase
- **Database:** Firestore (NoSQL)
- **Auth:** Firebase Authentication
- **AI:** OpenAI (GPT-4o-mini for meals, DALL-E 2 for images)
- **Payments:** Stripe
- **Grocery:** Kroger API
- **Images:** Cloudinary
- **PWA:** Next PWA with service workers

---

## Core Features

### 1. AI Meal Generation
- **Streaming API** (`/api/meals/stream`): Real-time meal generation with status updates
- Generates 3-4 recipes or full meal plans (4-7 meals) based on user prompts
- Includes nutritional macros (calories, protein, carbs, fiber, fat)
- Cook time ranges with difficulty variance
- DALL-E 2 generated meal images cached in Firestore & Cloudinary
- Content moderation via OpenAI

### 2. Dietary Restrictions & Family Profiles
**User Restrictions:**
- Diet types (vegan, keto, paleo, Mediterranean, etc.)
- Allergies and sensitivities (dairy, gluten, etc.)
- Disliked foods
- Cooking experience level (beginner/intermediate/advanced)

**Family Members (Premium):**
- Up to 5 members with individual dietary restrictions
- Doctor diet instructions via OCR photo upload
- Combined household restrictions for meal generation
- Toggle members on/off

### 3. Kroger Grocery Integration
- **OAuth 2.0:** User linking with Kroger accounts
- **Product Enrichment:** Lazy-loaded on meal detail view
  - UPC/Product ID
  - Real-time pricing
  - Aisle location
  - Stock levels (HIGH, LOW, TEMPORARILY_OUT_OF_STOCK)
  - Product images & size info

- **Smart Shopping:**
  - Add ingredients directly to Kroger cart
  - Automatic alternative suggestions for unavailable items
  - Store location-specific product search
  - Rate-limited API queue with circuit breaker

### 4. Shopping Lists
- Save and manage shopping list items
- Link items to source meals
- Automatic ingredient deduplication
- Staple item (oil, spices) tracking
- Excluded items (water, ice)
- Real-time Firestore sync

### 5. Saved Meals
- Save favorite generated meals
- Search saved meals by name
- Delete saved meals
- View meal details and nutritional info

### 6. AI Meal Customization
- **Meal Thread API** (`/api/meal-thread`): Conversational meal editing
- Chat-based modifications (add/remove ingredients, adjust portions, change cooking methods)
- Monthly chat limits for free tier (6 messages/month)
- Premium unlimited AI chat

### 7. Ingredient Swapping
- **Swap Suggestions API** (`/api/swap-suggestions`)
- Find alternatives for unavailable products
- Filter by Kroger availability at selected store

---

## User Flows

### Authentication & Onboarding
1. **Signup** (`/signup`): Email/password (8+ chars, uppercase, lowercase, number)
2. **Email Verification** (`/verify-email`): Confirm email with action link
3. **Login** (`/login`): Email/password signin
4. **Setup** (`/setup`): Post-login onboarding
   - Select cooking experience
   - Choose diet type
   - Add allergies/sensitivities
   - Search and select Kroger store location

### Main User Journey
1. **Meal Generation** (`/prompt`): Search bar with quick prompts, real-time streaming
2. **Meal Detail** (`/meals/[mealId]`): Full recipe, macros, cook time, Kroger enrichment, AI customization
3. **Shopping List** (`/shopping-list`): View items, enrich with Kroger products, add to cart
4. **Account** (`/account`): Preferences, family members, Kroger linking, subscription

---

## Page Structure

### Public Pages
| Route | Purpose |
|-------|---------|
| `/` | Landing page with features, pricing, testimonials |
| `/login` | Email/password login |
| `/signup` | Account creation |
| `/verify-email` | Email verification handler |
| `/forgot-password` | Password recovery |
| `/privacy-policy` | Privacy policy |
| `/terms` | Terms of service |

### Protected Pages
| Route | Purpose |
|-------|---------|
| `/prompt` | Meal search & generation interface |
| `/meals/[mealId]` | Detailed meal view with customization |
| `/shopping-list` | Shopping list management |
| `/saved-meals` | View/manage saved meals |
| `/saved-meals/[mealId]` | View saved meal details |
| `/account` | User settings & preferences |
| `/setup` | Initial onboarding |
| `/diet-restrictions` | Upload doctor diet instructions |
| `/upgrade` | Upgrade to premium |
| `/upgrade/success` | Post-purchase confirmation |

---

## Key Components

| Component | Purpose |
|-----------|---------|
| `Button.tsx` | Styled button component |
| `Card.tsx` | Card container with padding |
| `FormInput.tsx` | Text input with icon support |
| `Modal.tsx` | Generic modal dialog |
| `ConfirmationModal.tsx` | Delete/action confirmation |
| `StoreSearchModal.tsx` | Kroger location search |
| `MealCard.tsx` | Meal preview card |
| `UpgradePrompt.tsx` | Premium feature upsell |
| `Toast.tsx` | Notification system |
| `Alert.tsx` | Alert/warning messages |
| `LoadingScreen.tsx` | Full-screen loading state |
| `LoadingSpinner.tsx` | Inline spinner |
| `EmptyState.tsx` | Empty state display |

---

## Data Models

### User Document (`users/{uid}`)
```typescript
{
  email: string;
  planType: "free" | "premium";
  isPremium: boolean;
  monthlyPromptCount: number; // free tier: 10/month
  promptPeriodStart: Timestamp;
  createdAt: Timestamp;
  emailVerified: boolean;
  dietType?: string;
  allergiesAndSensitivities?: { allergies?: string[], sensitivities?: string[] };
  dislikedFoods?: string[];
  cookingExperience?: "beginner" | "intermediate" | "advanced";
  krogerLinked?: boolean;
  krogerTokens?: { accessToken, refreshToken, expiresAt, updatedAt };
  defaultKrogerLocationId?: string;
  stripeCustomerId?: string;
  doctorDietInstructions?: DoctorDietInstructions;
}
```

### Meal Type
```typescript
type Meal = {
  id: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  description: string;
  servings: number;
  macros: { calories: number; protein: number; carbs: number; fiber: number; fat: number };
  ingredients: Ingredient[];
  steps: string[];
  imageUrl?: string;
  cookTimeRange?: { min: number; max: number };
};
```

### Ingredient Type
```typescript
type Ingredient = {
  name: string;
  quantity: string;
  grocerySearchTerm?: string;
  preparation?: string;
  category?: string;
  aisle?: string;
  price?: number;
  soldBy?: "WEIGHT" | "UNIT";
  stockLevel?: string;
  available?: boolean;
  krogerProductId?: string;
  productName?: string;
  productImageUrl?: string;
  productSize?: string;
  productAisle?: string;
};
```

### Family Member (`users/{uid}/familyMembers/{memberId}`)
```typescript
{
  id: string;
  name: string;
  isActive: boolean;
  dietType?: string;
  allergiesAndSensitivities?: { allergies?: string[], sensitivities?: string[] };
  dislikedFoods?: string[];
  doctorDietInstructions?: DoctorDietInstructions;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Shopping List Item (`shoppingLists/{uid}/items/{itemId}`)
```typescript
{
  id: string;
  name: string;
  quantity: string;
  count?: number;
  mealId?: string;
  mealName?: string;
  checked: boolean;
  createdAt: Timestamp;
  krogerProductId?: string;
  productName?: string;
  productImageUrl?: string;
  productSize?: string;
  productAisle?: string;
  price?: number;
  soldBy?: "WEIGHT" | "UNIT";
  stockLevel?: string;
}
```

---

## API Routes

### Meal Generation & Customization
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/meals/stream` | POST | Real-time meal generation with streaming |
| `/api/meal-thread` | POST | Conversational meal editing |
| `/api/swap-suggestions` | POST | Alternative ingredient suggestions |

### Kroger Integration
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/kroger/auth` | GET | Initiate OAuth login flow |
| `/api/kroger/callback` | GET | OAuth callback handler |
| `/api/kroger/cart` | POST | Add ingredients to cart |
| `/api/kroger/enrich` | POST | Lazy-load Kroger product data |
| `/api/kroger/locations` | GET | Search Kroger stores by location |
| `/api/kroger/profile` | GET | Get linked account info |
| `/api/kroger/status` | GET | Check API status |
| `/api/kroger/unlink` | POST | Unlink Kroger account |

### Diet & Payments
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/diet-restrictions` | POST | OCR parse doctor diet instructions |
| `/api/stripe/checkout` | POST | Create checkout session |
| `/api/stripe/portal` | POST | Subscription management portal |
| `/api/stripe/webhook` | POST | Payment event processing |

---

## Subscription Tiers

### Free Tier
- 10 meal generations per month
- 6 AI chat messages per month
- Basic saved meals
- Basic shopping list
- Basic diet restrictions
- No family members

### Individual Plan ($9.99/month)
- Unlimited meal generations
- 1,000 AI chat messages/month
- Unlimited saved meals
- Unlimited shopping lists
- Diet instruction photo upload
- Priority meal generation

### Family Plan ($14.99/month)
- All Individual features
- Up to 5 household members
- Individual diet profiles per member
- Member-specific diet instructions
- Toggle members on/off
- 1,500 AI chat messages/month

---

## Key Libraries & Services

### Kroger Rate Limiting (`lib/kroger/`)
- `krogerRateLimiter.ts` - Token bucket rate limiting (10 req/sec, 5000 req/hour)
- `krogerQueue.ts` - Request queue with priority levels
- `krogerRetry.ts` - Retry logic with circuit breaker
- `krogerCache.ts` - Product caching layer
- `krogerWarm.ts` - Background cache warming

### Product Selection (`lib/`)
- `productSelectionService.ts` - Intelligent product selection
- `ingredientQualityRules.ts` - 40KB+ of quality scoring rules (category-specific, ingredient-specific, pet food filtering)

### Storage (`lib/`)
- `mealStorage.ts` - Session + localStorage for meal persistence (24-hour window)
- `firebaseClient.ts` - Client-side Firebase setup
- `firebaseAdmin.ts` - Server-side Firebase Admin SDK

---

## External Integrations

### OpenAI
- **Model:** GPT-4o-mini for meal generation
- **Image:** DALL-E 2 for meal photography
- **Moderation:** Content moderation on user prompts

### Kroger API
- OAuth 2.0 user authorization
- Product search with location filtering
- Cart operations
- Store/location lookup
- Rate limiting: 10 req/sec, 5000 req/hour

### Stripe
- Subscription checkout flow
- Customer portal for management
- Webhook event handling

### Cloudinary
- Permanent image hosting for meal photos
- Organization: `cartsense/meal-images/`

---

## Architecture Patterns

### Rate Limiting & Resilience
- Circuit breaker: 5 failures triggers 2-min cooldown
- Request queue with priority (Cart > Enrich > Location > Warming)
- Exponential backoff retry (1s, 2s, 4s)
- Rate-limit pause on 429 (30 sec)

### Performance Optimizations
- Image caching (Firestore + Cloudinary)
- Lazy-loading Kroger enrichment on meal detail view
- Session storage for quick access
- SSE streaming for meal generation
- Parallel meal image generation
- Cache warming for popular ingredients

### Data Security
- Firestore security rules (user isolation)
- HTTPS only for OAuth
- Server-side API key management
- Stripe webhook signature verification
- OpenAI content moderation

---

## File Structure Overview

```
app/
├── (app)/                    # Protected routes (authenticated)
│   ├── prompt/               # Meal generation
│   ├── meals/[mealId]/       # Meal detail view
│   ├── shopping-list/        # Shopping list
│   ├── saved-meals/          # Saved meals
│   ├── account/              # User settings
│   ├── setup/                # Onboarding
│   ├── diet-restrictions/    # Diet upload
│   └── upgrade/              # Subscription
├── (auth)/                   # Auth routes
│   ├── login/
│   ├── signup/
│   └── verify-email/
├── api/                      # API routes
│   ├── meals/
│   ├── kroger/
│   ├── stripe/
│   └── ...
└── page.tsx                  # Landing page

components/                   # Reusable UI components
lib/                         # Utilities and services
├── kroger/                  # Kroger API utilities
├── firebase*.ts             # Firebase setup
├── mealStorage.ts           # Meal persistence
└── ...

types/                       # TypeScript type definitions
```

---

*Last updated: December 2024*
