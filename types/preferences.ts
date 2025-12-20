// types/preferences.ts

import { Timestamp } from "firebase/firestore";

// Event types for tracking user behavior
export type FoodEventType =
  | "MEAL_GENERATED"
  | "MEAL_ACCEPTED"
  | "MEAL_REJECTED"
  | "MEAL_EDITED"
  | "INGREDIENT_REMOVED"
  | "INGREDIENT_ADDED"
  | "INGREDIENT_SWAPPED"
  | "MEAL_SAVED"
  | "MEAL_REPEATED"
  | "CART_ADDED"
  | "CART_REMOVED"
  | "PRODUCT_SWAPPED";

export type FoodEventContext = {
  mealTime?: "breakfast" | "lunch" | "dinner" | "snack";
  dayType?: "weekday" | "weekend";
  audience?: "solo" | "family";
  storeProvider?: "instacart" | "kroger" | "walmart" | "other";
  storeId?: string;
};

export type FoodEventPayload = {
  ingredientKey?: string; // normalized: "mushroom", "chicken_breast"
  ingredientText?: string; // display text
  fromIngredientKey?: string; // for swaps
  toIngredientKey?: string;
  tag?: string; // "quick", "spicy", "meal_prep", etc.
  reason?: string;
  quantityDelta?: number;
  productId?: string;
  fromProductId?: string;
  toProductId?: string;
  mealTags?: string[];
  mealName?: string; // for MEAL_GENERATED events - tracks recipe names for variety
};

export type FoodEvent = {
  createdAt: Timestamp;
  type: FoodEventType;
  mealId?: string;
  mealFingerprint?: string; // stable hash of ingredients + method + cuisine
  source?: "prompt" | "saved" | "regenerated" | "manual";
  context: FoodEventContext;
  payload: FoodEventPayload;
  clientEventId?: string;
};

// Preference lock types for explicit user rules
export type PreferenceLockRule =
  | "ALWAYS_INCLUDE"
  | "NEVER_INCLUDE"
  | "AVOID"
  | "PREFER";

export type PreferenceLockScope =
  | "ingredient"
  | "tag"
  | "cuisine"
  | "method"
  | "product"
  | "brand";

export type PreferenceLock = {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  scope: PreferenceLockScope;
  key: string; // "mushroom" or "spicy" or "air_fryer" etc
  rule: PreferenceLockRule;
  context?: {
    mealTime?: "breakfast" | "lunch" | "dinner" | "snack";
    dayType?: "weekday" | "weekend";
    audience?: "solo" | "family";
  };
  note?: string;
  confidence?: number; // 0-1, usually 1.0 since user confirmed
};

// Aggregated preference profile computed from events
export type PreferenceProfile = {
  updatedAt: Timestamp;
  version: number; // bump when scoring logic changes

  // global scores
  ingredientScores: Record<string, number>; // { "mushroom": -12, "chicken_breast": 8 }
  tagScores: Record<string, number>; // { "quick": 10, "spicy": 2 }

  // context-aware scores (only store top N to avoid huge docs)
  contextScores: {
    // key format: "dinner|weekday|family"
    [contextKey: string]: {
      ingredientScores?: Record<string, number>;
      tagScores?: Record<string, number>;
    };
  };

  // stats for UI / explainability
  stats: {
    totalEvents: number;
    acceptedMeals: number;
    rejectedMeals: number;
    edits: number;
    repeats: number;
  };

  // optional: discovered defaults
  defaults?: {
    prefersOrganic?: boolean;
    budgetSensitivity?: "low" | "medium" | "high";
    spiceLevel?: "mild" | "medium" | "hot";
  };
};

// Helper type for preference data passed to meal generation
export type PreferenceData = {
  preferredIngredients: string[];
  avoidIngredients: string[];
  preferredTags: string[];
  avoidTags: string[];
  transparencyNotes: string[];
};
