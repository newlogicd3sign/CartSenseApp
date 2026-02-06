/**
 * Shopping list sync logic for offline support.
 * Handles syncing pending operations when back online.
 * Conflict resolution: server wins.
 */

import {
  getPendingSyncsByCollection,
  deletePendingSync,
  addPendingSync,
  getPendingSyncCount,
  type PendingSync,
} from "@/lib/offlineStorage";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

export type ShoppingItem = {
  id: string;
  name: string;
  quantity: string;
  count?: number;
  mealId?: string;
  mealName?: string;
  mealImageUrl?: string;
  checked: boolean;
  createdAt?: unknown;
  krogerProductId?: string;
  productName?: string;
  productImageUrl?: string;
  productSize?: string;
  productAisle?: string;
  price?: number;
  soldBy?: "WEIGHT" | "UNIT";
  stockLevel?: string;
};

export type SyncResult = {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
};

/**
 * Queue an add operation for when back online
 */
export async function queueAddItem(
  userId: string,
  item: Omit<ShoppingItem, "id">
): Promise<string> {
  return addPendingSync("add", "shoppingList", {
    userId,
    item,
  });
}

/**
 * Queue an update operation for when back online
 */
export async function queueUpdateItem(
  userId: string,
  itemId: string,
  updates: Partial<ShoppingItem>
): Promise<string> {
  return addPendingSync("update", "shoppingList", {
    userId,
    itemId,
    updates,
  });
}

/**
 * Queue a delete operation for when back online
 */
export async function queueDeleteItem(
  userId: string,
  itemId: string
): Promise<string> {
  return addPendingSync("delete", "shoppingList", {
    userId,
    itemId,
  });
}

/**
 * Process all pending shopping list syncs
 */
export async function syncPendingShoppingListOperations(): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    synced: 0,
    failed: 0,
    errors: [],
  };

  try {
    const pendingOps = await getPendingSyncsByCollection("shoppingList");

    for (const op of pendingOps) {
      try {
        await processSyncOperation(op);
        await deletePendingSync(op.id);
        result.synced++;
      } catch (err) {
        result.failed++;
        result.errors.push(
          err instanceof Error ? err.message : "Unknown sync error"
        );
        console.error("Error processing sync operation:", err);
      }
    }

    result.success = result.failed === 0;
  } catch (err) {
    result.success = false;
    result.errors.push(
      err instanceof Error ? err.message : "Failed to get pending operations"
    );
  }

  return result;
}

/**
 * Process a single sync operation
 */
async function processSyncOperation(op: PendingSync): Promise<void> {
  const { action, data } = op;
  const { userId, itemId, item, updates } = data;

  switch (action) {
    case "add": {
      if (!item) throw new Error("Missing item data for add operation");
      const itemsCol = collection(db, "shoppingLists", userId, "items");
      await addDoc(itemsCol, {
        ...item,
        createdAt: serverTimestamp(),
      });
      break;
    }

    case "update": {
      if (!itemId) throw new Error("Missing itemId for update operation");
      const itemRef = doc(db, "shoppingLists", userId, "items", itemId);
      await updateDoc(itemRef, updates);
      break;
    }

    case "delete": {
      if (!itemId) throw new Error("Missing itemId for delete operation");
      const itemRef = doc(db, "shoppingLists", userId, "items", itemId);
      await deleteDoc(itemRef);
      break;
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Fetch all shopping list items from Firestore
 */
export async function fetchShoppingListFromFirestore(
  userId: string
): Promise<ShoppingItem[]> {
  const itemsCol = collection(db, "shoppingLists", userId, "items");
  const q = query(itemsCol, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<ShoppingItem, "id">),
  }));
}

/**
 * Get count of pending sync operations
 */
export async function getPendingShoppingListSyncCount(): Promise<number> {
  const pending = await getPendingSyncsByCollection("shoppingList");
  return pending.length;
}

/**
 * Check if there are pending shopping list syncs
 */
export async function hasPendingShoppingListSyncs(): Promise<boolean> {
  const count = await getPendingShoppingListSyncCount();
  return count > 0;
}
