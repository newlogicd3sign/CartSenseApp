// lib/pantry.ts
"use server";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { normalizeIngredientKey } from "@/lib/ingredientNormalization";
import { getIngredientCategory } from "@/lib/product-engine/ingredientQualityRules";

export type PantryItem = {
  id?: string;
  ingredientKey: string;      // normalized: "chicken_breast", "olive_oil"
  name: string;               // display: "Chicken Breast"
  purchasedAt: Timestamp;     // when they bought it
  expiresAt: Timestamp;       // purchasedAt + shelf life
  source: "cart_added" | "manual";
  quantity?: number;
};

/**
 * Get shelf life in days based on ingredient category
 */
function getShelfLifeDays(ingredientName: string): number {
  const category = getIngredientCategory(ingredientName);

  switch (category) {
    case "protein":
      // Assume refrigerated, not frozen
      return 5;
    case "dairy":
      return 10;
    case "eggs":
      return 21;
    case "produce":
      return 7;
    case "fruits":
      return 7;
    case "carb":
      // Bread, pasta, rice
      return 14;
    case "pantry":
      // Oils, spices, canned goods
      return 90;
    case "fats_oils":
      return 90;
    case "beans":
      // Canned or dried
      return 90;
    case "snacks":
      return 30;
    default:
      // Default to 15 days
      return 15;
  }
}

/**
 * Add items to user's pantry after they add to cart
 */
export async function addToPantry(
  userId: string,
  items: Array<{ name: string; quantity?: number }>,
  source: "cart_added" | "manual" = "cart_added"
): Promise<void> {
  if (!userId || items.length === 0) return;

  const pantryRef = adminDb
    .collection("pantryItems")
    .doc(userId)
    .collection("items");

  const now = Timestamp.now();
  const batch = adminDb.batch();

  for (const item of items) {
    const ingredientKey = normalizeIngredientKey(item.name);
    if (!ingredientKey) continue;

    const shelfLifeDays = getShelfLifeDays(item.name);
    const expiresAt = Timestamp.fromMillis(
      now.toMillis() + shelfLifeDays * 24 * 60 * 60 * 1000
    );

    // Check if item already exists
    const existing = await pantryRef
      .where("ingredientKey", "==", ingredientKey)
      .limit(1)
      .get();

    if (!existing.empty) {
      // Update existing item - refresh expiry
      const doc = existing.docs[0];
      batch.update(doc.ref, {
        purchasedAt: now,
        expiresAt,
        quantity: item.quantity ?? FieldValue.increment(1),
      });
    } else {
      // Add new item
      const newDoc = pantryRef.doc();
      batch.set(newDoc, {
        ingredientKey,
        name: item.name,
        purchasedAt: now,
        expiresAt,
        source,
        quantity: item.quantity ?? 1,
      });
    }
  }

  await batch.commit();
  console.log(`[Pantry] Added/updated ${items.length} items for user ${userId}`);
}

/**
 * Check which ingredients the user likely has in their pantry
 * Returns a Set of normalized ingredient keys that are in pantry
 */
export async function checkPantryItems(
  userId: string,
  ingredientNames: string[]
): Promise<Set<string>> {
  if (!userId || ingredientNames.length === 0) {
    return new Set();
  }

  const pantryRef = adminDb
    .collection("pantryItems")
    .doc(userId)
    .collection("items");

  const now = Timestamp.now();

  // Get all non-expired pantry items
  const snapshot = await pantryRef
    .where("expiresAt", ">", now)
    .get();

  const pantryKeys = new Set<string>();
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    pantryKeys.add(data.ingredientKey);
  });

  console.log(`[Pantry] User has ${pantryKeys.size} items in pantry:`, Array.from(pantryKeys));

  // Check which requested ingredients are in pantry
  const inPantry = new Set<string>();
  for (const name of ingredientNames) {
    const key = normalizeIngredientKey(name);
    console.log(`[Pantry] Checking "${name}" -> normalized key: "${key}" -> in pantry: ${pantryKeys.has(key)}`);
    if (pantryKeys.has(key)) {
      inPantry.add(key);
    }
  }

  return inPantry;
}

/**
 * Get all pantry items for a user (for display/management)
 */
export async function getPantryItems(userId: string): Promise<PantryItem[]> {
  if (!userId) return [];

  const pantryRef = adminDb
    .collection("pantryItems")
    .doc(userId)
    .collection("items");

  const now = Timestamp.now();

  const snapshot = await pantryRef
    .where("expiresAt", ">", now)
    .orderBy("expiresAt", "asc")
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as PantryItem[];
}

/**
 * Remove an item from pantry (user marks as used/gone)
 */
export async function removeFromPantry(
  userId: string,
  itemId: string
): Promise<void> {
  if (!userId || !itemId) return;

  await adminDb
    .collection("pantryItems")
    .doc(userId)
    .collection("items")
    .doc(itemId)
    .delete();
}

/**
 * Cleanup expired pantry items (can be called periodically)
 */
export async function cleanupExpiredPantryItems(userId: string): Promise<number> {
  if (!userId) return 0;

  const pantryRef = adminDb
    .collection("pantryItems")
    .doc(userId)
    .collection("items");

  const now = Timestamp.now();

  const expired = await pantryRef
    .where("expiresAt", "<=", now)
    .get();

  if (expired.empty) return 0;

  const batch = adminDb.batch();
  expired.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log(`[Pantry] Cleaned up ${expired.size} expired items for user ${userId}`);

  return expired.size;
}

/**
 * Clear all pantry items for a user
 */
export async function clearPantry(userId: string): Promise<number> {
  if (!userId) return 0;

  const pantryRef = adminDb
    .collection("pantryItems")
    .doc(userId)
    .collection("items");

  const snapshot = await pantryRef.get();

  if (snapshot.empty) return 0;

  const batch = adminDb.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log(`[Pantry] Cleared ${snapshot.size} items for user ${userId}`);

  return snapshot.size;
}
