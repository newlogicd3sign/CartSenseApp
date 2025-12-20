// app/(app)/api/preferences/aggregate/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import type { PreferenceProfile, FoodEventType } from "@/types/preferences";

// Score weights for different event types
const SCORE_WEIGHTS: Record<FoodEventType, number> = {
  MEAL_GENERATED: 0, // Neutral - just tracks that a meal was generated
  MEAL_ACCEPTED: 1,
  MEAL_REJECTED: -2,
  MEAL_SAVED: 2,
  MEAL_REPEATED: 3,
  MEAL_EDITED: 0, // Neutral - specific edits matter more
  INGREDIENT_ADDED: 1.5,
  INGREDIENT_REMOVED: -1.5,
  INGREDIENT_SWAPPED: 0, // from gets negative, to gets positive (handled specially)
  CART_ADDED: 0.5,
  CART_REMOVED: -0.5,
  PRODUCT_SWAPPED: 0, // from gets negative, to gets positive (handled specially)
};

// Boost values for preference locks
const LOCK_BOOSTS = {
  ALWAYS_INCLUDE: 10,
  NEVER_INCLUDE: -10,
  PREFER: 5,
  AVOID: -5,
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "USER_ID_REQUIRED", message: "User ID is required." },
        { status: 400 }
      );
    }

    // Fetch recent events (last 90 days, max 500)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const eventsRef = adminDb
      .collection("foodEvents")
      .doc(userId)
      .collection("events");

    const snapshot = await eventsRef
      .where("createdAt", ">=", ninetyDaysAgo)
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();

    // Initialize aggregation structures
    const ingredientScores: Record<string, number> = {};
    const tagScores: Record<string, number> = {};
    const contextScores: Record<
      string,
      {
        ingredientScores: Record<string, number>;
        tagScores: Record<string, number>;
      }
    > = {};
    const stats = {
      totalEvents: 0,
      acceptedMeals: 0,
      rejectedMeals: 0,
      edits: 0,
      repeats: 0,
    };

    // Process each event
    for (const doc of snapshot.docs) {
      const event = doc.data();
      stats.totalEvents++;

      const eventType = event.type as FoodEventType;
      const weight = SCORE_WEIGHTS[eventType] ?? 0;
      const contextKey = event.context?.mealTime || "general";

      // Initialize context scores if needed
      if (!contextScores[contextKey]) {
        contextScores[contextKey] = { ingredientScores: {}, tagScores: {} };
      }

      // Update stats
      switch (eventType) {
        case "MEAL_ACCEPTED":
          stats.acceptedMeals++;
          break;
        case "MEAL_REJECTED":
          stats.rejectedMeals++;
          break;
        case "MEAL_EDITED":
        case "INGREDIENT_REMOVED":
        case "INGREDIENT_ADDED":
        case "INGREDIENT_SWAPPED":
          stats.edits++;
          break;
        case "MEAL_REPEATED":
          stats.repeats++;
          break;
      }

      const payload = event.payload || {};

      // Score single ingredient events
      if (payload.ingredientKey && weight !== 0) {
        ingredientScores[payload.ingredientKey] =
          (ingredientScores[payload.ingredientKey] || 0) + weight;
        contextScores[contextKey].ingredientScores[payload.ingredientKey] =
          (contextScores[contextKey].ingredientScores[payload.ingredientKey] ||
            0) + weight;
      }

      // Handle swaps (from gets negative, to gets positive)
      if (
        eventType === "INGREDIENT_SWAPPED" ||
        eventType === "PRODUCT_SWAPPED"
      ) {
        if (payload.fromIngredientKey) {
          ingredientScores[payload.fromIngredientKey] =
            (ingredientScores[payload.fromIngredientKey] || 0) - 1;
          contextScores[contextKey].ingredientScores[payload.fromIngredientKey] =
            (contextScores[contextKey].ingredientScores[
              payload.fromIngredientKey
            ] || 0) - 1;
        }
        if (payload.toIngredientKey) {
          ingredientScores[payload.toIngredientKey] =
            (ingredientScores[payload.toIngredientKey] || 0) + 1;
          contextScores[contextKey].ingredientScores[payload.toIngredientKey] =
            (contextScores[contextKey].ingredientScores[
              payload.toIngredientKey
            ] || 0) + 1;
        }
      }

      // Score tags from accepted/saved/repeated meals
      if (
        payload.mealTags &&
        Array.isArray(payload.mealTags) &&
        (eventType === "MEAL_ACCEPTED" ||
          eventType === "MEAL_SAVED" ||
          eventType === "MEAL_REPEATED")
      ) {
        for (const tag of payload.mealTags) {
          tagScores[tag] = (tagScores[tag] || 0) + weight;
          contextScores[contextKey].tagScores[tag] =
            (contextScores[contextKey].tagScores[tag] || 0) + weight;
        }
      }

      // Negative scoring for tags in rejected meals
      if (eventType === "MEAL_REJECTED" && payload.mealTags) {
        for (const tag of payload.mealTags) {
          tagScores[tag] = (tagScores[tag] || 0) + weight; // weight is already -2
          contextScores[contextKey].tagScores[tag] =
            (contextScores[contextKey].tagScores[tag] || 0) + weight;
        }
      }
    }

    // Fetch preference locks and apply boosts
    const locksRef = adminDb
      .collection("preferenceLocks")
      .doc(userId)
      .collection("locks");

    const locksSnapshot = await locksRef.get();

    for (const lockDoc of locksSnapshot.docs) {
      const lock = lockDoc.data();
      const boost =
        LOCK_BOOSTS[lock.rule as keyof typeof LOCK_BOOSTS] ?? 0;

      if (lock.scope === "ingredient" && lock.key) {
        ingredientScores[lock.key] = (ingredientScores[lock.key] || 0) + boost;
      } else if (
        (lock.scope === "tag" ||
          lock.scope === "cuisine" ||
          lock.scope === "method") &&
        lock.key
      ) {
        tagScores[lock.key] = (tagScores[lock.key] || 0) + boost;
      }
    }

    // Prune small scores to keep response size manageable
    // Only keep ingredients/tags with |score| >= 1
    const prunedIngredientScores: Record<string, number> = {};
    for (const [key, score] of Object.entries(ingredientScores)) {
      if (Math.abs(score) >= 1) {
        prunedIngredientScores[key] = score;
      }
    }

    const prunedTagScores: Record<string, number> = {};
    for (const [key, score] of Object.entries(tagScores)) {
      if (Math.abs(score) >= 1) {
        prunedTagScores[key] = score;
      }
    }

    // Prune context scores similarly
    const prunedContextScores: typeof contextScores = {};
    for (const [contextKey, scores] of Object.entries(contextScores)) {
      const prunedIngr: Record<string, number> = {};
      const prunedTags: Record<string, number> = {};

      for (const [key, score] of Object.entries(scores.ingredientScores)) {
        if (Math.abs(score) >= 1) prunedIngr[key] = score;
      }
      for (const [key, score] of Object.entries(scores.tagScores)) {
        if (Math.abs(score) >= 1) prunedTags[key] = score;
      }

      if (
        Object.keys(prunedIngr).length > 0 ||
        Object.keys(prunedTags).length > 0
      ) {
        prunedContextScores[contextKey] = {
          ingredientScores: prunedIngr,
          tagScores: prunedTags,
        };
      }
    }

    const profile: Omit<PreferenceProfile, "updatedAt"> & {
      updatedAt: ReturnType<typeof FieldValue.serverTimestamp>;
    } = {
      updatedAt: FieldValue.serverTimestamp(),
      version: 1,
      ingredientScores: prunedIngredientScores,
      tagScores: prunedTagScores,
      contextScores: prunedContextScores,
      stats,
    };

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    console.error("Error aggregating preferences:", error);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Failed to aggregate preferences." },
      { status: 500 }
    );
  }
}
