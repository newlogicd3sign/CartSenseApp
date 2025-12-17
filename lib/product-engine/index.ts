// lib/product-engine/index.ts
// Product Engine - Centralized product normalization, selection, and API integration
// This module can be licensed separately for use in other applications

// Core Selection Logic
export {
  // Main selection functions
  selectBestProduct,
  selectTopProducts,
  filterValidProducts,
  passesQualityCheck,
  getQualityRecommendations,

  // Scoring functions
  calculateQualityScore,
  calculateRelevanceScore,

  // Filtering functions
  isPetFood,
  isNonFoodProduct,
  isProductAvailable,

  // Re-exports from ingredientQualityRules
  CATEGORY_QUALITY_RULES,
  INGREDIENT_QUALITY_RULES,
  findIngredientRule,
  getCategoryRules,

  // Types
  type ProductCandidate,
  type SelectionResult,
  type SelectionOptions,
} from "./productSelectionService";

// Ingredient Quality Rules
export {
  // Category type for type safety
  type CategoryType,
  type IngredientQualityRule,

  // Quality rule functions
  shouldAvoidProduct,
  getQualityBonus,
  getQualityPenalty,
  getIngredientCategory,
} from "./ingredientQualityRules";

// Kroger API Integration
export {
  // Product search functions
  searchKrogerProduct,
  searchKrogerProducts,
  searchAlternativeProduct,

  // Location search
  searchKrogerLocationsByZip,

  // API status
  getKrogerApiStatus,

  // Types
  type KrogerProductMatch,
  type KrogerLocationResult,
} from "./kroger";

// Kroger Cache
export {
  getCachedProducts,
  writeProductsCache,
  cacheNotFound,
  type CachedKrogerProduct,
  type KrogerProductSearchCacheDoc,
} from "./krogerCache";

// Kroger Configuration
export {
  KROGER_RATE_LIMITS,
  CACHE_WARMING,
  QUEUE_PRIORITY,
  createKrogerError,
  type KrogerErrorType,
  type KrogerError,
} from "./krogerConfig";

// Queue Management
export {
  queueKrogerRequest,
  pauseKrogerQueue,
  getKrogerQueueStats,
} from "./krogerQueue";

// Rate Limiting
export {
  canMakeRequest,
  recordRequest,
} from "./krogerRateLimiter";

// Retry Logic
export {
  fetchWithRetry,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
} from "./krogerRetry";

// Cache Warming (client-side)
export {
  warmLocationInBackground,
  warmLocationAndWait,
} from "./krogerWarm";
