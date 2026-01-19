// lib/krogerMetrics.ts
import "server-only";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

const METRICS_COLLECTION = "krogerMetrics";
const COUNTERS_DOC = "counters";

export type KrogerMetric =
    | "totalAddToKrogerClicks"
    | "totalItemsAddedToCart"
    | "totalGoToKrogerClicks"
    | "uniqueUsersAddedToCart"
    | "uniqueUsersClickedGoToKroger";

export type UniqueAction = "addedToCart" | "clickedGoToKroger";

/**
 * Increment a Kroger metric counter atomically
 */
export async function incrementKrogerMetric(
    metric: KrogerMetric,
    amount: number = 1
): Promise<void> {
    const countersRef = adminDb.collection(METRICS_COLLECTION).doc(COUNTERS_DOC);

    try {
        await countersRef.set(
            {
                [metric]: FieldValue.increment(amount),
                lastUpdated: FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
    } catch (err) {
        console.error(`[KROGER_METRICS] Error incrementing ${metric}:`, err);
        // Don't throw - metrics should not break the main flow
    }
}

/**
 * Track a unique user action and increment the unique counter only on first action
 * Returns true if this was the user's first time performing this action
 */
export async function trackUniqueKrogerUser(
    uid: string,
    action: UniqueAction
): Promise<boolean> {
    const userRef = adminDb.collection("users").doc(uid);
    const countersRef = adminDb.collection(METRICS_COLLECTION).doc(COUNTERS_DOC);

    // Map action to user flag and counter name
    const flagName = action === "addedToCart"
        ? "hasAddedToKrogerCart"
        : "hasClickedGoToKroger";
    const counterName: KrogerMetric = action === "addedToCart"
        ? "uniqueUsersAddedToCart"
        : "uniqueUsersClickedGoToKroger";

    try {
        // Use a transaction to ensure atomicity
        const isFirstTime = await adminDb.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            const userData = userDoc.data();

            // Check if user has already performed this action
            if (userData?.[flagName] === true) {
                return false; // Already counted
            }

            // First time - set the flag and increment the unique counter
            transaction.update(userRef, {
                [flagName]: true,
            });

            // Increment the unique counter (use set with merge for counters doc)
            transaction.set(
                countersRef,
                {
                    [counterName]: FieldValue.increment(1),
                    lastUpdated: FieldValue.serverTimestamp(),
                },
                { merge: true }
            );

            return true;
        });

        if (isFirstTime) {
            console.log(`[KROGER_METRICS] New unique user for ${action}: ${uid}`);
        }

        return isFirstTime;
    } catch (err) {
        console.error(`[KROGER_METRICS] Error tracking unique user ${uid} for ${action}:`, err);
        // Don't throw - metrics should not break the main flow
        return false;
    }
}

/**
 * Get all Kroger metrics (for admin dashboard/reporting)
 */
export async function getKrogerMetrics(): Promise<{
    totalAddToKrogerClicks: number;
    totalItemsAddedToCart: number;
    totalGoToKrogerClicks: number;
    uniqueUsersAddedToCart: number;
    uniqueUsersClickedGoToKroger: number;
    lastUpdated: Date | null;
}> {
    const countersRef = adminDb.collection(METRICS_COLLECTION).doc(COUNTERS_DOC);
    const doc = await countersRef.get();
    const data = doc.data();

    return {
        totalAddToKrogerClicks: data?.totalAddToKrogerClicks || 0,
        totalItemsAddedToCart: data?.totalItemsAddedToCart || 0,
        totalGoToKrogerClicks: data?.totalGoToKrogerClicks || 0,
        uniqueUsersAddedToCart: data?.uniqueUsersAddedToCart || 0,
        uniqueUsersClickedGoToKroger: data?.uniqueUsersClickedGoToKroger || 0,
        lastUpdated: data?.lastUpdated?.toDate() || null,
    };
}
