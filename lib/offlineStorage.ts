/**
 * IndexedDB wrapper for offline storage.
 * Database: cartsense-offline
 * Stores: savedMeals, shoppingList, pendingSync
 */

const DB_NAME = "cartsense-offline";
const DB_VERSION = 1;

export type CachedMeal = {
  id: string;
  mealData: any;
  cachedAt: number;
};

export type CachedShoppingList = {
  id: string;
  items: any[];
  syncStatus: "synced" | "pending" | "conflict";
  lastModified: number;
};

export type PendingSync = {
  id: string;
  action: "add" | "update" | "delete";
  collection: "shoppingList" | "savedMeals";
  data: any;
  createdAt: number;
};

let dbInstance: IDBDatabase | null = null;

/**
 * Open/get the IndexedDB database connection
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create savedMeals store
      if (!db.objectStoreNames.contains("savedMeals")) {
        const mealsStore = db.createObjectStore("savedMeals", { keyPath: "id" });
        mealsStore.createIndex("cachedAt", "cachedAt", { unique: false });
      }

      // Create shoppingList store
      if (!db.objectStoreNames.contains("shoppingList")) {
        const listStore = db.createObjectStore("shoppingList", { keyPath: "id" });
        listStore.createIndex("syncStatus", "syncStatus", { unique: false });
        listStore.createIndex("lastModified", "lastModified", { unique: false });
      }

      // Create pendingSync store
      if (!db.objectStoreNames.contains("pendingSync")) {
        const syncStore = db.createObjectStore("pendingSync", { keyPath: "id" });
        syncStore.createIndex("createdAt", "createdAt", { unique: false });
        syncStore.createIndex("collection", "collection", { unique: false });
      }
    };
  });
}

// =====================
// Saved Meals Operations
// =====================

export async function cacheMeal(id: string, mealData: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("savedMeals", "readwrite");
    const store = transaction.objectStore("savedMeals");

    const item: CachedMeal = {
      id,
      mealData,
      cachedAt: Date.now(),
    };

    const request = store.put(item);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function cacheMeals(meals: Array<{ id: string; data: any }>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("savedMeals", "readwrite");
    const store = transaction.objectStore("savedMeals");

    const now = Date.now();
    for (const meal of meals) {
      const item: CachedMeal = {
        id: meal.id,
        mealData: meal.data,
        cachedAt: now,
      };
      store.put(item);
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getCachedMeal(id: string): Promise<CachedMeal | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("savedMeals", "readonly");
    const store = transaction.objectStore("savedMeals");

    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function getAllCachedMeals(): Promise<CachedMeal[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("savedMeals", "readonly");
    const store = transaction.objectStore("savedMeals");

    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function deleteCachedMeal(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("savedMeals", "readwrite");
    const store = transaction.objectStore("savedMeals");

    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function clearCachedMeals(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("savedMeals", "readwrite");
    const store = transaction.objectStore("savedMeals");

    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// ==========================
// Shopping List Operations
// ==========================

export async function cacheShoppingList(id: string, items: any[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("shoppingList", "readwrite");
    const store = transaction.objectStore("shoppingList");

    const item: CachedShoppingList = {
      id,
      items,
      syncStatus: "synced",
      lastModified: Date.now(),
    };

    const request = store.put(item);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getCachedShoppingList(id: string): Promise<CachedShoppingList | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("shoppingList", "readonly");
    const store = transaction.objectStore("shoppingList");

    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function updateCachedShoppingListItem(
  listId: string,
  items: any[],
  syncStatus: "synced" | "pending" | "conflict" = "pending"
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("shoppingList", "readwrite");
    const store = transaction.objectStore("shoppingList");

    const item: CachedShoppingList = {
      id: listId,
      items,
      syncStatus,
      lastModified: Date.now(),
    };

    const request = store.put(item);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function clearCachedShoppingList(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("shoppingList", "readwrite");
    const store = transaction.objectStore("shoppingList");

    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// ==========================
// Pending Sync Operations
// ==========================

export async function addPendingSync(
  action: PendingSync["action"],
  collection: PendingSync["collection"],
  data: any
): Promise<string> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("pendingSync", "readwrite");
    const store = transaction.objectStore("pendingSync");

    const id = `${collection}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const item: PendingSync = {
      id,
      action,
      collection,
      data,
      createdAt: Date.now(),
    };

    const request = store.put(item);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(id);
  });
}

export async function getPendingSyncs(): Promise<PendingSync[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("pendingSync", "readonly");
    const store = transaction.objectStore("pendingSync");

    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const items = request.result || [];
      // Sort by createdAt to process in order
      items.sort((a, b) => a.createdAt - b.createdAt);
      resolve(items);
    };
  });
}

export async function getPendingSyncsByCollection(
  collection: PendingSync["collection"]
): Promise<PendingSync[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("pendingSync", "readonly");
    const store = transaction.objectStore("pendingSync");
    const index = store.index("collection");

    const request = index.getAll(collection);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const items = request.result || [];
      items.sort((a, b) => a.createdAt - b.createdAt);
      resolve(items);
    };
  });
}

export async function deletePendingSync(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("pendingSync", "readwrite");
    const store = transaction.objectStore("pendingSync");

    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function clearPendingSyncs(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("pendingSync", "readwrite");
    const store = transaction.objectStore("pendingSync");

    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getPendingSyncCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("pendingSync", "readonly");
    const store = transaction.objectStore("pendingSync");

    const request = store.count();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// ==========================
// Utility
// ==========================

export async function clearAllOfflineData(): Promise<void> {
  await clearCachedMeals();
  await clearCachedShoppingList();
  await clearPendingSyncs();
}

export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}
