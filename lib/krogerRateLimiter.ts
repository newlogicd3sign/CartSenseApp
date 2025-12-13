// lib/krogerRateLimiter.ts
// Sliding window rate limiter for Kroger API using Firestore
import "server-only";
import { adminDb } from "./firebaseAdmin";
import admin from "firebase-admin";
import { KROGER_RATE_LIMITS } from "./krogerConfig";

const COLLECTION_NAME = "krogerRateLimits";

interface RateLimitDoc {
  windowKey: string;
  count: number;
  expiresAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

/**
 * Get current window key for a given granularity
 */
function getWindowKey(granularity: "second" | "hour"): string {
  const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
  if (granularity === "second") {
    return `second_${now}`;
  }
  // Round down to nearest hour
  const hourTimestamp = Math.floor(now / 3600) * 3600;
  return `hour_${hourTimestamp}`;
}

/**
 * Get expiration timestamp for a window
 */
function getWindowExpiration(granularity: "second" | "hour"): FirebaseFirestore.Timestamp {
  const now = Date.now();
  if (granularity === "second") {
    // Expire after 2 seconds (buffer for clock skew)
    return admin.firestore.Timestamp.fromMillis(now + 2000);
  }
  // Expire after 1 hour + 1 minute buffer
  return admin.firestore.Timestamp.fromMillis(now + 3660000);
}

/**
 * Check if we can make a request (pre-flight check)
 * Returns { allowed: true } if under limit, or { allowed: false, retryAfterMs } if over
 */
export async function canMakeRequest(): Promise<{
  allowed: boolean;
  retryAfterMs?: number;
  currentSecond?: number;
  currentHour?: number;
  limitSecond?: number;
  limitHour?: number;
}> {
  try {
    const secondKey = getWindowKey("second");
    const hourKey = getWindowKey("hour");

    const [secondSnap, hourSnap] = await Promise.all([
      adminDb.collection(COLLECTION_NAME).doc(secondKey).get(),
      adminDb.collection(COLLECTION_NAME).doc(hourKey).get(),
    ]);

    const secondCount = secondSnap.exists ? (secondSnap.data() as RateLimitDoc).count : 0;
    const hourCount = hourSnap.exists ? (hourSnap.data() as RateLimitDoc).count : 0;

    // Check per-second limit
    if (secondCount >= KROGER_RATE_LIMITS.REQUESTS_PER_SECOND) {
      return {
        allowed: false,
        retryAfterMs: 1000, // Wait 1 second
        currentSecond: secondCount,
        currentHour: hourCount,
        limitSecond: KROGER_RATE_LIMITS.REQUESTS_PER_SECOND,
        limitHour: KROGER_RATE_LIMITS.REQUESTS_PER_HOUR,
      };
    }

    // Check per-hour limit
    if (hourCount >= KROGER_RATE_LIMITS.REQUESTS_PER_HOUR) {
      // Calculate time until next hour window
      const now = Math.floor(Date.now() / 1000);
      const nextHour = (Math.floor(now / 3600) + 1) * 3600;
      const retryAfterMs = (nextHour - now) * 1000;

      return {
        allowed: false,
        retryAfterMs,
        currentSecond: secondCount,
        currentHour: hourCount,
        limitSecond: KROGER_RATE_LIMITS.REQUESTS_PER_SECOND,
        limitHour: KROGER_RATE_LIMITS.REQUESTS_PER_HOUR,
      };
    }

    // Check if approaching limits (warning zone: 80%)
    const approachingSecond = secondCount >= KROGER_RATE_LIMITS.REQUESTS_PER_SECOND * 0.8;
    const approachingHour = hourCount >= KROGER_RATE_LIMITS.REQUESTS_PER_HOUR * 0.8;

    if (approachingSecond || approachingHour) {
      console.warn(
        `⚠️ Rate limit warning: ${secondCount}/${KROGER_RATE_LIMITS.REQUESTS_PER_SECOND}/sec, ${hourCount}/${KROGER_RATE_LIMITS.REQUESTS_PER_HOUR}/hour`
      );
    }

    return {
      allowed: true,
      currentSecond: secondCount,
      currentHour: hourCount,
      limitSecond: KROGER_RATE_LIMITS.REQUESTS_PER_SECOND,
      limitHour: KROGER_RATE_LIMITS.REQUESTS_PER_HOUR,
    };
  } catch (error) {
    // On error, allow the request but log warning
    console.error("Rate limiter check failed:", error);
    return { allowed: true };
  }
}

/**
 * Record a request (post-flight)
 * Increments counters for both second and hour windows
 */
export async function recordRequest(): Promise<void> {
  try {
    const secondKey = getWindowKey("second");
    const hourKey = getWindowKey("hour");
    const now = admin.firestore.Timestamp.now();

    // Use batch write for atomicity
    const batch = adminDb.batch();

    // Increment second counter
    const secondRef = adminDb.collection(COLLECTION_NAME).doc(secondKey);
    batch.set(
      secondRef,
      {
        windowKey: secondKey,
        count: admin.firestore.FieldValue.increment(1),
        expiresAt: getWindowExpiration("second"),
        updatedAt: now,
      },
      { merge: true }
    );

    // Increment hour counter
    const hourRef = adminDb.collection(COLLECTION_NAME).doc(hourKey);
    batch.set(
      hourRef,
      {
        windowKey: hourKey,
        count: admin.firestore.FieldValue.increment(1),
        expiresAt: getWindowExpiration("hour"),
        updatedAt: now,
      },
      { merge: true }
    );

    await batch.commit();
  } catch (error) {
    // Log but don't fail - rate limiting is best-effort
    console.error("Rate limiter record failed:", error);
  }
}

/**
 * Get current rate limit status (for monitoring/debugging)
 */
export async function getRateLimitStatus(): Promise<{
  secondWindow: { key: string; count: number; limit: number; percentUsed: number };
  hourWindow: { key: string; count: number; limit: number; percentUsed: number };
}> {
  const secondKey = getWindowKey("second");
  const hourKey = getWindowKey("hour");

  const [secondSnap, hourSnap] = await Promise.all([
    adminDb.collection(COLLECTION_NAME).doc(secondKey).get(),
    adminDb.collection(COLLECTION_NAME).doc(hourKey).get(),
  ]);

  const secondCount = secondSnap.exists ? (secondSnap.data() as RateLimitDoc).count : 0;
  const hourCount = hourSnap.exists ? (hourSnap.data() as RateLimitDoc).count : 0;

  return {
    secondWindow: {
      key: secondKey,
      count: secondCount,
      limit: KROGER_RATE_LIMITS.REQUESTS_PER_SECOND,
      percentUsed: (secondCount / KROGER_RATE_LIMITS.REQUESTS_PER_SECOND) * 100,
    },
    hourWindow: {
      key: hourKey,
      count: hourCount,
      limit: KROGER_RATE_LIMITS.REQUESTS_PER_HOUR,
      percentUsed: (hourCount / KROGER_RATE_LIMITS.REQUESTS_PER_HOUR) * 100,
    },
  };
}

/**
 * Cleanup expired rate limit documents
 * Called by scheduled function or manually
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  const now = admin.firestore.Timestamp.now();
  let totalDeleted = 0;
  const BATCH_SIZE = 500;

  let hasMore = true;
  while (hasMore) {
    const snap = await adminDb
      .collection(COLLECTION_NAME)
      .where("expiresAt", "<", now)
      .limit(BATCH_SIZE)
      .get();

    if (snap.empty) {
      hasMore = false;
      break;
    }

    const batch = adminDb.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    totalDeleted += snap.size;

    if (snap.size < BATCH_SIZE) {
      hasMore = false;
    }
  }

  if (totalDeleted > 0) {
    console.log(`🗑️ Cleaned up ${totalDeleted} expired rate limit documents`);
  }

  return totalDeleted;
}

/**
 * Wrapper that checks rate limit before executing, and records after
 */
export async function withRateLimit<T>(
  execute: () => Promise<T>
): Promise<T> {
  // Pre-flight check
  const check = await canMakeRequest();

  if (!check.allowed) {
    const error = new Error(
      `Rate limit exceeded. Retry after ${check.retryAfterMs}ms`
    );
    (error as Error & { retryAfterMs?: number }).retryAfterMs = check.retryAfterMs;
    throw error;
  }

  // Execute the request
  const result = await execute();

  // Post-flight record (fire and forget)
  recordRequest().catch((err) =>
    console.error("Failed to record rate limit:", err)
  );

  return result;
}
