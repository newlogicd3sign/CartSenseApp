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

### ServingsAdjuster

Controls serving count with -/+ buttons. Affects ingredient quantities and macros.

```dart
class ServingsAdjuster extends StatelessWidget {
  final int currentServings;
  final int baseServings;      // Original recipe servings
  final int minServings;       // Default: 1
  final int maxServings;       // Default: 20
  final ValueChanged<int> onChanged;
}
```

**Layout:**
```
┌─────────────────────────────────────────┐
│ 👥 Servings                [-] 4 [+]    │
└─────────────────────────────────────────┘
```

**Style:**
- Container: White card with gray-100 border, rounded-2xl, p-5
- Icon: Users, gray-400
- Label: "Servings", font-medium, gray-900
- Buttons: 32×32 circular, gray-100 bg, hover gray-200
- Disabled state: opacity-40 when at min/max
- Number: text-lg font-semibold, 24px width, centered

---

### IngredientRow

Displays a single ingredient with product info and selection checkbox.

```dart
class IngredientRow extends StatelessWidget {
  final Ingredient ingredient;
  final int index;
  final bool isSelected;
  final bool isInPantry;
  final double servingMultiplier;
  final bool showKrogerData;      // true if Kroger connected
  final bool showInstacartPrices; // true if Instacart preference
  final VoidCallback? onTap;      // Opens swap modal (Kroger only)
  final VoidCallback onToggle;    // Toggle checkbox
}
```

**Layout (Kroger connected):**
```
┌─────────────────────────────────────────────────┐
│ [Product   ]  Chicken Breast           [✓]     │
│ [ Image    ]  16 oz • Meat & Seafood           │
│ [ 48×48    ]  $8.99                            │
│              [In pantry] [Low Stock]            │
└─────────────────────────────────────────────────┘
```

**Layout (Instacart / No Kroger):**
```
┌─────────────────────────────────────────────────┐
│ [Ingredient]  Chicken Breast           [✓]     │
│ [ Image    ]  Est. $6.99 - $9.99               │
│ [ 48×48    ]                                   │
└─────────────────────────────────────────────────┘
```

**States:**
- Unselected: opacity-50, name has line-through
- Selected: full opacity, blue checkbox filled
- In Pantry: emerald-100 badge with "In pantry"
- Low Stock: amber-100 badge with "Low Stock"
- Out of Stock: red-100 badge with "Out of Stock"

**Image Fallback:**
If product image fails, show category icon:
- Protein → Ham icon (red-400)
- Eggs → Egg icon (amber-400)
- Dairy → Milk icon (blue-400)
- Produce → Leaf icon (green-500)
- Carbs → Wheat icon (amber-500)
- Fats/Oils → Droplet icon (yellow-500)
- Snacks → Cookie icon (orange-400)
- Beans → Bean icon (amber-600)
- Pantry → Flask icon (stone-500)
- Fruits → Apple icon (red-500)
- Default → Package icon (gray-400)

---

### RecipeQuantitiesCard

Displays scaled ingredient quantities in 2-column grid.

```dart
class RecipeQuantitiesCard extends StatelessWidget {
  final List<Ingredient> ingredients;
  final double servingMultiplier;
}
```

**Layout:**
```
┌─────────────────────────────────────────┐
│ 📏 Recipe Quantities                    │
│  ┌─────────────────┬─────────────────┐  │
│  │ 2 lbs           │ 1/4 cup         │  │
│  │ Chicken Breast  │ Olive Oil       │  │
│  ├─────────────────┼─────────────────┤  │
│  │ 3 cloves        │ 1 tsp           │  │
│  │ Garlic          │ Salt            │  │
│  └─────────────────┴─────────────────┘  │
└─────────────────────────────────────────┘
```

**Quantity Scaling Logic:**
```dart
String scaleQuantity(String quantity, double multiplier) {
  // Parse: "2 cups" → amount=2, unit="cups"
  // Multiply amount by multiplier
  // Format nicely with fractions: 0.5→"1/2", 0.25→"1/4", etc.
  // Return: "4 cups"
}
```

**Fraction Display:**
| Value | Display |
|-------|---------|
| 0.25 | 1/4 |
| 0.33 | 1/3 |
| 0.5 | 1/2 |
| 0.67 | 2/3 |
| 0.75 | 3/4 |
| 1.5 | 1 1/2 |

---

### IngredientSwapModal

Modal for swapping Kroger products for an ingredient.

```dart
class IngredientSwapModal extends StatelessWidget {
  final Ingredient currentIngredient;
  final List<SwapAlternative> alternatives;
  final bool loading;
  final ValueChanged<SwapAlternative> onSelect;
  final VoidCallback onClose;
}
```

**Layout:**
```
┌─────────────────────────────────────────┐
│ Swap Product                        [X] │
├─────────────────────────────────────────┤
│ Current:                                │
│ [IMG] Simple Truth Chicken Breast       │
│       $8.99 • 16 oz                     │
│       [Nutrition ▼]                     │
├─────────────────────────────────────────┤
│ Alternatives:                           │
│ ┌─────────────────────────────────────┐ │
│ │ [IMG] Kroger Chicken Breast         │ │
│ │       $6.99 • 16 oz                 │ │
│ │       [Nutrition ▼]        [Select] │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ [IMG] Heritage Farm Chicken         │ │
│ │       $7.49 • 1 lb                  │ │
│ │       ⚠️ You usually avoid this     │ │
│ │       [Nutrition ▼]        [Select] │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Features:**
- Current product shown at top with nutrition expandable
- Alternatives list below
- Warning badge if product matches user's avoid preferences
- Nutrition panel expands inline showing calories, protein, carbs, fat, sodium

---

### MacrosCard

Displays 4 macro nutrients in a grid with icons.

```dart
class MacrosCard extends StatelessWidget {
  final Macros macros;
  final double servingMultiplier;  // Scales displayed values
  final String? dietType;          // Controls protein icon
}
```

**Layout:**
```
┌─────────────────────────────────────────┐
│    🔥          🥩/🫘       🌾       💧   │
│   420         32g       28g      18g   │
│   kcal      Protein   Net Carbs   Fat  │
└─────────────────────────────────────────┘
```

**Icon Backgrounds:**
- Calories: orange-50 circle, Flame icon orange-500
- Protein: blue-50 (Beef) or emerald-50 (Bean for veg/vegan)
- Carbs: amber-50 circle, Wheat icon amber-500
- Fat: purple-50 circle, Droplet icon purple-500

**Net Carbs Calculation:**
```dart
netCarbs = max(0, carbs - fiber);
// Tooltip shows: "28g total carbs - 5g fiber"
```

---

### AskAICard

Chat interface for AI meal modifications.

```dart
class AskAICard extends StatelessWidget {
  final List<ThreadMessage> messages;
  final String inputValue;
  final bool sending;
  final bool isPremium;
  final int chatCount;           // Current usage
  final int chatLimit;           // 6 for free tier
  final ValueChanged<String> onInputChanged;
  final VoidCallback onSend;
  final VoidCallback? onUpgrade;
}
```

**Layout:**
```
┌─────────────────────────────────────────┐
│ 💬 Ask AI                  [3/6 free]   │
│ Swap ingredients, make it dairy-free,   │
│ lower sodium, or create a variant.      │
│ ┌─────────────────────────────────────┐ │
│ │ User: make this spicier             │ │
│ │ AI: I've added jalapeños and        │ │
│ │     increased the cayenne...        │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────┐ ┌─────────┐ │
│ │ E.g. make it dairy-free │ │  Send   │ │
│ └─────────────────────────┘ └─────────┘ │
└─────────────────────────────────────────┘
```

**Usage Badge Colors:**
| Remaining | Badge Color |
|-----------|-------------|
| 2+ | blue-100, blue text |
| 1 | amber-100, amber text |
| 0 | red-100, red text |

**Message Bubbles:**
- User: bg-[#4A90E2], white text, right-aligned
- AI: bg-white, border gray-200, gray text, left-aligned

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
│  [Home] [Saved] [Cart] [Fresh] [More]   │
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
│ │         (full width, ~200px)        │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ [breakfast] [15-20m] [$25] [keto]       │
│ [Diet Compliant] [Pantry Mode]          │
│ Meal Name                               │
│ Description text here...                │
├─────────────────────────────────────────┤
│ ┌─ Macros Card ─────────────────────┐   │
│ │   🔥        🥩        🌾       💧  │   │
│ │  420       32g     28g net   18g  │   │
│ │  kcal    Protein  Net Carbs  Fat  │   │
│ └───────────────────────────────────┘   │
├─────────────────────────────────────────┤
│ ┌─ Servings Card ───────────────────┐   │
│ │ 👥 Servings           [-] 4 [+]   │   │
│ └───────────────────────────────────┘   │
├─────────────────────────────────────────┤
│ ┌─ Ask AI Card ─────────────────────┐   │
│ │ 💬 Ask AI            [3/6 free]   │   │
│ │ Swap ingredients, make dairy-free │   │
│ │ ┌─────────────────────────────┐   │   │
│ │ │ [chat messages if any]      │   │   │
│ │ └─────────────────────────────┘   │   │
│ │ [Type message...         ] [Send] │   │
│ └───────────────────────────────────┘   │
├─────────────────────────────────────────┤
│ ┌─ Ingredients Card ────────────────┐   │
│ │ Ingredients (5 of 8)  Cart: $32   │   │
│ │                    [Select all]   │   │
│ │ Tap ingredient to swap. Uncheck   │   │
│ │ items you have.                   │   │
│ │ ┌─────────────────────────────┐   │   │
│ │ │ [IMG] Chicken Breast    (✓) │   │   │
│ │ │       16 oz • Aisle 5       │   │   │
│ │ │       $8.99                 │   │   │
│ │ │       [In pantry] [Low stk] │   │   │
│ │ ├─────────────────────────────┤   │   │
│ │ │ [IMG] Olive Oil         (✓) │   │   │
│ │ │       25.5 oz • Aisle 12    │   │   │
│ │ │       $7.99                 │   │   │
│ │ └─────────────────────────────┘   │   │
│ └───────────────────────────────────┘   │
├─────────────────────────────────────────┤
│ ┌─ Recipe Quantities Card ──────────┐   │
│ │ 📏 Recipe Quantities              │   │
│ │  ┌──────────────┬──────────────┐  │   │
│ │  │ 2 lbs        │ 1/4 cup      │  │   │
│ │  │ Chicken      │ Olive Oil    │  │   │
│ │  ├──────────────┼──────────────┤  │   │
│ │  │ 3 cloves     │ 1 tsp        │  │   │
│ │  │ Garlic       │ Salt         │  │   │
│ │  └──────────────┴──────────────┘  │   │
│ └───────────────────────────────────┘   │
├─────────────────────────────────────────┤
│ ┌─ Cooking Steps Card ──────────────┐   │
│ │ 👨‍🍳 Cooking Steps                  │   │
│ │  ① Preheat oven to 400°F...       │   │
│ │  ② Season chicken with salt and   │   │
│ │     pepper on both sides...       │   │
│ │  ③ Heat olive oil in oven-safe    │   │
│ │     skillet over medium-high...   │   │
│ └───────────────────────────────────┘   │
├─────────────────────────────────────────┤
│ ┌───────────────────────────────────┐   │
│ │ 🛒 Add 5 items to shopping list   │   │
│ │      (Primary gradient button)    │   │
│ └───────────────────────────────────┘   │
│ ┌───────────────────────────────────┐   │
│ │ 🥕 Get Recipe Ingredients         │   │
│ │      (Instacart green button)     │   │
│ └───────────────────────────────────┘   │
│    -- OR --                             │
│ ┌───────────────────────────────────┐   │
│ │ 🔗 Add to Kroger Cart             │   │
│ │      (Kroger blue gradient)       │   │
│ └───────────────────────────────────┘   │
│ ┌───────────────────────────────────┐   │
│ │ 🔖 Save meal for later            │   │
│ │      (Outline button)             │   │
│ └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Key Interactions:**
- Servings -/+ adjusts quantities in Recipe Quantities card
- Macros scale with serving multiplier
- Tap ingredient row → opens swap modal (Kroger users)
- Checkbox toggles ingredient selection for cart
- "In pantry" badge shows items user recently purchased
- Stock level badges: "Low Stock" (amber), "Out of Stock" (red)

---

### Shopping List Screen Layout

Items are grouped by **date added**, then by **meal** within each date.

```
┌─────────────────────────────────────────┐
│ 📋 Shopping List                        │
│     8 items                             │
│                    [Link Kroger] (if    │
│                     not connected)      │
├─────────────────────────────────────────┤
│ ⚠️ Tip: Items marked "In Pantry" may   │
│    already be in your kitchen.     [X] │
├─────────────────────────────────────────┤
│ * Estimated prices may vary by store    │
├─────────────────────────────────────────┤
│                                         │
│ ┌─ Date Group Card ─────────────────┐   │
│ │ ┌─ Date Header ─────────────────┐ │   │
│ │ │ Monday, January 6 (5 items)   │ │   │
│ │ │              [🥕 Instacart]   │ │   │
│ │ │              [Add to Kroger]  │ │   │
│ │ │                          [🗑] │ │   │
│ │ └───────────────────────────────┘ │   │
│ │                                   │   │
│ │ ┌─ Meal Group ────────────────┐   │   │
│ │ │ [Meal   ] Honey Garlic       │   │   │
│ │ │ [Image  ] Chicken            │   │   │
│ │ │ [48×48  ] 3 ingredients      │   │   │
│ │ ├──────────────────────────────┤   │   │
│ │ │ [IMG] Chicken Breast     [🗑]│   │   │
│ │ │       Qty: 2                 │   │   │
│ │ │       16 oz                  │   │   │
│ │ │       📍 Meat • $8.99        │   │   │
│ │ │       [In Pantry] [Low Stk]  │   │   │
│ │ ├──────────────────────────────┤   │   │
│ │ │ [IMG] Olive Oil          [🗑]│   │   │
│ │ │       Qty: 1                 │   │   │
│ │ │       25.5 oz               │   │   │
│ │ │       📍 Oils • $7.99        │   │   │
│ │ ├──────────────────────────────┤   │   │
│ │ │ [IMG] Garlic             [🗑]│   │   │
│ │ │       Qty: 1                 │   │   │
│ │ │       Est. $0.50 - $1.00     │   │   │
│ │ └──────────────────────────────┘   │   │
│ │                                   │   │
│ │ ┌─ Meal Group ────────────────┐   │   │
│ │ │ [📦    ] Other Items         │   │   │
│ │ │ [Icon  ] 2 ingredients       │   │   │
│ │ ├──────────────────────────────┤   │   │
│ │ │ [IMG] Salt               [🗑]│   │   │
│ │ │       Qty: 1                 │   │   │
│ │ └──────────────────────────────┘   │   │
│ └───────────────────────────────────┘   │
│                                         │
│ ┌─ Another Date Group ──────────────┐   │
│ │ Sunday, January 5 (3 items)       │   │
│ │ ...                               │   │
│ └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Grouping Structure:**
```
Date Group (e.g., "Monday, January 6")
  └── Meal Group (e.g., "Honey Garlic Chicken")
       └── Item 1
       └── Item 2
  └── Meal Group (e.g., "Other Items")
       └── Item 3
```

**Date Header:**
- Date label + item count
- Instacart button (green, rounded-full) - for Instacart preference
- Kroger button (blue) - for Kroger preference when linked
- Trash button (red) - removes all items for this date

**Meal Group Header:**
- Meal image (48×48) or Package icon for "Other Items"
- Meal name
- Ingredient count
- Blue left border accent

**Item Row:**
- Product image (Kroger) or ingredient image (fallback)
- Item name + badges (In Pantry, Low Stock, Out of Stock)
- Qty count
- Product size (if Kroger linked)
- Aisle + price (if Kroger linked)
- OR Estimated price range (if Instacart or no Kroger)
- Trash button (red, per item)

**Tap to Swap:** Tap item row → opens Item Detail Modal (Kroger users only)

---

### ShoppingItemDetailModal

Bottom sheet modal for viewing item details and swapping products (Kroger users only).

```dart
class ShoppingItemDetailModal extends StatelessWidget {
  final ShoppingItem item;
  final List<KrogerProduct>? swapAlternatives;
  final bool loadingSwapSuggestions;
  final bool showSwapOptions;
  final SwapWarning? searchWarning;  // If ingredient is avoided/allergy
  final VoidCallback onClose;
  final VoidCallback onShowSwapOptions;
  final ValueChanged<KrogerProduct> onSelectSwap;
}
```

**Layout (Initial View):**
```
┌─────────────────────────────────────────┐
│ Item Details                        [X] │
├─────────────────────────────────────────┤
│        ┌─────────────────────┐          │
│        │                     │          │
│        │    Product Image    │          │
│        │      200×200        │          │
│        │                     │          │
│        └─────────────────────┘          │
│                                         │
│            Chicken Breast               │
│    Simple Truth Organic Chicken         │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Size          16 oz                 │ │
│ │ Aisle         Meat & Seafood        │ │
│ │ Price         $8.99                 │ │
│ │ Stock         In Stock (green)      │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ [      🔄 Swap Product      ]           │
│ [          Close            ]           │
└─────────────────────────────────────────┘
```

**Layout (Swap Options View):**
```
┌─────────────────────────────────────────┐
│ Item Details                        [X] │
├─────────────────────────────────────────┤
│ Choose a different product:             │
│                                         │
│ ┌─ Warning Banner (if applicable) ───┐  │
│ │ ⚠️ Allergy alert                   │  │
│ │ You've marked "peanut" as allergy  │  │
│ └────────────────────────────────────┘  │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ [IMG] Kroger Chicken Breast         │ │
│ │       16 oz • Meat                  │ │
│ │       $6.99                         │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ [IMG] Heritage Farm Chicken         │ │
│ │       1 lb • Meat    [⚠️ Avoid]     │ │
│ │       $7.49                         │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ [          Cancel           ]           │
└─────────────────────────────────────────┘
```

**Warning Badge Colors:**
- `NEVER_INCLUDE` (Allergy): red-50 bg, red-200 border, red text
- `AVOID`: amber-50 bg, amber-200 border, amber text

---

### KrogerResultsModal

Shows results after adding items to Kroger cart.

```dart
class KrogerResultsModal extends StatelessWidget {
  final List<EnrichedItem> results;
  final String storeName;
  final String cartUrl;
  final VoidCallback onClose;
}
```

**Layout:**
```
┌─────────────────────────────────────────┐
│ Kroger Cart Results                 [X] │
│ 5 of 8 items added                      │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ chicken breast                      │ │
│ │ [IMG] Simple Truth Chicken Breast   │ │
│ │       16 oz • $8.99 • Meat          │ │
│ │                          [Added ✓]  │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ special spice blend                 │ │
│ │ No matching product found           │ │
│ │                       [Not found ✗] │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ Items are in your Kroger cart!      │ │
│ │ Complete your purchase on the       │ │
│ │ Kroger app or website.              │ │
│ └─────────────────────────────────────┘ │
│ [Close]              [Go to Kroger →]   │
└─────────────────────────────────────────┘
```

**Item Status Badges:**
- Found: emerald-50 bg, emerald-100 text "Added"
- Not Found: red-50 bg, red-100 text "Not found"

---

### KrogerLinkModal

Modal for managing Kroger store selection and account linking.

```dart
class KrogerLinkModal extends StatelessWidget {
  final List<UserLocation> savedLocations;
  final bool krogerLinked;
  final bool loadingLocations;
  final VoidCallback onClose;
  final VoidCallback onLinkAccount;
  final ValueChanged<UserLocation> onSetDefault;
  final ValueChanged<UserLocation> onRemoveLocation;
  final ValueChanged<KrogerLocationSearchResult> onAddLocation;
}
```

**Layout:**
```
┌─────────────────────────────────────────┐
│ 🛒 Store & Account                  [X] │
│    Connect to add items to your cart    │
├─────────────────────────────────────────┤
│ ┌─ Kroger Family Info ──────────────┐   │
│ │ Kroger, Ralphs, Fred Meyer,       │   │
│ │ King Soopers, Smith's, QFC...     │   │
│ └───────────────────────────────────┘   │
│                                         │
│ ① Choose Your Store        (✓ if done)  │
│   ┌─────────────────────────────────┐   │
│   │ Smith's         [Default]       │   │
│   │ Las Vegas, NV        [🗑]       │   │
│   └─────────────────────────────────┘   │
│                                         │
│   Find a store by ZIP                   │
│   [Enter ZIP code    ] [🔍]             │
│                                         │
│   ┌─ Search Results ────────────────┐   │
│   │ Kroger - Downtown    [Use]      │   │
│   │ 123 Main St                     │   │
│   └─────────────────────────────────┘   │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ ② Connect Your Account     (✓ if done)  │
│   [Account linked ✓]                    │
│   -- OR --                              │
│   [🔗 Link Store Account]               │
├─────────────────────────────────────────┤
│ [           Close           ]           │
└─────────────────────────────────────────┘
```

**Step Indicators:**
- Incomplete: gray-200 circle with number
- Complete: emerald-100 circle with checkmark

---

## Navigation Structure

### Bottom Navigation Tabs

| Tab | Icon | Label | Route |
|-----|------|-------|-------|
| Home | `UtensilsCrossed` | Home | `/prompt` |
| Saved | `Bookmark` | Saved | `/saved-meals` |
| Cart | `ShoppingCart` | Cart | `/shopping-list` |
| Fresh | `Sparkles` | Fresh | `/fresh-picks` |
| More | `Menu` | More | `/account` |

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

### Spoonacular Ingredient Images

Used as fallback images when Kroger product images aren't available. Maps ingredient names to Spoonacular CDN URLs.

**URL Format:**
```
https://img.spoonacular.com/ingredients_{size}/{normalized-name}.jpg
```

**Sizes:** `100x100`, `250x250`, `500x500`

**Normalization Rules:**
1. Check alias map first (e.g., "plain greek yogurt" → "plain-yogurt")
2. Remove prefixes: fresh, dried, frozen, chopped, diced, minced, sliced, boneless, skinless, organic, etc.
3. Remove trailing units: cloves, stalks, heads, bunches, sprigs, pieces, leaves, florets, etc.
4. Remove quantities: "2 cups", "1/2 lb", etc.
5. Replace spaces with hyphens, remove special characters

**Common Aliases:**
| Input | CDN Name |
|-------|----------|
| greek yogurt | plain-yogurt |
| chicken broth | broth |
| bell pepper | bell-pepper-orange |
| ground beef | fresh-ground-beef |
| soy sauce | soy-sauce |
| sriracha / hot sauce | hot-sauce-or-tabasco |
| all-purpose flour | flour |
| brown sugar | dark-brown-sugar |

**Flutter Implementation:**
```dart
class SpoonacularImages {
  static const String baseUrl = 'https://img.spoonacular.com/ingredients_';

  static String getUrl(String ingredientName, {String size = '250x250'}) {
    final normalized = _normalize(ingredientName);
    return '${baseUrl}${size}/$normalized.jpg';
  }

  static String _normalize(String name) {
    var normalized = name.toLowerCase().trim();

    // Check aliases first
    if (_aliases.containsKey(normalized)) {
      return _aliases[normalized]!;
    }

    // Remove prefixes
    for (final prefix in _prefixes) {
      normalized = normalized.replaceAll(RegExp('\\b$prefix\\b'), '');
    }

    // Remove trailing units
    for (final unit in _trailingUnits) {
      normalized = normalized.replaceAll(RegExp('\\s+$unit\$'), '');
    }

    // Clean up
    return normalized
        .replaceAll(RegExp('[^a-z0-9\\s-]'), '')
        .replaceAll(RegExp('\\s+'), '-')
        .replaceAll(RegExp('-+'), '-')
        .replaceAll(RegExp('^-|-\$'), '')
        .trim();
  }

  static const Map<String, String> _aliases = {
    'plain greek yogurt': 'plain-yogurt',
    'greek yogurt': 'plain-yogurt',
    'chicken broth': 'broth',
    'chicken breast': 'chicken-breasts',
    'olive oil': 'olive-oil',
    'soy sauce': 'soy-sauce',
    'sriracha': 'hot-sauce-or-tabasco',
    'hot sauce': 'hot-sauce-or-tabasco',
    'ground beef': 'fresh-ground-beef',
    'all-purpose flour': 'flour',
    'brown sugar': 'dark-brown-sugar',
    // ... add more from lib/ingredientImages.ts
  };

  static const List<String> _prefixes = [
    'fresh', 'dried', 'frozen', 'chopped', 'diced', 'minced',
    'sliced', 'boneless', 'skinless', 'organic', 'ground', 'grated',
  ];

  static const List<String> _trailingUnits = [
    'cloves', 'clove', 'stalks', 'stalk', 'heads', 'head',
    'bunches', 'bunch', 'sprigs', 'sprig', 'pieces', 'piece',
  ];
}
```

**Usage in IngredientRow:**
```dart
// If Kroger product image fails or not available
final imageUrl = item.productImageUrl ??
    SpoonacularImages.getUrl(item.name);
```

---

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
