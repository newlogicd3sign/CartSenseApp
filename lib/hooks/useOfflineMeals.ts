"use client";

import { useState, useEffect, useCallback } from "react";
import { useNetwork } from "@/context/NetworkContext";
import {
  cacheMeals,
  getAllCachedMeals,
  deleteCachedMeal,
  isIndexedDBAvailable,
  type CachedMeal,
} from "@/lib/offlineStorage";

export type OfflineMealsState = {
  isOfflineMode: boolean;
  isLoadingFromCache: boolean;
  cacheError: Error | null;
};

type UseMealsOptions = {
  onMealsLoaded?: (meals: any[]) => void;
};

/**
 * Hook for managing offline meals caching.
 * Caches meals to IndexedDB when online, serves from cache when offline.
 */
export function useOfflineMeals(
  firestoreMeals: any[],
  isLoadingFirestore: boolean,
  options?: UseMealsOptions
) {
  const { isOffline } = useNetwork();
  const [cachedMeals, setCachedMeals] = useState<any[]>([]);
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(true);
  const [cacheError, setCacheError] = useState<Error | null>(null);
  const [hasCachedData, setHasCachedData] = useState(false);

  // Load cached meals on mount (for offline support)
  useEffect(() => {
    if (!isIndexedDBAvailable()) {
      setIsLoadingFromCache(false);
      return;
    }

    const loadCached = async () => {
      try {
        const cached = await getAllCachedMeals();
        if (cached.length > 0) {
          // Sort by cachedAt descending (most recent first)
          cached.sort((a, b) => b.cachedAt - a.cachedAt);
          const meals = cached.map((c) => ({
            ...c.mealData,
            id: c.id,
          }));
          setCachedMeals(meals);
          setHasCachedData(true);
        }
      } catch (err) {
        console.error("Error loading cached meals:", err);
        setCacheError(err instanceof Error ? err : new Error("Failed to load cached meals"));
      } finally {
        setIsLoadingFromCache(false);
      }
    };

    void loadCached();
  }, []);

  // Cache Firestore meals when they're loaded (while online)
  useEffect(() => {
    if (isOffline || isLoadingFirestore || firestoreMeals.length === 0) {
      return;
    }

    if (!isIndexedDBAvailable()) {
      return;
    }

    const cacheFirestoreMeals = async () => {
      try {
        const mealsToCache = firestoreMeals.map((meal) => ({
          id: meal.id,
          data: meal,
        }));
        await cacheMeals(mealsToCache);
        setCachedMeals(firestoreMeals);
        setHasCachedData(true);
      } catch (err) {
        console.error("Error caching meals:", err);
        // Don't set error state here - caching failure shouldn't block UI
      }
    };

    void cacheFirestoreMeals();
  }, [firestoreMeals, isLoadingFirestore, isOffline]);

  // Remove meal from cache
  const removeCachedMeal = useCallback(async (mealId: string) => {
    if (!isIndexedDBAvailable()) return;

    try {
      await deleteCachedMeal(mealId);
      setCachedMeals((prev) => prev.filter((m) => m.id !== mealId));
    } catch (err) {
      console.error("Error removing cached meal:", err);
    }
  }, []);

  // Determine which meals to display
  const meals = isOffline && hasCachedData ? cachedMeals : firestoreMeals;

  return {
    meals,
    isOfflineMode: isOffline && hasCachedData,
    isLoadingFromCache,
    cacheError,
    removeCachedMeal,
    hasCachedData,
  };
}
