// lib/product-engine/krogerConfig.ts
// Centralized configuration for Kroger Rate-Safe architecture

export const KROGER_RATE_LIMITS = {
  // Concurrency control
  MAX_CONCURRENT_REQUESTS: 5,
  QUEUE_TIMEOUT_MS: 30000, // 30 seconds max wait in queue

  // Rate limits (conservative estimates)
  REQUESTS_PER_SECOND: 10,
  REQUESTS_PER_HOUR: 5000,

  // Retry configuration
  RETRY_ATTEMPTS: 3,
  RETRY_BASE_DELAY_MS: 1000, // 1s, 2s, 4s exponential backoff

  // Circuit breaker
  CIRCUIT_BREAKER_THRESHOLD: 5, // failures before opening
  CIRCUIT_BREAKER_TIMEOUT_MS: 120000, // 2 minutes cooldown

  // Rate limit pause (when 429 detected)
  RATE_LIMIT_PAUSE_MS: 30000, // 30 seconds global pause
} as const;

export const CACHE_WARMING = {
  ENABLED: true,
  INTERVAL_HOURS: 12,
  PRODUCTS_PER_LOCATION: 50,
  DELAY_BETWEEN_REQUESTS_MS: 2000, // 2 seconds between API calls

  // Top 50 popular ingredients to pre-cache
  POPULAR_INGREDIENTS: [
    // Proteins
    "chicken breast",
    "ground beef",
    "chicken thighs",
    "bacon",
    "eggs",
    "salmon",
    "shrimp",
    "pork chops",
    "ground turkey",
    "sausage",

    // Dairy
    "milk",
    "butter",
    "cheddar cheese",
    "cream cheese",
    "sour cream",
    "heavy cream",
    "parmesan cheese",
    "mozzarella cheese",
    "greek yogurt",

    // Produce
    "onion",
    "garlic",
    "tomatoes",
    "potatoes",
    "carrots",
    "celery",
    "bell pepper",
    "broccoli",
    "spinach",
    "lettuce",
    "mushrooms",
    "lemon",
    "lime",

    // Fruits
    "bananas",
    "apples",
    "strawberries",
    "blueberries",

    // Pantry
    "olive oil",
    "vegetable oil",
    "all purpose flour",
    "sugar",
    "brown sugar",
    "salt",
    "black pepper",
    "rice",
    "pasta",
    "bread",
    "chicken broth",
    "beef broth",
    "canned tomatoes",
    "tomato paste",
    "soy sauce",
  ],
} as const;

// Priority levels for queue (higher = more important)
export const QUEUE_PRIORITY = {
  CART: 10, // Cart operations are highest priority
  ENRICH: 5, // Meal enrichment is medium priority
  LOCATION: 3, // Location search is lower priority
  WARMING: 1, // Cache warming is lowest priority
} as const;

// Error types for structured error handling
export type KrogerErrorType =
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "SERVER_ERROR"
  | "AUTH_ERROR"
  | "NOT_FOUND"
  | "NETWORK_ERROR"
  | "CIRCUIT_OPEN";

export interface KrogerError {
  type: KrogerErrorType;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
}

export function createKrogerError(
  type: KrogerErrorType,
  message: string,
  retryAfterMs?: number
): KrogerError {
  const retryable = ["RATE_LIMITED", "TIMEOUT", "SERVER_ERROR", "NETWORK_ERROR"].includes(type);
  return { type, message, retryable, retryAfterMs };
}
