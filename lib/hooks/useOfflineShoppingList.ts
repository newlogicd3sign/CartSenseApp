"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useNetwork } from "@/context/NetworkContext";
import {
  cacheShoppingList,
  getCachedShoppingList,
  updateCachedShoppingListItem,
  isIndexedDBAvailable,
} from "@/lib/offlineStorage";
import {
  queueAddItem,
  queueUpdateItem,
  queueDeleteItem,
  syncPendingShoppingListOperations,
  getPendingShoppingListSyncCount,
  type ShoppingItem,
} from "@/lib/shoppingListSync";
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

type UseOfflineShoppingListOptions = {
  userId: string | null;
};

/**
 * Hook for managing offline-capable shopping list.
 * Provides optimistic updates and syncs when back online.
 */
export function useOfflineShoppingList(
  firestoreItems: ShoppingItem[],
  isLoadingFirestore: boolean,
  options: UseOfflineShoppingListOptions
) {
  const { userId } = options;
  const { isOnline, isOffline } = useNetwork();

  const [localItems, setLocalItems] = useState<ShoppingItem[]>([]);
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasCachedData, setHasCachedData] = useState(false);

  const syncInProgressRef = useRef(false);
  const previousOnlineState = useRef(isOnline);

  // Load cached items on mount
  useEffect(() => {
    if (!userId || !isIndexedDBAvailable()) {
      setIsLoadingFromCache(false);
      return;
    }

    const loadCached = async () => {
      try {
        const cached = await getCachedShoppingList(userId);
        if (cached && cached.items.length > 0) {
          setLocalItems(cached.items);
          setHasCachedData(true);
        }

        const count = await getPendingShoppingListSyncCount();
        setPendingSyncCount(count);
      } catch (err) {
        console.error("Error loading cached shopping list:", err);
      } finally {
        setIsLoadingFromCache(false);
      }
    };

    void loadCached();
  }, [userId]);

  // Cache Firestore items when they're loaded (while online)
  useEffect(() => {
    if (!userId || isOffline || isLoadingFirestore || firestoreItems.length === 0) {
      return;
    }

    if (!isIndexedDBAvailable()) {
      return;
    }

    const cacheFirestoreItems = async () => {
      try {
        await cacheShoppingList(userId, firestoreItems);
        setLocalItems(firestoreItems);
        setHasCachedData(true);
      } catch (err) {
        console.error("Error caching shopping list:", err);
      }
    };

    void cacheFirestoreItems();
  }, [userId, firestoreItems, isLoadingFirestore, isOffline]);

  // Sync pending operations when coming back online
  useEffect(() => {
    if (!userId || !isOnline || syncInProgressRef.current) {
      return;
    }

    // Only sync when transitioning from offline to online
    if (previousOnlineState.current === false && isOnline) {
      const syncPending = async () => {
        syncInProgressRef.current = true;
        setIsSyncing(true);

        try {
          const result = await syncPendingShoppingListOperations();
          if (result.synced > 0) {
            console.log(`Synced ${result.synced} shopping list operations`);
          }
          if (result.failed > 0) {
            console.warn(`Failed to sync ${result.failed} operations:`, result.errors);
          }

          const count = await getPendingShoppingListSyncCount();
          setPendingSyncCount(count);
        } catch (err) {
          console.error("Error syncing pending operations:", err);
        } finally {
          setIsSyncing(false);
          syncInProgressRef.current = false;
        }
      };

      void syncPending();
    }

    previousOnlineState.current = isOnline;
  }, [userId, isOnline]);

  // Toggle item checked status
  const toggleItemChecked = useCallback(
    async (itemId: string) => {
      if (!userId) return;

      const item = (isOffline ? localItems : firestoreItems).find((i) => i.id === itemId);
      if (!item) return;

      const newChecked = !item.checked;

      // Optimistic update
      setLocalItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, checked: newChecked } : i))
      );

      if (isOffline) {
        // Queue for later sync
        await queueUpdateItem(userId, itemId, { checked: newChecked });
        await updateCachedShoppingListItem(
          userId,
          localItems.map((i) => (i.id === itemId ? { ...i, checked: newChecked } : i)),
          "pending"
        );
        const count = await getPendingShoppingListSyncCount();
        setPendingSyncCount(count);
      } else {
        // Direct Firestore update
        try {
          const itemRef = doc(db, "shoppingLists", userId, "items", itemId);
          await updateDoc(itemRef, { checked: newChecked });
        } catch (err) {
          // Revert on error
          setLocalItems((prev) =>
            prev.map((i) => (i.id === itemId ? { ...i, checked: item.checked } : i))
          );
          throw err;
        }
      }
    },
    [userId, isOffline, localItems, firestoreItems]
  );

  // Delete item
  const deleteItem = useCallback(
    async (itemId: string) => {
      if (!userId) return;

      // Optimistic update
      const previousItems = localItems;
      setLocalItems((prev) => prev.filter((i) => i.id !== itemId));

      if (isOffline) {
        await queueDeleteItem(userId, itemId);
        await updateCachedShoppingListItem(
          userId,
          localItems.filter((i) => i.id !== itemId),
          "pending"
        );
        const count = await getPendingShoppingListSyncCount();
        setPendingSyncCount(count);
      } else {
        try {
          const itemRef = doc(db, "shoppingLists", userId, "items", itemId);
          await deleteDoc(itemRef);
        } catch (err) {
          // Revert on error
          setLocalItems(previousItems);
          throw err;
        }
      }
    },
    [userId, isOffline, localItems]
  );

  // Add item
  const addItem = useCallback(
    async (item: Omit<ShoppingItem, "id" | "createdAt">) => {
      if (!userId) return;

      // Create temporary ID for optimistic update
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newItem: ShoppingItem = {
        ...item,
        id: tempId,
        createdAt: Date.now(),
      };

      // Optimistic update
      setLocalItems((prev) => [newItem, ...prev]);

      if (isOffline) {
        await queueAddItem(userId, item);
        await updateCachedShoppingListItem(userId, [newItem, ...localItems], "pending");
        const count = await getPendingShoppingListSyncCount();
        setPendingSyncCount(count);
      } else {
        try {
          const itemsCol = collection(db, "shoppingLists", userId, "items");
          await addDoc(itemsCol, {
            ...item,
            createdAt: serverTimestamp(),
          });
          // Firestore listener will update the list with the real ID
        } catch (err) {
          // Revert on error
          setLocalItems((prev) => prev.filter((i) => i.id !== tempId));
          throw err;
        }
      }
    },
    [userId, isOffline, localItems]
  );

  // Determine which items to display
  const items = isOffline && hasCachedData ? localItems : firestoreItems;

  return {
    items,
    isOfflineMode: isOffline && hasCachedData,
    isLoadingFromCache,
    pendingSyncCount,
    isSyncing,
    toggleItemChecked,
    deleteItem,
    addItem,
    hasCachedData,
  };
}
