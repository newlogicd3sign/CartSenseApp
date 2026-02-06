"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  initializePushNotifications,
  saveTokenToFirestore,
  disablePushNotifications,
  updateNotificationPreferences,
  setupNotificationTapHandler,
  setupForegroundNotificationHandler,
  getNotificationPermissionStatus,
  isPushNotificationsAvailable,
  type NotificationPreferences,
} from "@/lib/pushNotifications";
import { useToast } from "@/components/Toast";

type UsePushNotificationsOptions = {
  userId: string | null;
  currentPreferences?: NotificationPreferences | null;
};

type UsePushNotificationsResult = {
  isAvailable: boolean;
  isEnabled: boolean;
  isLoading: boolean;
  permissionStatus: "granted" | "denied" | "prompt" | "unknown";
  preferences: NotificationPreferences;
  enableNotifications: () => Promise<boolean>;
  disableNotifications: () => Promise<void>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  sendTestNotification: () => Promise<void>;
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  mealReminders: true,
  shoppingListReminders: true,
  promotionalMessages: false,
};

export function usePushNotifications(
  options: UsePushNotificationsOptions
): UsePushNotificationsResult {
  const { userId, currentPreferences } = options;
  const router = useRouter();
  const { showToast } = useToast();

  const [isAvailable] = useState(isPushNotificationsAvailable());
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<
    "granted" | "denied" | "prompt" | "unknown"
  >("unknown");
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    currentPreferences || DEFAULT_PREFERENCES
  );

  // Check permission status on mount
  useEffect(() => {
    if (!isAvailable) return;

    const checkStatus = async () => {
      const status = await getNotificationPermissionStatus();
      setPermissionStatus(status);
      setIsEnabled(status === "granted" && Boolean(currentPreferences));
    };

    void checkStatus();
  }, [isAvailable, currentPreferences]);

  // Update preferences when they change from props
  useEffect(() => {
    if (currentPreferences) {
      setPreferences(currentPreferences);
    }
  }, [currentPreferences]);

  // Set up notification tap handler
  useEffect(() => {
    if (!isAvailable) return;

    const cleanup = setupNotificationTapHandler((route: string) => {
      router.push(route);
    });

    return cleanup;
  }, [isAvailable, router]);

  // Set up foreground notification handler
  useEffect(() => {
    if (!isAvailable) return;

    const cleanup = setupForegroundNotificationHandler((title, body) => {
      // Show toast for foreground notifications
      showToast(body || title, "info");
    });

    return cleanup;
  }, [isAvailable, showToast]);

  // Enable notifications
  const enableNotifications = useCallback(async (): Promise<boolean> => {
    if (!userId || !isAvailable) return false;

    setIsLoading(true);

    try {
      const result = await initializePushNotifications();

      if (!result.success || !result.token) {
        showToast(result.error || "Failed to enable notifications", "error");
        return false;
      }

      await saveTokenToFirestore(userId, result.token, preferences);
      setIsEnabled(true);
      setPermissionStatus("granted");
      showToast("Notifications enabled!", "success");
      return true;
    } catch (err) {
      console.error("Error enabling notifications:", err);
      showToast("Failed to enable notifications", "error");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [userId, isAvailable, preferences, showToast]);

  // Disable notifications
  const disableNotifications = useCallback(async (): Promise<void> => {
    if (!userId) return;

    setIsLoading(true);

    try {
      await disablePushNotifications(userId);
      setIsEnabled(false);
      showToast("Notifications disabled", "success");
    } catch (err) {
      console.error("Error disabling notifications:", err);
      showToast("Failed to disable notifications", "error");
    } finally {
      setIsLoading(false);
    }
  }, [userId, showToast]);

  // Update preferences
  const updatePrefs = useCallback(
    async (newPrefs: Partial<NotificationPreferences>): Promise<void> => {
      if (!userId) return;

      const updated = { ...preferences, ...newPrefs };
      setPreferences(updated);

      try {
        await updateNotificationPreferences(userId, newPrefs);
      } catch (err) {
        console.error("Error updating preferences:", err);
        // Revert on error
        setPreferences(preferences);
        showToast("Failed to update preferences", "error");
      }
    },
    [userId, preferences, showToast]
  );

  // Send test notification
  const sendTestNotification = useCallback(async (): Promise<void> => {
    if (!userId) return;

    setIsLoading(true);

    try {
      const res = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send test notification");
      }

      showToast("Test notification sent!", "success");
    } catch (err) {
      console.error("Error sending test notification:", err);
      showToast(
        err instanceof Error ? err.message : "Failed to send test notification",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  }, [userId, showToast]);

  return {
    isAvailable,
    isEnabled,
    isLoading,
    permissionStatus,
    preferences,
    enableNotifications,
    disableNotifications,
    updatePreferences: updatePrefs,
    sendTestNotification,
  };
}
