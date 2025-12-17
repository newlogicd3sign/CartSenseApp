// lib/product-engine/krogerWarm.ts
// Client-side helper to trigger on-demand cache warming for Kroger locations

import { httpsCallable } from "firebase/functions";
import { functions } from "../firebaseClient";

interface WarmLocationResult {
    success: boolean;
    skipped: boolean;
    reason?: string;
    locationId: string;
    cached?: number;
    errors?: number;
}

/**
 * Trigger background cache warming for a Kroger location.
 * Fire-and-forget - doesn't block the UI.
 *
 * Call this when:
 * - User selects a new store location
 * - User adds a new store
 * - User switches their default store
 *
 * @param locationId - The Kroger location ID to warm
 */
export async function warmLocationInBackground(locationId: string): Promise<void> {
    try {
        const warmLocation = httpsCallable<{ locationId: string }, WarmLocationResult>(
            functions,
            "warmLocationOnDemand"
        );

        // Fire and forget - don't await the full result
        warmLocation({ locationId })
            .then((result) => {
                if (result.data.skipped) {
                    console.log(`Cache warming skipped: ${result.data.reason}`);
                } else {
                    console.log(`Cache warming complete: ${result.data.cached} items cached`);
                }
            })
            .catch((err) => {
                // Non-critical - cache will populate naturally on first use
                console.warn("Background cache warming failed:", err);
            });
    } catch (err) {
        // Non-critical failure
        console.warn("Failed to trigger cache warming:", err);
    }
}

/**
 * Warm location and wait for completion (blocking).
 * Use this if you want to ensure cache is ready before proceeding.
 *
 * @param locationId - The Kroger location ID to warm
 * @returns Promise with warming result
 */
export async function warmLocationAndWait(locationId: string): Promise<WarmLocationResult> {
    const warmLocation = httpsCallable<{ locationId: string }, WarmLocationResult>(
        functions,
        "warmLocationOnDemand"
    );

    const result = await warmLocation({ locationId });
    return result.data;
}
