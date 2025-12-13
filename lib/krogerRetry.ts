// lib/krogerRetry.ts
// Retry logic with exponential backoff and circuit breaker for Kroger API
import "server-only";
import {
  KROGER_RATE_LIMITS,
  createKrogerError,
  type KrogerError,
  type KrogerErrorType,
} from "./krogerConfig";
import { pauseKrogerQueue } from "./krogerQueue";

// Circuit breaker state
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
  openedAt: number;
}

let circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailureTime: 0,
  isOpen: false,
  openedAt: 0,
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay for exponential backoff
 */
function calculateBackoffDelay(attempt: number, baseDelay: number): number {
  // Exponential backoff: 1s, 2s, 4s, etc.
  const delay = baseDelay * Math.pow(2, attempt);
  // Add jitter (±20%) to prevent thundering herd
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return Math.floor(delay + jitter);
}

/**
 * Check if circuit breaker is open
 */
function isCircuitOpen(): boolean {
  if (!circuitBreaker.isOpen) {
    return false;
  }

  // Check if cooldown period has passed
  const elapsed = Date.now() - circuitBreaker.openedAt;
  if (elapsed >= KROGER_RATE_LIMITS.CIRCUIT_BREAKER_TIMEOUT_MS) {
    // Half-open state: allow one request through
    console.log("⚡ Circuit breaker HALF-OPEN - allowing test request");
    return false;
  }

  return true;
}

/**
 * Record a failure for circuit breaker
 */
function recordFailure(): void {
  const now = Date.now();

  // Reset failure count if last failure was more than 1 minute ago
  if (now - circuitBreaker.lastFailureTime > 60000) {
    circuitBreaker.failures = 0;
  }

  circuitBreaker.failures++;
  circuitBreaker.lastFailureTime = now;

  if (circuitBreaker.failures >= KROGER_RATE_LIMITS.CIRCUIT_BREAKER_THRESHOLD) {
    circuitBreaker.isOpen = true;
    circuitBreaker.openedAt = now;
    console.log(
      `🔴 Circuit breaker OPEN after ${circuitBreaker.failures} failures - cooling down for ${KROGER_RATE_LIMITS.CIRCUIT_BREAKER_TIMEOUT_MS / 1000}s`
    );
  }
}

/**
 * Record a success (resets circuit breaker)
 */
function recordSuccess(): void {
  if (circuitBreaker.isOpen) {
    console.log("🟢 Circuit breaker CLOSED - API recovered");
  }
  circuitBreaker = {
    failures: 0,
    lastFailureTime: 0,
    isOpen: false,
    openedAt: 0,
  };
}

/**
 * Parse error type from fetch response
 */
function parseErrorType(status: number): KrogerErrorType {
  if (status === 429) return "RATE_LIMITED";
  if (status === 401 || status === 403) return "AUTH_ERROR";
  if (status === 404) return "NOT_FOUND";
  if (status >= 500) return "SERVER_ERROR";
  return "SERVER_ERROR";
}

/**
 * Parse Retry-After header
 */
function parseRetryAfter(response: Response): number | undefined {
  const retryAfter = response.headers.get("Retry-After");
  if (!retryAfter) return undefined;

  // Could be seconds or HTTP date
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000;
  }

  // Try parsing as HTTP date
  const date = new Date(retryAfter);
  if (!isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }

  return undefined;
}

export type RetryableFetch = typeof fetch;

/**
 * Wrapper for fetch with retry logic, exponential backoff, and circuit breaker
 */
export async function fetchWithRetry(
  url: string | URL,
  options?: RequestInit,
  retryOptions?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    onRetry?: (attempt: number, error: KrogerError) => void;
  }
): Promise<Response> {
  const maxAttempts = retryOptions?.maxAttempts ?? KROGER_RATE_LIMITS.RETRY_ATTEMPTS;
  const baseDelayMs = retryOptions?.baseDelayMs ?? KROGER_RATE_LIMITS.RETRY_BASE_DELAY_MS;

  // Check circuit breaker
  if (isCircuitOpen()) {
    throw createKrogerError(
      "CIRCUIT_OPEN",
      "Circuit breaker is open - too many recent failures",
      KROGER_RATE_LIMITS.CIRCUIT_BREAKER_TIMEOUT_MS - (Date.now() - circuitBreaker.openedAt)
    );
  }

  let lastError: KrogerError | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfterMs = parseRetryAfter(response) ?? KROGER_RATE_LIMITS.RATE_LIMIT_PAUSE_MS;

        lastError = createKrogerError(
          "RATE_LIMITED",
          `Rate limited by Kroger API (429)`,
          retryAfterMs
        );

        // Pause the entire queue
        pauseKrogerQueue(retryAfterMs);
        recordFailure();

        // Log and notify
        retryOptions?.onRetry?.(attempt, lastError);
        console.warn(
          `⚠️ Kroger API 429 - attempt ${attempt + 1}/${maxAttempts} - waiting ${retryAfterMs}ms`
        );

        // Wait before retry
        if (attempt < maxAttempts - 1) {
          await sleep(retryAfterMs);
          continue;
        }

        throw lastError;
      }

      // Handle server errors (5xx) - retryable
      if (response.status >= 500) {
        lastError = createKrogerError("SERVER_ERROR", `Server error: ${response.status}`);
        recordFailure();

        retryOptions?.onRetry?.(attempt, lastError);

        if (attempt < maxAttempts - 1) {
          const delay = calculateBackoffDelay(attempt, baseDelayMs);
          console.warn(
            `⚠️ Kroger API ${response.status} - attempt ${attempt + 1}/${maxAttempts} - retrying in ${delay}ms`
          );
          await sleep(delay);
          continue;
        }

        throw lastError;
      }

      // Handle auth errors - not retryable
      if (response.status === 401 || response.status === 403) {
        throw createKrogerError("AUTH_ERROR", `Authentication error: ${response.status}`);
      }

      // Handle not found - not retryable
      if (response.status === 404) {
        throw createKrogerError("NOT_FOUND", "Resource not found");
      }

      // Success!
      recordSuccess();
      return response;
    } catch (error) {
      // Handle network errors and timeouts
      if (error instanceof Error) {
        // Check if it's already a KrogerError
        if ("type" in error && "retryable" in error) {
          throw error;
        }

        // Network error or timeout
        const isTimeout = error.name === "TimeoutError" || error.name === "AbortError";
        lastError = createKrogerError(
          isTimeout ? "TIMEOUT" : "NETWORK_ERROR",
          error.message || "Network error"
        );

        recordFailure();
        retryOptions?.onRetry?.(attempt, lastError);

        if (attempt < maxAttempts - 1) {
          const delay = calculateBackoffDelay(attempt, baseDelayMs);
          console.warn(
            `⚠️ Kroger ${isTimeout ? "timeout" : "network error"} - attempt ${attempt + 1}/${maxAttempts} - retrying in ${delay}ms`
          );
          await sleep(delay);
          continue;
        }
      }

      throw lastError ?? createKrogerError("NETWORK_ERROR", "Unknown error");
    }
  }

  // Should not reach here, but just in case
  throw lastError ?? createKrogerError("SERVER_ERROR", "Max retries exceeded");
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error && typeof error === "object" && "retryable" in error) {
    return (error as KrogerError).retryable;
  }
  return false;
}

/**
 * Get circuit breaker status
 */
export function getCircuitBreakerStatus(): {
  isOpen: boolean;
  failures: number;
  cooldownRemainingMs: number;
} {
  return {
    isOpen: circuitBreaker.isOpen,
    failures: circuitBreaker.failures,
    cooldownRemainingMs: circuitBreaker.isOpen
      ? Math.max(0, KROGER_RATE_LIMITS.CIRCUIT_BREAKER_TIMEOUT_MS - (Date.now() - circuitBreaker.openedAt))
      : 0,
  };
}

/**
 * Reset circuit breaker (for testing or manual recovery)
 */
export function resetCircuitBreaker(): void {
  circuitBreaker = {
    failures: 0,
    lastFailureTime: 0,
    isOpen: false,
    openedAt: 0,
  };
  console.log("🔄 Circuit breaker manually reset");
}
