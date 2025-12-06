// functions/src/cleanupKrogerCache.ts
import { onSchedule, ScheduledEvent } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const db = admin.firestore();

const BATCH_SIZE = 500;

/**
 * Scheduled function to clean up expired Kroger product cache entries.
 * Runs every 24 hours to delete cache documents where expiresAt < now.
 */
export const cleanupExpiredKrogerCache = onSchedule(
    { schedule: "every 24 hours", timeZone: "America/New_York" },
    async (_event: ScheduledEvent) => {
        const now = admin.firestore.Timestamp.now();
        let totalDeleted = 0;
        let hasMore = true;

        console.log(`Starting Kroger cache cleanup at ${now.toDate().toISOString()}`);

        // Loop to handle more than BATCH_SIZE expired docs
        while (hasMore) {
            const snap = await db
                .collection("krogerProductSearchCache")
                .where("expiresAt", "<", now)
                .limit(BATCH_SIZE)
                .get();

            if (snap.empty) {
                hasMore = false;
                break;
            }

            const batch = db.batch();
            snap.docs.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();

            totalDeleted += snap.size;
            console.log(`Deleted batch of ${snap.size} expired cache docs`);

            // If we got fewer than BATCH_SIZE, we're done
            if (snap.size < BATCH_SIZE) {
                hasMore = false;
            }
        }

        if (totalDeleted > 0) {
            console.log(`Cleanup complete: deleted ${totalDeleted} expired cache docs`);
        } else {
            console.log("Cleanup complete: no expired cache docs to delete");
        }
    });

/**
 * Scheduled function to clean up expired meal image cache entries.
 * Runs every 24 hours to delete cache documents older than 30 days.
 */
export const cleanupExpiredMealImageCache = onSchedule(
    { schedule: "every 24 hours", timeZone: "America/New_York" },
    async (_event: ScheduledEvent) => {
        const now = admin.firestore.Timestamp.now();
        const thirtyDaysAgo = admin.firestore.Timestamp.fromMillis(
            now.toMillis() - 30 * 24 * 60 * 60 * 1000
        );

        let totalDeleted = 0;
        let hasMore = true;

        console.log(`Starting meal image cache cleanup at ${now.toDate().toISOString()}`);

        while (hasMore) {
            const snap = await db
                .collection("mealImageCache")
                .where("createdAt", "<", thirtyDaysAgo)
                .limit(BATCH_SIZE)
                .get();

            if (snap.empty) {
                hasMore = false;
                break;
            }

            const batch = db.batch();
            snap.docs.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();

            totalDeleted += snap.size;
            console.log(`Deleted batch of ${snap.size} expired meal image cache docs`);

            if (snap.size < BATCH_SIZE) {
                hasMore = false;
            }
        }

        if (totalDeleted > 0) {
            console.log(`Cleanup complete: deleted ${totalDeleted} expired meal image cache docs`);
        } else {
            console.log("Cleanup complete: no expired meal image cache docs to delete");
        }
    });

/**
 * HTTP-callable function to manually trigger cache cleanup.
 * Useful for testing or manual maintenance.
 */
export const manualCacheCleanup = onRequest(async (req, res) => {
    // Simple auth check - require a secret header
    const authHeader = req.headers["x-cleanup-secret"];
    const expectedSecret = process.env.CLEANUP_SECRET || "your-secret-here";

    if (authHeader !== expectedSecret) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const now = admin.firestore.Timestamp.now();
    const results = {
        krogerCache: 0,
        mealImageCache: 0,
    };

    // Cleanup Kroger cache
    let hasMore = true;
    while (hasMore) {
        const snap = await db
            .collection("krogerProductSearchCache")
            .where("expiresAt", "<", now)
            .limit(BATCH_SIZE)
            .get();

        if (snap.empty) {
            hasMore = false;
            break;
        }

        const batch = db.batch();
        snap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        results.krogerCache += snap.size;

        if (snap.size < BATCH_SIZE) hasMore = false;
    }

    // Cleanup meal image cache
    const thirtyDaysAgo = admin.firestore.Timestamp.fromMillis(
        now.toMillis() - 30 * 24 * 60 * 60 * 1000
    );
    hasMore = true;
    while (hasMore) {
        const snap = await db
            .collection("mealImageCache")
            .where("createdAt", "<", thirtyDaysAgo)
            .limit(BATCH_SIZE)
            .get();

        if (snap.empty) {
            hasMore = false;
            break;
        }

        const batch = db.batch();
        snap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        results.mealImageCache += snap.size;

        if (snap.size < BATCH_SIZE) hasMore = false;
    }

    res.json({
        success: true,
        deleted: results,
        timestamp: now.toDate().toISOString(),
    });
});
