// lib/logFoodEvent.ts
"use client";

import { db } from "@/lib/firebaseClient";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import type {
  FoodEventType,
  FoodEventContext,
  FoodEventPayload,
} from "@/types/preferences";
import {
  normalizeIngredientKey,
  generateMealFingerprint,
  extractMealTags,
  getCurrentContext,
} from "@/lib/ingredientNormalization";

type MealData = {
  id?: string;
  name: string;
  description: string;
  mealType: string;
  cookTimeRange?: { min: number; max: number };
  ingredients: { name: string }[];
};

export type LogFoodEventParams = {
  type: FoodEventType;
  mealId?: string;
  meal?: MealData;
  source?: "prompt" | "saved" | "regenerated" | "manual";
  ingredientName?: string;
  fromIngredientName?: string;
  toIngredientName?: string;
  productId?: string;
  fromProductId?: string;
  toProductId?: string;
  reason?: string;
  storeProvider?: "instacart" | "kroger" | "walmart" | "other";
  storeId?: string;
  audience?: "solo" | "family";
};

/**
 * Log a food-related event to Firestore for preference learning.
 * This function is non-blocking and won't throw errors to the caller.
 */
export async function logFoodEvent(
  uid: string,
  params: LogFoodEventParams
): Promise<void> {
  try {
    const { mealTime, dayType } = getCurrentContext();

    // Build context from current time and params
    // Only include defined values (Firestore rejects undefined)
    const context: FoodEventContext = {
      mealTime:
        (params.meal?.mealType as FoodEventContext["mealTime"]) || mealTime,
      dayType,
      ...(params.audience && { audience: params.audience }),
      ...(params.storeProvider && { storeProvider: params.storeProvider }),
      ...(params.storeId && { storeId: params.storeId }),
    };

    // Build payload with normalized keys
    const payload: FoodEventPayload = {};

    if (params.ingredientName) {
      payload.ingredientKey = normalizeIngredientKey(params.ingredientName);
      payload.ingredientText = params.ingredientName;
    }
    if (params.fromIngredientName) {
      payload.fromIngredientKey = normalizeIngredientKey(
        params.fromIngredientName
      );
    }
    if (params.toIngredientName) {
      payload.toIngredientKey = normalizeIngredientKey(params.toIngredientName);
    }
    if (params.productId) payload.productId = params.productId;
    if (params.fromProductId) payload.fromProductId = params.fromProductId;
    if (params.toProductId) payload.toProductId = params.toProductId;
    if (params.reason) payload.reason = params.reason;

    // Extract meal tags if meal is provided
    if (params.meal) {
      payload.mealTags = extractMealTags(params.meal);
    }

    const eventDoc = {
      createdAt: serverTimestamp(),
      type: params.type,
      mealId: params.mealId || params.meal?.id || null,
      mealFingerprint: params.meal ? generateMealFingerprint(params.meal) : null,
      source: params.source || null,
      context,
      payload,
      clientEventId: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    };

    const eventsCol = collection(db, "foodEvents", uid, "events");
    await addDoc(eventsCol, eventDoc);
  } catch (err) {
    console.error("logFoodEvent error:", err);
    // Non-blocking - don't throw to avoid disrupting user flow
  }
}

/**
 * Helper to log a meal acceptance (user proceeds with the meal).
 */
export function logMealAccepted(
  uid: string,
  meal: MealData,
  source: LogFoodEventParams["source"] = "prompt"
): Promise<void> {
  return logFoodEvent(uid, {
    type: "MEAL_ACCEPTED",
    meal,
    mealId: meal.id,
    source,
  });
}

/**
 * Helper to log a meal rejection (user skips/rejects the meal).
 */
export function logMealRejected(
  uid: string,
  meal: MealData,
  reason?: string
): Promise<void> {
  return logFoodEvent(uid, {
    type: "MEAL_REJECTED",
    meal,
    mealId: meal.id,
    reason,
  });
}

/**
 * Helper to log a meal being saved.
 */
export function logMealSaved(
  uid: string,
  meal: MealData,
  source: LogFoodEventParams["source"] = "prompt"
): Promise<void> {
  return logFoodEvent(uid, {
    type: "MEAL_SAVED",
    meal,
    mealId: meal.id,
    source,
  });
}

/**
 * Helper to log adding items to cart.
 */
export function logCartAdded(
  uid: string,
  storeProvider: "instacart" | "kroger" | "walmart" | "other",
  meal?: MealData
): Promise<void> {
  return logFoodEvent(uid, {
    type: "CART_ADDED",
    meal,
    mealId: meal?.id,
    storeProvider,
  });
}

/**
 * Helper to log removing an item from cart/shopping list.
 */
export function logCartRemoved(
  uid: string,
  ingredientName: string,
  mealId?: string
): Promise<void> {
  return logFoodEvent(uid, {
    type: "CART_REMOVED",
    ingredientName,
    mealId,
  });
}

/**
 * Helper to log an ingredient swap.
 */
export function logIngredientSwapped(
  uid: string,
  fromIngredientName: string,
  toIngredientName: string,
  meal?: MealData,
  productInfo?: {
    fromProductId?: string;
    toProductId?: string;
    storeProvider?: "instacart" | "kroger" | "walmart" | "other";
  }
): Promise<void> {
  return logFoodEvent(uid, {
    type: "INGREDIENT_SWAPPED",
    meal,
    mealId: meal?.id,
    fromIngredientName,
    toIngredientName,
    fromProductId: productInfo?.fromProductId,
    toProductId: productInfo?.toProductId,
    storeProvider: productInfo?.storeProvider,
  });
}

/**
 * Helper to log a product swap (same ingredient, different product).
 */
export function logProductSwapped(
  uid: string,
  ingredientName: string,
  fromProductId: string,
  toProductId: string,
  storeProvider: "instacart" | "kroger" | "walmart" | "other"
): Promise<void> {
  return logFoodEvent(uid, {
    type: "PRODUCT_SWAPPED",
    ingredientName,
    fromProductId,
    toProductId,
    storeProvider,
  });
}

/**
 * Helper to log ingredient addition during meal editing.
 */
export function logIngredientAdded(
  uid: string,
  ingredientName: string,
  meal?: MealData
): Promise<void> {
  return logFoodEvent(uid, {
    type: "INGREDIENT_ADDED",
    meal,
    mealId: meal?.id,
    ingredientName,
  });
}

/**
 * Helper to log ingredient removal during meal editing.
 */
export function logIngredientRemoved(
  uid: string,
  ingredientName: string,
  meal?: MealData
): Promise<void> {
  return logFoodEvent(uid, {
    type: "INGREDIENT_REMOVED",
    meal,
    mealId: meal?.id,
    ingredientName,
  });
}
