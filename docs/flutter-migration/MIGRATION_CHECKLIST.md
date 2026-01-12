# CartSense Flutter Migration Checklist

A comprehensive checklist for migrating CartSense from Next.js/React to Flutter while maintaining feature parity.

---

## Phase 1: Project Setup & Infrastructure

### 1.1 Flutter Project Initialization
- [ ] Create new Flutter project: `flutter create cartsense_mobile`
- [ ] Configure minimum SDK versions (iOS 13+, Android API 24+)
- [ ] Set up project structure per UI_COMPONENTS.md recommendations
- [ ] Configure app icons and splash screen
- [ ] Set up flavors for dev/staging/prod environments

### 1.2 Dependencies
- [ ] Add state management: `flutter_riverpod`
- [ ] Add routing: `go_router`
- [ ] Add Firebase packages:
  - [ ] `firebase_core`
  - [ ] `firebase_auth`
  - [ ] `cloud_firestore`
- [ ] Add networking: `dio`
- [ ] Add image caching: `cached_network_image`
- [ ] Add icons: `lucide_icons`
- [ ] Add animations: `flutter_animate`
- [ ] Add payments: `flutter_stripe`
- [ ] Add utilities: `intl`, `url_launcher`, `share_plus`
- [ ] Add shimmer loading: `shimmer`

### 1.3 Firebase Configuration
- [ ] Create Firebase project (or use existing)
- [ ] Download and add `google-services.json` (Android)
- [ ] Download and add `GoogleService-Info.plist` (iOS)
- [ ] Enable Firestore offline persistence
- [ ] Configure Firebase Auth providers (Email/Password)
- [ ] Copy Firestore security rules from web project

### 1.4 Environment & Secrets
- [ ] Set up environment variables for API base URL
- [ ] Configure Stripe publishable key
- [ ] Set up Kroger OAuth client ID (for redirect flow)
- [ ] Configure deep link schemes

---

## Phase 2: Design System & Core Components

### 2.1 Theme & Design Tokens
- [ ] Create `colors.dart` with all color constants
- [ ] Create `typography.dart` with text styles
- [ ] Create `spacing.dart` with spacing constants
- [ ] Create `shadows.dart` with shadow definitions
- [ ] Configure `ThemeData` in `theme.dart`

### 2.2 Core UI Components
- [ ] `AppButton` - All 5 variants (primary, secondary, outline, ghost, danger)
- [ ] `AppButton` - All 3 sizes (sm, md, lg)
- [ ] `AppButton` - Loading state with spinner
- [ ] `AppButton` - Custom gradient support
- [ ] `FormInput` - With label, icon, error states
- [ ] `AppCard` - With padding variants and hover
- [ ] `AppModal` - Center variant
- [ ] `AppModal` - Bottom sheet variant
- [ ] `AppAlert` - All 4 variants (success, error, warning, info)
- [ ] `LoadingSpinner` - All sizes and colors
- [ ] `EmptyState` - With icon, title, description, action

### 2.3 Toast System
- [ ] Create `ToastProvider` with context
- [ ] Implement toast animations (enter/exit)
- [ ] Support success, error, info types
- [ ] Auto-dismiss after 2 seconds
- [ ] Stack multiple toasts

### 2.4 Layout Components
- [ ] `AppShell` - Main scaffold with bottom nav
- [ ] `BottomNavigation` - 5 tabs with active states
- [ ] Safe area handling for iOS notch/home indicator
- [ ] Scroll behavior configuration

---

## Phase 3: Authentication & Onboarding

### 3.1 Auth Service
- [ ] Firebase Auth initialization
- [ ] Email/password sign up
- [ ] Email/password login
- [ ] Email verification flow
- [ ] Password reset flow
- [ ] Auth state persistence
- [ ] Token refresh handling
- [ ] Sign out

### 3.2 Auth Screens
- [ ] Login screen
- [ ] Sign up screen
- [ ] Email verification screen
- [ ] Password reset screen
- [ ] Auth loading/splash screen

### 3.3 Auth State Management
- [ ] Create `AuthProvider` with Riverpod
- [ ] Listen to auth state changes
- [ ] Redirect logic based on auth state
- [ ] Handle expired sessions

### 3.4 Onboarding Setup Wizard
- [ ] Step 1: Diet type selection
- [ ] Step 2: Allergies & sensitivities picker
- [ ] Step 3: Cooking experience level
- [ ] Step 4: Kroger account linking (optional)
- [ ] Step 5: Store selection (if Kroger linked)
- [ ] Progress indicator
- [ ] Skip/back navigation
- [ ] Save preferences to Firestore

---

## Phase 4: User Profile & Preferences

### 4.1 User Data Models
- [ ] `UserProfile` model from FIRESTORE_SCHEMA.md
- [ ] `FamilyMember` model
- [ ] `DietInstructions` model
- [ ] Firestore serialization/deserialization

### 4.2 User Provider
- [ ] Stream user document from Firestore
- [ ] Update user preferences
- [ ] Track subscription status
- [ ] Handle offline updates

### 4.3 Account Screen
- [ ] Profile display (name, email)
- [ ] Diet type editor
- [ ] Allergies editor
- [ ] Sensitivities editor
- [ ] Disliked foods editor
- [ ] Cooking experience selector
- [ ] Kroger connection status
- [ ] Subscription status display
- [ ] Sign out button

---

## Phase 5: Meal Generation (Core Feature)

### 5.1 Prompt Screen
- [ ] Text input for meal prompt
- [ ] Pantry mode toggle
- [ ] Quick prompt chips (6 presets)
- [ ] Generate button with loading state
- [ ] Keyboard handling

### 5.2 Dietary Conflict Detection
- [ ] Port `sensitivityMapping.ts` to Dart
- [ ] Port `checkPromptForConflicts()` function
- [ ] Negation phrase detection
- [ ] Family member conflict checking
- [ ] `DietaryConflictModal` component
- [ ] Proceed/Cancel flow

### 5.3 Streaming Meal Generation
- [ ] SSE client for `/api/meals/stream`
- [ ] Handle `status` events (progress messages)
- [ ] Handle `meal` events (initial meal data)
- [ ] Handle `meal_updated` events (with images)
- [ ] Handle `meta` events (usage stats)
- [ ] Handle `done` event
- [ ] Handle `error` events
- [ ] Retry logic for failures

### 5.4 Meals Result Screen
- [ ] Loading skeleton while streaming
- [ ] Staggered `MealCard` animations
- [ ] Tap to view detail
- [ ] Empty state if no meals

### 5.5 Meal Models
- [ ] `Meal` model with all fields
- [ ] `Ingredient` model with Kroger fields
- [ ] `Macros` model
- [ ] `CookTimeRange` model
- [ ] JSON serialization

---

## Phase 6: Meal Detail & Editing

### 6.1 Meal Detail Screen
- [ ] Hero image display
- [ ] Meal metadata (type, time, cost)
- [ ] Diet badges
- [ ] Macros display row
- [ ] Ingredients list with images
- [ ] Cooking steps list
- [ ] Save button
- [ ] Share button
- [ ] Add to cart button

### 6.2 MealCard Component
- [ ] 80x80 thumbnail
- [ ] Meal type badge
- [ ] Cook time badge
- [ ] Cost estimate badge
- [ ] Diet compliance badges (max 2)
- [ ] Name and description
- [ ] Macros row with icons
- [ ] View button
- [ ] Optional action button slot
- [ ] Optional bottom actions slot
- [ ] Entrance animation

### 6.3 AI Chat Editing
- [ ] Chat interface UI
- [ ] Send message to `/api/meal-thread`
- [ ] Display AI response
- [ ] Handle meal updates
- [ ] Show dietary warnings
- [ ] Chat quota tracking (free tier)

### 6.4 Ingredient Display
- [ ] Ingredient name and quantity
- [ ] Product image (from Kroger)
- [ ] Price display
- [ ] Stock status indicator
- [ ] Swap product button

---

## Phase 7: Saved Meals

### 7.1 Saved Meals Screen
- [ ] Real-time Firestore listener
- [ ] Search by name
- [ ] Filter by meal type
- [ ] Sort by date saved
- [ ] Empty state for no meals
- [ ] Pull to refresh

### 7.2 Save Meal Flow
- [ ] Save button on meal detail
- [ ] Write to `savedMeals/{uid}/meals`
- [ ] Show success toast
- [ ] Log `MEAL_SAVED` event

### 7.3 Saved Meal Actions
- [ ] View full recipe
- [ ] Delete meal (with confirmation)
- [ ] Share meal
- [ ] Re-cook (add to shopping list)

### 7.4 Saved Meal Detail
- [ ] Same layout as generated meal
- [ ] "Saved" badge indicator
- [ ] Delete option
- [ ] Edit via AI chat

---

## Phase 8: Shopping List

### 8.1 Shopping List Screen
- [ ] Real-time Firestore listener
- [ ] Unchecked items section
- [ ] Checked items section (collapsible)
- [ ] Item count display
- [ ] Clear all button
- [ ] Estimated total

### 8.2 Shopping Item Component
- [ ] Checkbox for checked state
- [ ] Product image
- [ ] Name and quantity
- [ ] Price
- [ ] Source meal reference
- [ ] Swap button
- [ ] Remove button

### 8.3 Add to Shopping List
- [ ] Extract ingredients from meal
- [ ] Filter excluded items (water, ice)
- [ ] Handle staple deduplication
- [ ] Combine countable quantities
- [ ] Write to Firestore

### 8.4 Ingredient Utilities
- [ ] Port `normalizeIngredientName()` to Dart
- [ ] Port `isExcludedIngredient()` to Dart
- [ ] Port `isStapleItem()` to Dart
- [ ] Port `isSameIngredient()` to Dart
- [ ] Port quantity parsing/calculation

### 8.5 Kroger Product Enrichment
- [ ] Call `/api/kroger/enrich` endpoint
- [ ] Update shopping items with Kroger data
- [ ] Display product images
- [ ] Display prices
- [ ] Display stock levels

### 8.6 Add to Kroger Cart
- [ ] Call `/api/kroger/cart` endpoint
- [ ] Calculate units needed
- [ ] Handle success/failure
- [ ] Show result summary
- [ ] Link to Kroger cart URL

---

## Phase 9: Kroger Integration

### 9.1 OAuth Flow
- [ ] Link account button on setup/account
- [ ] Redirect to `/api/kroger/auth`
- [ ] Handle OAuth callback via deep link
- [ ] Store connection status
- [ ] Show connected state

### 9.2 Store Selection
- [ ] `StoreSearchModal` component
- [ ] ZIP code search input
- [ ] Display nearby stores
- [ ] Select store
- [ ] Save default store

### 9.3 Connection Status
- [ ] Check `/api/kroger/status`
- [ ] Display store name
- [ ] Handle token expiration
- [ ] Unlink account option

### 9.4 Product Swap
- [ ] Call `/api/swap-suggestions`
- [ ] Display alternative products
- [ ] Show avoid warnings
- [ ] Update shopping item

---

## Phase 10: Fresh Picks (Recommendations)

### 10.1 Fresh Picks Screen
- [ ] Check saved meal count (5+ required)
- [ ] Show unlock message if insufficient
- [ ] Call `/api/fresh-picks` endpoint
- [ ] Display 4 meal cards
- [ ] Handle cache (24h)

### 10.2 Feedback System
- [ ] Like button on each meal
- [ ] Dislike button on each meal
- [ ] Call `/api/fresh-picks/feedback`
- [ ] Remove acted-on meals from view
- [ ] Store feedback for future picks

### 10.3 Fresh Pick Actions
- [ ] View full recipe
- [ ] Save to favorites
- [ ] Add to shopping list

---

## Phase 11: Subscription & Payments

### 11.1 Upgrade Screen
- [ ] Display plan options (Individual, Family)
- [ ] Monthly/yearly toggle
- [ ] Feature comparison
- [ ] Current plan indicator
- [ ] CTA button

### 11.2 Stripe Checkout
- [ ] Call `/api/stripe/checkout`
- [ ] Open checkout URL in browser/webview
- [ ] Handle success redirect
- [ ] Update user subscription status

### 11.3 Subscription Management
- [ ] Call `/api/stripe/portal`
- [ ] Open billing portal
- [ ] Handle subscription changes via webhook

### 11.4 Usage Tracking
- [ ] Track monthly prompt count
- [ ] Track monthly chat count
- [ ] Show usage in account screen
- [ ] Show limit warnings
- [ ] Block generation when limit reached

### 11.5 Feature Gating
- [ ] `isPremium` check helper
- [ ] `UpgradePrompt` component
- [ ] Gate diet instructions
- [ ] Gate family members (family plan only)

---

## Phase 12: Sharing System

### 12.1 Share Modal
- [ ] `ShareModal` component
- [ ] Generate share link via `/api/share`
- [ ] Copy link button
- [ ] Facebook share button
- [ ] Twitter share button
- [ ] Email share button

### 12.2 Public Share Page
- [ ] Deep link handling for `/share/{id}`
- [ ] Display shared meal preview
- [ ] Sign up CTA for non-users

### 12.3 Claim Shared Meal
- [ ] Detect pending share on login
- [ ] Call `/api/share/claim`
- [ ] Save to user's meals
- [ ] Show success toast

---

## Phase 13: Family Management (Premium)

### 13.1 Family Members Screen
- [ ] List family members
- [ ] Add member button
- [ ] Edit member
- [ ] Delete member (with confirmation)
- [ ] Active/inactive toggle

### 13.2 Family Member Form
- [ ] Name input
- [ ] Diet type selector
- [ ] Allergies picker
- [ ] Sensitivities picker
- [ ] Disliked foods input

### 13.3 Family Conflict Detection
- [ ] Combine all active member restrictions
- [ ] Show member name in conflict modal
- [ ] Attribute conflicts to specific members

---

## Phase 14: Diet Instructions (Premium)

### 14.1 Diet Instructions Screen
- [ ] Upload photo button
- [ ] Multi-page support (up to 5)
- [ ] Image preview
- [ ] Process button

### 14.2 OCR Processing
- [ ] Convert images to base64
- [ ] Call `/api/diet-restrictions`
- [ ] Display parsed results
- [ ] Review blocked ingredients
- [ ] Review blocked groups
- [ ] Confirm and save

### 14.3 Active Instructions Badge
- [ ] Show "Diet Guardrails Active" badge
- [ ] Display summary text
- [ ] Edit/remove instructions

---

## Phase 15: Preference Learning

### 15.1 Event Logging
- [ ] Port event types from FEATURES_BUSINESS_LOGIC.md
- [ ] Log `MEAL_ACCEPTED` events
- [ ] Log `MEAL_SAVED` events
- [ ] Log `INGREDIENT_ADDED/REMOVED` events
- [ ] Log `CART_ADDED` events
- [ ] Write to `foodEvents` collection

### 15.2 Preference Locks
- [ ] Preference lock UI (future feature)
- [ ] ALWAYS_INCLUDE / NEVER_INCLUDE rules
- [ ] Call `/api/preferences/locks` endpoints

---

## Phase 16: Polish & Optimization

### 16.1 Animations
- [ ] Meal card entrance animations (staggered)
- [ ] Modal scale-up animation
- [ ] Bottom sheet slide-up animation
- [ ] Toast enter/exit animations
- [ ] Loading spinner
- [ ] Pull-to-refresh indicator

### 16.2 Loading States
- [ ] Shimmer placeholders for images
- [ ] Skeleton screens for lists
- [ ] Button loading states
- [ ] Screen loading overlays

### 16.3 Error Handling
- [ ] Network error handling
- [ ] API error parsing
- [ ] User-friendly error messages
- [ ] Retry mechanisms
- [ ] Offline state handling

### 16.4 Performance
- [ ] Image lazy loading
- [ ] List virtualization
- [ ] Firestore query optimization
- [ ] Minimize rebuilds with Riverpod
- [ ] Cache API responses where appropriate

### 16.5 Accessibility
- [ ] Semantic labels for screen readers
- [ ] Sufficient color contrast
- [ ] Touch target sizes (48x48 minimum)
- [ ] Focus management

---

## Phase 17: Testing

### 17.1 Unit Tests
- [ ] Ingredient normalization functions
- [ ] Quantity parsing/calculation
- [ ] Conflict detection logic
- [ ] Model serialization

### 17.2 Widget Tests
- [ ] Button variants
- [ ] Form input validation
- [ ] MealCard display
- [ ] Modal behavior

### 17.3 Integration Tests
- [ ] Auth flow (signup → verify → login)
- [ ] Meal generation flow
- [ ] Save meal flow
- [ ] Shopping list management

### 17.4 E2E Tests
- [ ] Full user journey (new user)
- [ ] Meal generation to cart
- [ ] Subscription upgrade

---

## Phase 18: Deployment

### 18.1 iOS
- [ ] Configure App Store Connect
- [ ] Set up provisioning profiles
- [ ] Configure app entitlements
- [ ] Universal links for deep linking
- [ ] App Store screenshots
- [ ] App Store description

### 18.2 Android
- [ ] Configure Google Play Console
- [ ] Sign release build
- [ ] Configure app links
- [ ] Play Store screenshots
- [ ] Play Store description

### 18.3 CI/CD
- [ ] Set up GitHub Actions (or similar)
- [ ] Automated testing on PR
- [ ] Automated builds for releases
- [ ] TestFlight/Firebase App Distribution for beta

### 18.4 Analytics & Monitoring
- [ ] Firebase Analytics integration
- [ ] Firebase Crashlytics
- [ ] Performance monitoring

---

## Quick Reference: Feature Parity Checklist

| Feature | Web | Flutter | Notes |
|---------|-----|---------|-------|
| Email auth | ✅ | ☐ | Firebase Auth |
| Email verification | ✅ | ☐ | Custom flow |
| Setup wizard | ✅ | ☐ | 5 steps |
| Meal generation | ✅ | ☐ | SSE streaming |
| Pantry mode | ✅ | ☐ | Toggle in prompt |
| Conflict detection | ✅ | ☐ | Port logic |
| AI chat editing | ✅ | ☐ | Chat UI |
| Save meals | ✅ | ☐ | Firestore |
| Fresh Picks | ✅ | ☐ | 5+ meals required |
| Shopping list | ✅ | ☐ | Real-time sync |
| Kroger OAuth | ✅ | ☐ | Web redirect |
| Kroger enrichment | ✅ | ☐ | Product data |
| Add to Kroger cart | ✅ | ☐ | Cart API |
| Meal sharing | ✅ | ☐ | Deep links |
| Family management | ✅ | ☐ | Premium only |
| Diet instructions OCR | ✅ | ☐ | Premium only |
| Stripe subscriptions | ✅ | ☐ | Web checkout |
| Preference learning | ✅ | ☐ | Event logging |
| Offline support | ✅ | ☐ | Firestore cache |

---

## Estimated Effort

| Phase | Components | Estimated Days |
|-------|------------|----------------|
| 1. Setup | Infrastructure | 2-3 |
| 2. Design System | Core components | 3-4 |
| 3. Auth | Login/signup/verify | 2-3 |
| 4. User Profile | Account management | 2 |
| 5. Meal Generation | Core feature | 4-5 |
| 6. Meal Detail | View & edit | 3 |
| 7. Saved Meals | CRUD operations | 2 |
| 8. Shopping List | List management | 3 |
| 9. Kroger | OAuth & cart | 3-4 |
| 10. Fresh Picks | Recommendations | 2 |
| 11. Subscriptions | Payments | 2 |
| 12. Sharing | Deep links | 1-2 |
| 13. Family | Premium feature | 2 |
| 14. Diet Instructions | OCR feature | 2 |
| 15. Preference Learning | Event system | 1 |
| 16. Polish | Animations, errors | 3 |
| 17. Testing | All test types | 3-4 |
| 18. Deployment | App stores | 2-3 |

**Total Estimated: 40-50 developer days**

---

*Checklist generated from CartSense Flutter migration documentation*
