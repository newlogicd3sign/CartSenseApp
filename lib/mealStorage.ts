/**
 * Utility for persisting generated meals across browser sessions.
 *
 * Uses both sessionStorage (for quick access during session) and
 * localStorage (for persistence across browser restarts).
 *
 * Also tracks the last viewed meal so users can return to it.
 */

type Ingredient = {
    name: string;
    quantity: string;
    category?: string;
    aisle?: string;
    price?: number;
    soldBy?: "WEIGHT" | "UNIT";
    stockLevel?: string;
    available?: boolean;
    krogerProductId?: string;
    productName?: string;
    productImageUrl?: string;
    productSize?: string;
    productAisle?: string;
};

type Meal = {
    id: string;
    mealType: "breakfast" | "lunch" | "dinner" | "snack";
    name: string;
    description: string;
    servings: number;
    macros: {
        calories: number;
        protein: number;
        carbs: number;
        fiber: number;
        fat: number;
    };
    ingredients: Ingredient[];
    steps: string[];
    imageUrl?: string;
    cookTimeRange?: {
        min: number;
        max: number;
    };
};

type MealsMeta = {
    usedDoctorInstructions?: boolean;
    blockedIngredientsFromDoctor?: string[];
    blockedGroupsFromDoctor?: string[];
    pantryMode?: boolean;
};

type StoredMealsPayload = {
    meals: Meal[];
    meta?: MealsMeta;
    prompt?: string;
    savedAt?: number;
};

type LastViewedMeal = {
    mealId: string;
    prompt: string;
    savedAt: number;
};

const GENERATED_MEALS_KEY = "generatedMeals";
const PERSISTED_MEALS_KEY = "persistedMeals";
const LAST_VIEWED_MEAL_KEY = "lastViewedMeal";

// Maximum age for persisted meals (24 hours)
const MAX_PERSISTENCE_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Save generated meals to both sessionStorage and localStorage
 */
export function saveGeneratedMeals(
    meals: Meal[],
    meta?: MealsMeta,
    prompt?: string
): void {
    const payload: StoredMealsPayload = {
        meals,
        meta,
        prompt,
        savedAt: Date.now(),
    };

    const jsonStr = JSON.stringify(payload);

    try {
        // Save to sessionStorage for immediate access
        sessionStorage.setItem(GENERATED_MEALS_KEY, jsonStr);
    } catch (err) {
        console.error("Failed to save meals to sessionStorage:", err);
    }

    try {
        // Also save to localStorage for persistence across sessions
        localStorage.setItem(PERSISTED_MEALS_KEY, jsonStr);
    } catch (err) {
        console.error("Failed to save meals to localStorage:", err);
    }
}

/**
 * Load generated meals, preferring sessionStorage but falling back to localStorage
 */
export function loadGeneratedMeals(): StoredMealsPayload | null {
    // First try sessionStorage (most recent/current session)
    try {
        const sessionData = sessionStorage.getItem(GENERATED_MEALS_KEY);
        if (sessionData) {
            const parsed = JSON.parse(sessionData);
            // Handle legacy format (array)
            if (Array.isArray(parsed)) {
                return { meals: parsed };
            }
            return parsed as StoredMealsPayload;
        }
    } catch (err) {
        console.error("Failed to load meals from sessionStorage:", err);
    }

    // Fall back to localStorage (persisted from previous session)
    try {
        const localData = localStorage.getItem(PERSISTED_MEALS_KEY);
        if (localData) {
            const parsed = JSON.parse(localData);
            // Handle legacy format (array)
            if (Array.isArray(parsed)) {
                const payload: StoredMealsPayload = { meals: parsed };
                // Restore to sessionStorage for this session
                sessionStorage.setItem(GENERATED_MEALS_KEY, JSON.stringify(payload));
                return payload;
            }

            const payload = parsed as StoredMealsPayload;

            // Check if the persisted data is too old
            if (payload.savedAt && Date.now() - payload.savedAt > MAX_PERSISTENCE_AGE_MS) {
                // Data is stale, clear it
                localStorage.removeItem(PERSISTED_MEALS_KEY);
                return null;
            }

            // Restore to sessionStorage for this session
            sessionStorage.setItem(GENERATED_MEALS_KEY, JSON.stringify(payload));
            return payload;
        }
    } catch (err) {
        console.error("Failed to load meals from localStorage:", err);
    }

    return null;
}

/**
 * Update a single meal in storage (used when meal is modified via AI chat)
 */
export function updateMealInStorage(updatedMeal: Meal): void {
    const data = loadGeneratedMeals();
    if (!data) return;

    const idx = data.meals.findIndex((m) => m.id === updatedMeal.id);
    if (idx >= 0) {
        data.meals[idx] = updatedMeal;
        saveGeneratedMeals(data.meals, data.meta, data.prompt);
    }
}

/**
 * Save the last viewed meal ID so user can return to it
 */
export function saveLastViewedMeal(mealId: string, prompt: string): void {
    const data: LastViewedMeal = {
        mealId,
        prompt,
        savedAt: Date.now(),
    };

    try {
        localStorage.setItem(LAST_VIEWED_MEAL_KEY, JSON.stringify(data));
    } catch (err) {
        console.error("Failed to save last viewed meal:", err);
    }
}

/**
 * Get the last viewed meal info
 */
export function getLastViewedMeal(): LastViewedMeal | null {
    try {
        const data = localStorage.getItem(LAST_VIEWED_MEAL_KEY);
        if (!data) return null;

        const parsed = JSON.parse(data) as LastViewedMeal;

        // Check if it's still valid (within 24 hours)
        if (Date.now() - parsed.savedAt > MAX_PERSISTENCE_AGE_MS) {
            localStorage.removeItem(LAST_VIEWED_MEAL_KEY);
            return null;
        }

        return parsed;
    } catch (err) {
        console.error("Failed to get last viewed meal:", err);
        return null;
    }
}

/**
 * Clear the last viewed meal (call when user generates new meals)
 */
export function clearLastViewedMeal(): void {
    try {
        localStorage.removeItem(LAST_VIEWED_MEAL_KEY);
    } catch (err) {
        console.error("Failed to clear last viewed meal:", err);
    }
}

/**
 * Clear all stored meals (useful for testing or when user logs out)
 */
export function clearAllMealStorage(): void {
    try {
        sessionStorage.removeItem(GENERATED_MEALS_KEY);
        localStorage.removeItem(PERSISTED_MEALS_KEY);
        localStorage.removeItem(LAST_VIEWED_MEAL_KEY);
    } catch (err) {
        console.error("Failed to clear meal storage:", err);
    }
}

/**
 * Check if there are persisted meals available from a previous session
 */
export function hasPersistedMeals(): boolean {
    try {
        const data = localStorage.getItem(PERSISTED_MEALS_KEY);
        if (!data) return false;

        const parsed = JSON.parse(data) as StoredMealsPayload;

        // Check if data is not too old
        if (parsed.savedAt && Date.now() - parsed.savedAt > MAX_PERSISTENCE_AGE_MS) {
            return false;
        }

        return parsed.meals && parsed.meals.length > 0;
    } catch {
        return false;
    }
}
