// functions/src/index.ts
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export all functions
export {
    cleanupExpiredKrogerCache,
    cleanupExpiredMealImageCache,
    manualCacheCleanup,
} from "./cleanupKrogerCache";
