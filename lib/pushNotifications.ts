/**
 * Push notification service for iOS.
 * Handles registration, token management, and notification tap handling.
 * Uses @capacitor-firebase/messaging for proper FCM token handling.
 */

import { Capacitor } from "@capacitor/core";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

export type NotificationPreferences = {
  mealReminders: boolean;
  shoppingListReminders: boolean;
  promotionalMessages: boolean;
};

export type PushNotificationData = {
  enabled: boolean;
  fcmToken: string | null;
  platform: "ios";
  tokenUpdatedAt: any;
  preferences: NotificationPreferences;
};

// Check if push notifications are available
export function isPushNotificationsAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

// Initialize push notifications
export async function initializePushNotifications(): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  if (!isPushNotificationsAvailable()) {
    return { success: false, error: "Push notifications not available on this platform" };
  }

  try {
    // Check current permission status
    const permStatus = await FirebaseMessaging.checkPermissions();

    if (permStatus.receive === "prompt") {
      // Request permission
      const result = await FirebaseMessaging.requestPermissions();
      if (result.receive !== "granted") {
        return { success: false, error: "Permission denied" };
      }
    } else if (permStatus.receive !== "granted") {
      return { success: false, error: "Permission not granted" };
    }

    // Get the FCM token directly (handles APNs registration internally)
    const { token } = await FirebaseMessaging.getToken();

    return { success: true, token };
  } catch (err) {
    console.error("Error initializing push notifications:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// Save token to Firestore
export async function saveTokenToFirestore(
  userId: string,
  token: string,
  preferences?: Partial<NotificationPreferences>
): Promise<void> {
  const userRef = doc(db, "users", userId);

  const data: PushNotificationData = {
    enabled: true,
    fcmToken: token,
    platform: "ios",
    tokenUpdatedAt: serverTimestamp(),
    preferences: {
      mealReminders: preferences?.mealReminders ?? true,
      shoppingListReminders: preferences?.shoppingListReminders ?? true,
      promotionalMessages: preferences?.promotionalMessages ?? false,
    },
  };

  await updateDoc(userRef, {
    pushNotifications: data,
  });
}

// Update notification preferences
export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<NotificationPreferences>
): Promise<void> {
  const userRef = doc(db, "users", userId);

  const updates: Record<string, any> = {};
  if (preferences.mealReminders !== undefined) {
    updates["pushNotifications.preferences.mealReminders"] = preferences.mealReminders;
  }
  if (preferences.shoppingListReminders !== undefined) {
    updates["pushNotifications.preferences.shoppingListReminders"] = preferences.shoppingListReminders;
  }
  if (preferences.promotionalMessages !== undefined) {
    updates["pushNotifications.preferences.promotionalMessages"] = preferences.promotionalMessages;
  }

  await updateDoc(userRef, updates);
}

// Disable push notifications
export async function disablePushNotifications(userId: string): Promise<void> {
  const userRef = doc(db, "users", userId);

  await updateDoc(userRef, {
    "pushNotifications.enabled": false,
  });
}

// Set up notification tap handler
export function setupNotificationTapHandler(
  onTap: (route: string) => void
): () => void {
  if (!isPushNotificationsAvailable()) {
    return () => {};
  }

  const listener = FirebaseMessaging.addListener(
    "notificationActionPerformed",
    (event) => {
      const data = event.notification?.data as Record<string, string> | undefined;
      if (data?.route) {
        onTap(data.route);
      }
    }
  );

  // Return cleanup function
  return () => {
    listener.then((h) => h.remove());
  };
}

// Set up foreground notification handler
export function setupForegroundNotificationHandler(
  onReceived: (title: string, body: string) => void
): () => void {
  if (!isPushNotificationsAvailable()) {
    return () => {};
  }

  const listener = FirebaseMessaging.addListener(
    "notificationReceived",
    (event) => {
      onReceived(event.notification?.title || "", event.notification?.body || "");
    }
  );

  // Return cleanup function
  return () => {
    listener.then((h) => h.remove());
  };
}

// Get current notification permission status
export async function getNotificationPermissionStatus(): Promise<
  "granted" | "denied" | "prompt" | "unknown"
> {
  if (!isPushNotificationsAvailable()) {
    return "unknown";
  }

  try {
    const result = await FirebaseMessaging.checkPermissions();
    return result.receive as "granted" | "denied" | "prompt";
  } catch (err) {
    console.error("Error checking notification permissions:", err);
    return "unknown";
  }
}

// Remove all delivered notifications
export async function removeAllDeliveredNotifications(): Promise<void> {
  if (!isPushNotificationsAvailable()) {
    return;
  }

  try {
    await FirebaseMessaging.removeAllDeliveredNotifications();
  } catch (err) {
    console.error("Error removing notifications:", err);
  }
}

// Get list of delivered notifications
export async function getDeliveredNotifications(): Promise<any[]> {
  if (!isPushNotificationsAvailable()) {
    return [];
  }

  try {
    const result = await FirebaseMessaging.getDeliveredNotifications();
    return result.notifications;
  } catch (err) {
    console.error("Error getting delivered notifications:", err);
    return [];
  }
}

// Delete the FCM token (useful for logout)
export async function deleteToken(): Promise<void> {
  if (!isPushNotificationsAvailable()) {
    return;
  }

  try {
    await FirebaseMessaging.deleteToken();
  } catch (err) {
    console.error("Error deleting FCM token:", err);
  }
}
