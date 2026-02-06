// functions/src/index.ts
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export all functions
export {
    cleanupExpiredKrogerCache,
    cleanupExpiredMealImageCache,
    cleanupExpiredRateLimits,
    manualCacheCleanup,
} from "./cleanupKrogerCache";

export {
    warmKrogerCache,
    manualCacheWarm,
    warmLocationOnDemand,
} from "./warmKrogerCache";

export {
    processNotificationQueue,
    createMealReminders,
    createShoppingReminders,
    sendTestNotification,
} from "./sendNotifications";
