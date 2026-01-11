# CartSense UI Component Inventory

This document provides a complete inventory of UI components, design tokens, and screen layouts for Flutter mobile app development.

---

## Table of Contents

1. [Design System Tokens](#design-system-tokens)
2. [Core Components](#core-components)
3. [Composite Components](#composite-components)
4. [Screen Layouts](#screen-layouts)
5. [Navigation Structure](#navigation-structure)
6. [Animations](#animations)
7. [Flutter Implementation Guide](#flutter-implementation-guide)

---

## Design System Tokens

### Colors

```dart
// Primary Brand Colors
static const primaryBlue = Color(0xFF4A90E2);
static const primaryBlueDark = Color(0xFF357ABD);

// Semantic Colors
static const success = Color(0xFF10B981);
static const successDark = Color(0xFF059669);
static const warning = Color(0xFFF97316);
static const warningDark = Color(0xFFEA580C);
static const error = Color(0xFFEF4444);
static const errorDark = Color(0xFFDC2626);
static const info = Color(0xFF3B82F6);
static const infoDark = Color(0xFF2563EB);

// Background Colors
static const appBg = Color(0xFFF8FAFB);
static const cardBg = Color(0xFFFFFFFF);

// Gray Scale
static const gray50 = Color(0xFFF8FAFB);
static const gray100 = Color(0xFFF3F4F6);
static const gray200 = Color(0xFFE5E7EB);
static const gray300 = Color(0xFFD1D5DB);
static const gray400 = Color(0xFF9CA3AF);
static const gray500 = Color(0xFF6B7280);
static const gray600 = Color(0xFF4B5563);
static const gray700 = Color(0xFF374151);
static const gray900 = Color(0xFF111827);

// Macro Indicator Colors
static const macroCalories = Color(0xFFF97316);  // Orange (flame)
static const macroProtein = Color(0xFF3B82F6);   // Blue (meat/bean)
static const macroCarbs = Color(0xFFF59E0B);     // Amber (wheat)
static const macroFat = Color(0xFFA855F7);       // Purple (droplet)
static const macroFiber = Color(0xFF10B981);     // Green

// Accent Colors (for variety)
static const accentColors = [
  (primary: Color(0xFF10B981), dark: Color(0xFF059669)), // Green
  (primary: Color(0xFFF97316), dark: Color(0xFFEA580C)), // Orange
  (primary: Color(0xFFA855F7), dark: Color(0xFF9333EA)), // Purple
  (primary: Color(0xFF3B82F6), dark: Color(0xFF2563EB)), // Blue
  (primary: Color(0xFFEC4899), dark: Color(0xFFDB2777)), // Pink
  (primary: Color(0xFF14B8A6), dark: Color(0xFF0D9488)), // Teal
];
```

### Typography

```dart
// Heading Styles
static const h1 = TextStyle(
  fontSize: 24,      // 1.5rem
  fontWeight: FontWeight.w500,
  height: 1.3,
  color: gray900,
);

static const h2 = TextStyle(
  fontSize: 20,      // 1.25rem
  fontWeight: FontWeight.w500,
  height: 1.3,
  color: gray900,
);

static const h3 = TextStyle(
  fontSize: 18,      // 1.125rem
  fontWeight: FontWeight.w500,
  height: 1.4,
  color: gray700,
);

static const h4 = TextStyle(
  fontSize: 16,      // 1rem
  fontWeight: FontWeight.w500,
  height: 1.4,
  color: gray700,
);

// Body Text
static const bodyLarge = TextStyle(
  fontSize: 16,
  fontWeight: FontWeight.w400,
  height: 1.5,
  color: gray600,
);

static const bodyMedium = TextStyle(
  fontSize: 14,
  fontWeight: FontWeight.w400,
  height: 1.5,
  color: gray600,
);

static const bodySmall = TextStyle(
  fontSize: 12,
  fontWeight: FontWeight.w400,
  height: 1.5,
  color: gray500,
);

// Labels
static const labelMedium = TextStyle(
  fontSize: 14,
  fontWeight: FontWeight.w500,
  color: gray700,
);

static const labelSmall = TextStyle(
  fontSize: 12,
  fontWeight: FontWeight.w500,
  color: gray600,
);
```

### Spacing

```dart
// Base unit: 4px
static const spacing = (
  xs: 4.0,    // 4px
  sm: 8.0,    // 8px
  md: 12.0,   // 12px
  lg: 16.0,   // 16px
  xl: 20.0,   // 20px
  xxl: 24.0,  // 24px
  xxxl: 32.0, // 32px
);

// Component-specific
static const bottomNavHeight = 96.0;
static const cardPadding = 16.0;
static const screenPadding = 16.0;
```

### Border Radius

```dart
static const radius = (
  sm: 8.0,    // rounded-lg
  md: 12.0,   // rounded-xl
  lg: 16.0,   // rounded-2xl
  xl: 20.0,   // rounded-2xl
  full: 9999.0, // rounded-full
);
```

### Shadows

```dart
static const shadowSm = [
  BoxShadow(
    color: Color(0x0D000000),
    blurRadius: 4,
    offset: Offset(0, 1),
  ),
];

static const shadowMd = [
  BoxShadow(
    color: Color(0x1A000000),
    blurRadius: 8,
    offset: Offset(0, 4),
  ),
];

static const shadowLg = [
  BoxShadow(
    color: Color(0x1A000000),
    blurRadius: 16,
    offset: Offset(0, 8),
  ),
];
```

---

## Core Components

### Button

```dart
enum ButtonVariant { primary, secondary, outline, ghost, danger }
enum ButtonSize { sm, md, lg }

class AppButton extends StatelessWidget {
  final ButtonVariant variant;
  final ButtonSize size;
  final bool loading;
  final Widget? icon;
  final IconPosition iconPosition;
  final bool fullWidth;
  final Gradient? gradient;  // For custom gradient colors
  final VoidCallback? onPressed;
  final Widget child;
}
```

**Variant Styles:**

| Variant | Background | Text | Border |
|---------|------------|------|--------|
| `primary` | Gradient blue (#4A90E2 → #357ABD) | White | None |
| `secondary` | Gray-100 | Gray-700 | None |
| `outline` | White | Gray-700 | 2px Gray-200 |
| `ghost` | Blue 10% opacity | Blue | None |
| `danger` | Red-500 | White | None |

**Size Styles:**

| Size | Padding | Font Size | Border Radius |
|------|---------|-----------|---------------|
| `sm` | 12h × 8v | 14px | 8px |
| `md` | 16h × 10v | 14px | 12px |
| `lg` | 24h × 12v | 16px | 12px |

---

### FormInput

```dart
class FormInput extends StatelessWidget {
  final String? label;
  final Widget? icon;        // Leading icon
  final String? error;
  final InputSize size;
  final TextEditingController? controller;
  final String? placeholder;
  final bool obscureText;
  final TextInputType? keyboardType;
  final ValueChanged<String>? onChanged;
}
```

**States:**
- Default: Gray-50 background, Gray-200 border
- Focus: White background, Blue border
- Error: Gray-50 background, Red-300 border, Red-500 error text below

---

### Card

```dart
class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets? padding;  // none, sm (12), md (16), lg (20)
  final bool hover;           // Add shadow on hover/tap
  final VoidCallback? onTap;
}
```

**Style:**
- Background: White
- Border: 1px Gray-100
- Border Radius: 16px
- Shadow: None by default, shadowMd on hover

---

### Modal

```dart
enum ModalVariant { center, bottomSheet }
enum ModalSize { sm, md, lg, xl }

class AppModal extends StatelessWidget {
  final bool isOpen;
  final VoidCallback onClose;
  final String? title;
  final String? subtitle;
  final Widget child;
  final Widget? footer;
  final ModalVariant variant;
  final ModalSize size;
  final bool showCloseButton;
}
```

**Behavior:**
- `center`: Centered with scale-up animation
- `bottomSheet`: Slides up from bottom, rounded top corners only on mobile

**Sizes:**

| Size | Max Width |
|------|-----------|
| `sm` | 320px |
| `md` | 400px |
| `lg` | 512px |
| `xl` | 576px |

---

### Alert

```dart
enum AlertVariant { success, error, warning, info }

class AppAlert extends StatelessWidget {
  final AlertVariant variant;
  final Widget? icon;
  final String? title;
  final Widget child;
  final VoidCallback? onClose;
  final AlertAction? action;  // { label, onPressed }
}
```

**Color Schemes:**

| Variant | Background | Border | Icon | Text |
|---------|------------|--------|------|------|
| `success` | Emerald-50 | Emerald-200 | Emerald-600 | Emerald-800 |
| `error` | Red-50 | Red-200 | Red-600 | Red-800 |
| `warning` | Amber-50 | Amber-200 | Amber-600 | Amber-800 |
| `info` | Blue-50 | Blue-200 | Blue-600 | Blue-800 |

---

### Toast

```dart
enum ToastType { success, error, info }

// Usage via context
showToast(context, "Message here", ToastType.success);

// Implementation: Shows at top-center, auto-dismisses after 2 seconds
// Stacks multiple toasts vertically
```

---

### LoadingSpinner

```dart
enum SpinnerSize { sm, md, lg }
enum SpinnerColor { primary, white }

class LoadingSpinner extends StatelessWidget {
  final SpinnerSize size;
  final SpinnerColor color;
}
```

**Sizes:** sm=16px, md=24px, lg=32px

---

### EmptyState

```dart
class EmptyState extends StatelessWidget {
  final Widget icon;        // Shown in 64px circle with gray-100 bg
  final String title;
  final String description;
  final EmptyStateAction? action;  // { label, onPressed, gradient? }
}
```

---

## Composite Components

### MealCard

The primary card for displaying meal summaries.

```dart
class MealCard extends StatelessWidget {
  final String id;
  final String name;
  final String description;
  final String mealType;      // breakfast, lunch, dinner, snack
  final Macros macros;
  final String? imageUrl;
  final CookTimeRange? cookTimeRange;
  final VoidCallback onTap;
  final Widget? badge;        // Optional badge (e.g., "Fresh Pick")
  final Widget? actionButton; // Top-right action (e.g., delete)
  final Widget? bottomActions;// Full-width bottom buttons
  final Widget? inlineActions;// Actions next to View button
  final int? animationDelay;  // Staggered entrance animation
  final String? dietType;     // For protein icon (bean vs meat)
  final bool isPremium;
  final List<String> dietBadges; // Compliant diet labels
  final double? estimatedCost;
}
```

**Layout:**
```
┌──────────────────────────────────────────┐
│ ┌────────┐  meal type • 15-20m • $25     │
│ │        │  [keto] [dairy-free]          │
│ │ IMAGE  │  Meal Name                    │
│ │ 80×80  │  Description text...          │
│ └────────┘  🔥420  🥩32g  🌾28g  💧18g   │
│             [View →] [Quick actions]     │
├──────────────────────────────────────────┤
│ [Bottom action buttons full width]       │
└──────────────────────────────────────────┘
```

**Macros Display:**
- Calories: Flame icon (orange)
- Protein: Meat icon (blue) or Bean icon (green for veg/vegan)
- Net Carbs: Wheat icon (amber) - shows (carbs - fiber)
- Fat: Droplet icon (purple)

---

### MealImage

Lazy-loaded image with placeholder.

```dart
class MealImage extends StatelessWidget {
  final String? src;
  final String alt;
  final bool isPremium;  // Shows sparkle badge overlay
}
```

**States:**
- Loading: Gray shimmer placeholder
- Loaded: Fade-in image
- Error: Gray placeholder with utensils icon

---

### ShareModal

Modal for sharing meals via link, social, or email.

```dart
class ShareModal extends StatelessWidget {
  final bool isOpen;
  final VoidCallback onClose;
  final Meal meal;
}
```

**Features:**
- Auto-generates share link on open
- Copy link button
- Facebook, Twitter share buttons
- Email share button

---

### DietaryConflictModal

Warning modal when prompt conflicts with user restrictions.

```dart
class DietaryConflictModal extends StatelessWidget {
  final bool isOpen;
  final VoidCallback onClose;
  final List<Conflict> conflicts;
  final VoidCallback onProceed;  // Override and continue
  final VoidCallback onCancel;
}
```

**Conflict Display:**
- Groups by severity (allergies first, then diet, then sensitivities)
- Shows family member name if applicable
- Prominent warning styling

---

### StoreSearchModal

Kroger store location picker.

```dart
class StoreSearchModal extends StatelessWidget {
  final bool isOpen;
  final VoidCallback onClose;
  final ValueChanged<KrogerLocation> onSelect;
}
```

**Features:**
- ZIP code search
- List of nearby stores with address
- Current store highlighted
- Select button

---

### UpgradePrompt

CTA component for premium features.

```dart
class UpgradePrompt extends StatelessWidget {
  final String title;
  final String description;
  final String? ctaLabel;
}
```

---

## Screen Layouts

### App Shell

```
┌─────────────────────────────────────────┐
│               HEADER BAR                 │
│  (Logo/Title)           (Action icons)   │
├─────────────────────────────────────────┤
│                                         │
│                                         │
│              PAGE CONTENT               │
│           (Scrollable area)             │
│                                         │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│            BOTTOM NAVIGATION            │
│ [Home] [Saved] [list] [Fresh] [Account] │
│         (96px height with safe area)    │
└─────────────────────────────────────────┘
```

### Screen Inventory

| Screen | Route | Description |
|--------|-------|-------------|
| **Prompt** | `/prompt` | Main meal generation input |
| **Meals** | `/meals` | Streaming meal results |
| **Meal Detail** | `/meals/[id]` | Full recipe view with actions |
| **Saved Meals** | `/saved-meals` | User's saved meal collection |
| **Saved Meal Detail** | `/saved-meals/[id]` | Saved meal recipe view |
| **Shopping List** | `/shopping-list` | Aggregated shopping items |
| **Fresh Picks** | `/fresh-picks` | Daily recommendations |
| **Account** | `/account` | Profile, preferences, family |
| **Diet Instructions** | `/diet-instructions` | OCR diet note upload |
| **Setup** | `/setup` | Onboarding wizard (5 steps) |
| **Upgrade** | `/upgrade` | Subscription plans |
| **Share** | `/share/[id]` | Public shared meal page |

---

### Prompt Screen Layout

```
┌─────────────────────────────────────────┐
│ What are you in the mood for?           │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ Type what you want to cook...       │ │
│ │ ________________________________    │ │
│ │                                     │ │
│ │ [Pantry Mode Toggle]                │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ Quick Prompts                           │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│ │ Quick   │ │ High    │ │ Budget  │    │
│ │Weeknight│ │ Protein │ │Friendly │    │
│ └─────────┘ └─────────┘ └─────────┘    │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│ │ Meal    │ │  Keto   │ │  Slow   │    │
│ │  Prep   │ │         │ │ Cooker  │    │
│ └─────────┘ └─────────┘ └─────────┘    │
├─────────────────────────────────────────┤
│ [         Generate Meals          ]     │
│           (Primary gradient)            │
└─────────────────────────────────────────┘
```

---

### Meal Detail Screen Layout

```
┌─────────────────────────────────────────┐
│ ← Back                     [Share] [♥]  │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │           HERO IMAGE                │ │
│ │           (16:9 ratio)              │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ Meal Name                               │
│ [breakfast] [15-20m] [$25]              │
│ Description text here...                │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 🔥420cal  🥩32g  🌾28g net  💧18g   │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ Ingredients                             │
│ ┌─────────────────────────────────────┐ │
│ │ [IMG] Chicken Breast     2 lbs      │ │
│ │       $8.99 • In Stock              │ │
│ │ [IMG] Olive Oil          2 tbsp     │ │
│ │       (staple item)                 │ │
│ │ ...                                 │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ Instructions                            │
│ 1. Preheat oven to 400°F...            │
│ 2. Season chicken with...              │
│ ...                                     │
├─────────────────────────────────────────┤
│ [Add to Cart] [Add to list]
└─────────────────────────────────────────┘
```

---

### Shopping List Screen Layout

```
┌─────────────────────────────────────────┐
│ Shopping List              [Clear All]  │
├─────────────────────────────────────────┤
│ Store: Smith's - Downtown    [Change]   │
├─────────────────────────────────────────┤
│ Unchecked Items (12)                    │
│ ┌─────────────────────────────────────┐ │
│ │ ☐ [IMG] Chicken Breast              │ │
│ │         2 lbs • $8.99               │ │
│ │         From: Honey Garlic Chicken  │ │
│ │         [Swap] [Remove]             │ │
│ ├─────────────────────────────────────┤ │
│ │ ☐ [IMG] Olive Oil                   │ │
│ │         1 bottle • $7.99            │ │
│ │ ...                                 │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ Checked Items (3)           [Collapse]  │
│ ┌─────────────────────────────────────┐ │
│ │ ☑ Salt                              │ │
│ │ ☑ Pepper                            │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ Estimated Total: $45.50                 │
│ [   Add All to Kroger Cart   ]          │
└─────────────────────────────────────────┘
```

---

## Navigation Structure

### Bottom Navigation Tabs

| Tab | Icon | Label | Route |
|-----|------|-------|-------|
| Home | `UtensilsCrossed` | Home | `/prompt` |
| Saved | `Bookmark` | Saved | `/saved-meals` |
| list | `ShoppingCart` | list | `/shopping-list` |
| Fresh | `Sparkles` | Fresh | `/fresh-picks` |
| Account | `user` | Account | `/account` |

### Active State
- Icon: Filled version or primary blue color
- Label: Primary blue
- Background: Light blue pill shape

### Badge Indicators
- Shopping cart shows item count badge
- Fresh Picks shows "NEW" badge when new picks available

---

## Animations

### Entrance Animations

```dart
// Fade Slide In (for meal cards, lists)
@keyframes fadeSlideIn {
  from: opacity 0, translateY 12px
  to: opacity 1, translateY 0
  duration: 400ms
  easing: easeOut
}

// Scale Up (for modals)
@keyframes scaleUp {
  from: opacity 0, scale 0.95
  to: opacity 1, scale 1
  duration: 200ms
  easing: easeOut
}

// Slide Up (for bottom sheets)
@keyframes slideUp {
  from: opacity 0, translateY 100%
  to: opacity 1, translateY 0
  duration: 300ms
  easing: easeOut
}

// Fade In (general)
@keyframes fadeIn {
  from: opacity 0
  to: opacity 1
  duration: 200ms
}
```

### Toast Animations

```dart
// Enter: Slide down + scale up from top
@keyframes toastEnter {
  from: opacity 0, translateY -16px, scale 0.95
  to: opacity 1, translateY 0, scale 1
  duration: 300ms
}

// Exit: Slide up + scale down
@keyframes toastExit {
  from: opacity 1, translateY 0, scale 1
  to: opacity 0, translateY -16px, scale 0.95
  duration: 300ms
}
```

### Loading States

```dart
// Spinner: Continuous rotation
// Duration: 900ms per rotation
// Easing: linear

// Bounce Bar (indeterminate progress)
// Moves bar back and forth
// Duration: 1500ms cycle
```

### Staggered List Animations

```dart
// Meal cards animate in sequence
// Each card delayed by index * 100ms
// Animation: fadeSlideIn
```

---

## Flutter Implementation Guide

### Project Structure

```
lib/
├── main.dart
├── app/
│   ├── router.dart              # GoRouter configuration
│   └── theme.dart               # ThemeData
├── core/
│   ├── constants/
│   │   ├── colors.dart
│   │   ├── spacing.dart
│   │   └── typography.dart
│   └── utils/
│       ├── formatters.dart
│       └── validators.dart
├── features/
│   ├── auth/
│   │   ├── screens/
│   │   │   ├── login_screen.dart
│   │   │   └── signup_screen.dart
│   │   └── providers/
│   │       └── auth_provider.dart
│   ├── meals/
│   │   ├── screens/
│   │   │   ├── prompt_screen.dart
│   │   │   ├── meals_screen.dart
│   │   │   └── meal_detail_screen.dart
│   │   ├── widgets/
│   │   │   ├── meal_card.dart
│   │   │   └── macros_display.dart
│   │   └── providers/
│   │       └── meals_provider.dart
│   ├── shopping/
│   ├── fresh_picks/
│   └── account/
├── shared/
│   ├── widgets/
│   │   ├── app_button.dart
│   │   ├── app_card.dart
│   │   ├── app_modal.dart
│   │   ├── app_alert.dart
│   │   ├── form_input.dart
│   │   ├── loading_spinner.dart
│   │   ├── empty_state.dart
│   │   └── toast_provider.dart
│   └── layouts/
│       ├── app_shell.dart
│       └── bottom_nav.dart
└── services/
    ├── api_service.dart
    ├── auth_service.dart
    └── firestore_service.dart
```

### Theme Configuration

```dart
ThemeData get theme => ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(
    seedColor: AppColors.primaryBlue,
    background: AppColors.appBg,
    surface: AppColors.cardBg,
  ),
  scaffoldBackgroundColor: AppColors.appBg,
  fontFamily: 'SF Pro Display', // Or system font
  textTheme: const TextTheme(
    headlineLarge: AppTypography.h1,
    headlineMedium: AppTypography.h2,
    headlineSmall: AppTypography.h3,
    titleMedium: AppTypography.h4,
    bodyLarge: AppTypography.bodyLarge,
    bodyMedium: AppTypography.bodyMedium,
    bodySmall: AppTypography.bodySmall,
    labelMedium: AppTypography.labelMedium,
    labelSmall: AppTypography.labelSmall,
  ),
  cardTheme: CardTheme(
    color: AppColors.cardBg,
    elevation: 0,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(16),
      side: BorderSide(color: AppColors.gray100),
    ),
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: AppColors.gray50,
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: AppColors.gray200),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: AppColors.primaryBlue, width: 2),
    ),
  ),
  elevatedButtonTheme: ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      backgroundColor: AppColors.primaryBlue,
      foregroundColor: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    ),
  ),
);
```

### Icons

The web app uses **Lucide Icons**. Flutter equivalent: `lucide_icons` package.

```yaml
dependencies:
  lucide_icons: ^0.257.0
```

Key icons used:
- `LucideIcons.flame` - Calories
- `LucideIcons.beef` / `LucideIcons.bean` - Protein
- `LucideIcons.wheat` - Carbs
- `LucideIcons.droplet` - Fat
- `LucideIcons.clock` - Cook time
- `LucideIcons.bookmark` - Save
- `LucideIcons.share2` - Share
- `LucideIcons.shoppingCart` - Cart
- `LucideIcons.sparkles` - Fresh Picks
- `LucideIcons.check` - Success
- `LucideIcons.alertCircle` - Error
- `LucideIcons.x` - Close
- `LucideIcons.chevronRight` - Navigate

### Recommended Packages

```yaml
dependencies:
  flutter:
    sdk: flutter

  # State Management
  flutter_riverpod: ^2.4.0

  # Routing
  go_router: ^12.0.0

  # Firebase
  firebase_core: ^2.24.0
  firebase_auth: ^4.16.0
  cloud_firestore: ^4.14.0

  # Networking
  dio: ^5.4.0

  # Images
  cached_network_image: ^3.3.0

  # Icons
  lucide_icons: ^0.257.0

  # UI
  shimmer: ^3.0.0              # Loading placeholders
  flutter_animate: ^4.3.0       # Animations
  url_launcher: ^6.2.0          # External links
  share_plus: ^7.2.0            # Native share sheet

  # Payments
  flutter_stripe: ^10.0.0

  # Utilities
  intl: ^0.18.0                 # Formatting
```

### Safe Area Handling

```dart
// Bottom navigation with safe area
Scaffold(
  body: ...,
  bottomNavigationBar: SafeArea(
    child: SizedBox(
      height: 96,
      child: BottomNavigation(...),
    ),
  ),
)
```

---

*Document generated for Flutter mobile app migration*
