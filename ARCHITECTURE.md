# CartSense Application Architecture

## Route Groups

| Group | Path | Purpose |
|-------|------|---------|
| Root | `/app/` | Auth & marketing pages (login, signup, landing) |
| `(app)` | `/app/(app)/` | Protected authenticated pages |
| `(public)` | `/app/(public)/` | Public shareable pages |

---

## Pages & Features

### Root-Level (Pre-Auth)

| Page | Route | Features |
|------|-------|----------|
| Landing | `/` | Marketing, pricing, testimonials, CTAs |
| Login | `/login` | Firebase email/password auth |
| Sign Up | `/signup` | Registration with validation |
| Verify Email | `/verify-email` | Verification UI with resend + polling |
| Forgot Password | `/forgot-password` | Password reset flow |
| Terms/Privacy | `/terms`, `/privacy-policy` | Legal pages |

---

### Authenticated App `(app)`

| Page | Route | Features |
|------|-------|----------|
| **Prompt** | `/prompt` | Main entry - meal generation input, quick prompts, pantry mode, conflict detection |
| **Meals** | `/meals` | Streaming meal list, cards with images/macros/time, filtering |
| **Meal Detail** | `/meals/[mealId]` | Full recipe, ingredients, steps, AI chat, add to cart, save, share, Kroger enrichment |
| **Saved Meals** | `/saved-meals` | User's saved collection, search, delete, share |
| **Saved Meal Detail** | `/saved-meals/[mealId]` | View/interact with saved meal |
| **Shopping List** | `/shopping-list` | Aggregated list, Kroger cart sync, Instacart, product search, checkout |
| **Fresh Picks** | `/fresh-picks` | Premium curated meals, like/dislike to unlock more |
| **Account** | `/account` | Diet restrictions, family members, Kroger linking, store selection, preference locks |
| **Setup** | `/setup` | Onboarding: diet, cooking experience, store preference |
| **Upgrade** | `/upgrade` | Individual ($9.99/mo) and Family ($14.99/mo) plans |
| **Diet Instructions** | `/diet-instructions` | Premium OCR parsing of diet instruction photos |

---

### Public `(public)`

| Page | Route | Features |
|------|-------|----------|
| **Shared Meal** | `/share/[shareId]` | Public meal preview, OG tags for social, signup/login CTAs |

---

## Free vs Paid Features

### Feature Comparison

| Feature | Free | Individual ($9.99/mo) | Family ($14.99/mo) |
|---------|------|----------------------|-------------------|
| **Meal Generation** | 10 prompts/month | Unlimited | Unlimited |
| **AI Chat Customization** | Limited | 1,000 messages/month | 1,500 messages/month |
| **Saved Meals** | Unlimited | Unlimited | Unlimited |
| **Shopping Lists** | Limited | Unlimited | Unlimited |
| **Kroger Integration** | Yes | Yes | Yes |
| **Add to Kroger Cart** | Yes | Yes | Yes |
| **Fresh Picks** | No | Yes | Yes |
| **Diet Instructions (OCR)** | No | Yes | Yes |
| **Family Members** | No | No | Up to 5 |
| **Family Diet Conflict Detection** | No | No | Yes |
| **Preference Locks** | Limited | Full | Full |
| **Priority Support** | No | Yes | Yes |

### Pricing

| Plan | Monthly | Yearly (Save 25%) |
|------|---------|-------------------|
| Individual | $9.99/mo | $90/yr ($7.50/mo) |
| Family | $14.99/mo | $135/yr ($11.25/mo) |

### Premium-Only Pages

- `/fresh-picks` - Curated meal recommendations
- `/diet-instructions` - Upload diet instruction photos for OCR parsing

---

## API Routes

### Core APIs (`/app/api/`)

| Route | Method | Purpose |
|-------|--------|---------|
| `/auth/send-verification` | POST | Custom email verification via Resend |
| `/share` | POST | Create shareable meal link |
| `/share/claim` | POST | Claim shared meal to user's account |
| `/stripe/checkout` | POST | Create Stripe checkout session |
| `/stripe/portal` | GET | Redirect to Stripe portal |
| `/stripe/webhook` | POST | Handle Stripe events |

### App APIs (`/app/(app)/api/`)

| Route | Method | Purpose |
|-------|--------|---------|
| `/meals/stream` | POST | **Core** - Streams AI meal generation (OpenAI), image gen |
| `/meal-thread` | POST | AI conversation for customizing meals |
| `/swap-suggestions` | POST | Find Kroger product alternatives |
| `/diet-restrictions` | POST | OCR diet instruction photos (Claude Vision) |
| `/preferences/aggregate` | GET | Compute user food preferences from history |
| `/preferences/locks` | GET/POST/DELETE | Manage ALWAYS/NEVER include locks |
| `/pantry/check` | POST | Verify pantry items in Kroger store |
| `/pantry/clear` | POST | Clear cached pantry data |
| `/kroger/auth` | GET | Initiate Kroger OAuth |
| `/kroger/callback` | GET | OAuth callback handler |
| `/kroger/status` | GET | Check Kroger connection status |
| `/kroger/unlink` | POST | Disconnect Kroger account |
| `/kroger/profile` | GET | Get Kroger user profile |
| `/kroger/locations` | GET | Get nearby Kroger stores |
| `/kroger/cart` | POST | Add items to Kroger cart |
| `/kroger/enrich` | POST | Enrich ingredients with Kroger data |
| `/kroger/product/[productId]` | GET | Get product details |
| `/instacart/link` | POST | Link Instacart account |
| `/fresh-picks` | GET | Get curated meal recommendations |
| `/fresh-picks/feedback` | POST | Record like/dislike feedback |

---

## Key Components (`/components/`)

| Component | Usage |
|-----------|-------|
| `MealCard.tsx` | Meal summary card (used everywhere) |
| `MealImage.tsx` | Lazy-loaded meal image with premium badge |
| `ShareModal.tsx` | Share link generation + social buttons |
| `StoreSearchModal.tsx` | Kroger store selection |
| `DietaryConflictModal.tsx` | Family diet conflict warnings |
| `ConfirmationModal.tsx` | Confirm destructive actions |
| `Toast.tsx` | Notification system |
| `UpgradePrompt.tsx` | Upgrade CTA component |
| `EmptyState.tsx` | Empty state UI |
| `LoadingScreen.tsx` | Full-screen loading |
| `LoadingSpinner.tsx` | Inline spinner |
| `Button.tsx` | Button component with variants |
| `Card.tsx` | Generic card container |
| `Modal.tsx` | Base modal wrapper |
| `FormInput.tsx` | Input with labels/validation |
| `Alert.tsx` | Alert messages |

---

## Libraries (`/lib/`)

### Firebase & Auth
| File | Purpose |
|------|---------|
| `firebaseClient.ts` | Client-side Firebase init |
| `firebaseAdmin.ts` | Server-side Firebase Admin SDK |
| `authFetch.ts` | HTTP wrapper with Firebase auth token |
| `authHelper.ts` | Server-side auth verification |

### Food & Ingredients
| File | Purpose |
|------|---------|
| `ingredientNormalization.ts` | Normalize ingredient names for search |
| `ingredientImages.ts` | Map ingredients to image URLs |
| `pantry.ts` | Pantry mode logic |
| `sensitivityMapping.ts` | Dietary restrictions to ingredient rules |

### Kroger Product Engine (`/lib/product-engine/`)
| File | Purpose |
|------|---------|
| `kroger.ts` | Main Kroger API client |
| `krogerCache.ts` | Caching layer |
| `krogerQueue.ts` | Rate-limited request queue |
| `krogerRetry.ts` | Retry logic |
| `krogerRateLimiter.ts` | Rate limiting |
| `krogerWarm.ts` | Background location warming |
| `krogerConfig.ts` | API configuration |
| `ingredientQualityRules.ts` | Product quality scoring |
| `productSelectionService.ts` | Intelligent product selection |
| `spellingCorrections.ts` | Ingredient autocorrect |

### Payments & Analytics
| File | Purpose |
|------|---------|
| `stripe.ts` | Stripe SDK utilities |
| `logUserEvent.ts` | Log user interactions to Firestore |
| `logFoodEvent.ts` | Log food-specific events |

### Utilities
| File | Purpose |
|------|---------|
| `mealStorage.ts` | Client-side localStorage for meals |
| `priceEstimates.ts` | Ingredient cost estimation |
| `instacart.ts` | Instacart integration |
| `utils.ts` | General utilities |

---

## Types (`/types/`)

| File | Exports |
|------|---------|
| `meal.ts` | Meal type definitions |
| `family.ts` | FamilyMember types |
| `preferences.ts` | PreferenceProfile, FoodEventType |

---

## Architecture Flow

```
Landing → Signup/Login → Verify Email → Setup (onboarding)
                                              ↓
                                    ┌─────────────────────┐
                                    │   (app) Layout      │
                                    │  [Nav + Auth Check] │
                                    └─────────────────────┘
                                              ↓
    ┌──────────┬──────────┬──────────┬──────────┬──────────┐
    │  Prompt  │  Fresh   │ Shopping │  Saved   │ Account  │
    │          │  Picks   │   List   │  Meals   │          │
    └──────────┴──────────┴──────────┴──────────┴──────────┘
         ↓
      /meals → /meals/[id] (detail, chat, save, share)
```

---

## Third-Party Integrations

| Service | Purpose |
|---------|---------|
| **Firebase** | Authentication, Firestore database |
| **Kroger** | OAuth, product search, cart integration |
| **Stripe** | Subscription payments, webhooks |
| **OpenAI** | Meal generation, AI chat |
| **Claude (Anthropic)** | Diet instruction OCR parsing |
| **Cloudinary** | Meal image hosting |
| **Resend** | Email delivery |
| **Instacart** | Alternative shopping integration (feature flagged) |
