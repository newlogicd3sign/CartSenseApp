"use client";

import { useState } from "react";
import {
  Bell,
  BellOff,
  ChefHat,
  ShoppingCart,
  Megaphone,
  Send,
  Loader2,
  Smartphone,
} from "lucide-react";
import { usePushNotifications } from "@/lib/hooks/usePushNotifications";
import type { NotificationPreferences } from "@/lib/pushNotifications";

type NotificationSettingsProps = {
  userId: string | null;
  currentPreferences?: NotificationPreferences | null;
  isNativeApp: boolean;
};

export function NotificationSettings({
  userId,
  currentPreferences,
  isNativeApp,
}: NotificationSettingsProps) {
  const {
    isAvailable,
    isEnabled,
    isLoading,
    permissionStatus,
    preferences,
    enableNotifications,
    disableNotifications,
    updatePreferences,
    sendTestNotification,
  } = usePushNotifications({ userId, currentPreferences });

  const [showDetails, setShowDetails] = useState(false);

  // Don't show anything if not on iOS native app
  if (!isNativeApp) {
    return null;
  }

  // Show different UI based on availability
  if (!isAvailable) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 text-gray-400">
          <BellOff className="w-5 h-5" />
          <span className="text-sm">Push notifications not available</span>
        </div>
      </div>
    );
  }

  const handleToggle = async () => {
    if (isEnabled) {
      await disableNotifications();
    } else {
      await enableNotifications();
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isEnabled ? "bg-blue-50" : "bg-gray-100"
              }`}
            >
              {isEnabled ? (
                <Bell className="w-5 h-5 text-blue-500" />
              ) : (
                <BellOff className="w-5 h-5 text-gray-400" />
              )}
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Push Notifications</h3>
              <p className="text-sm text-gray-500">
                {isEnabled
                  ? "Notifications enabled"
                  : permissionStatus === "denied"
                  ? "Blocked in Settings"
                  : "Get meal and shopping reminders"}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggle}
            disabled={isLoading || permissionStatus === "denied"}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              isEnabled ? "bg-blue-500" : "bg-gray-200"
            } ${isLoading ? "opacity-50" : ""} ${
              permissionStatus === "denied" ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <div
              className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                isEnabled ? "left-5" : "left-0.5"
              }`}
            />
            {isLoading && (
              <Loader2 className="absolute top-1 left-3 w-5 h-5 text-gray-400 animate-spin" />
            )}
          </button>
        </div>

        {permissionStatus === "denied" && (
          <p className="mt-3 text-sm text-amber-600 flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            Enable in iOS Settings → CartSense → Notifications
          </p>
        )}
      </div>

      {/* Notification Type Preferences */}
      {isEnabled && (
        <div className="p-6 space-y-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Notification Types
          </h4>

          {/* Meal Reminders */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChefHat className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Meal Reminders
                </p>
                <p className="text-xs text-gray-500">
                  Daily reminder to plan your meals
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                updatePreferences({ mealReminders: !preferences.mealReminders })
              }
              className={`w-10 h-6 rounded-full transition-colors ${
                preferences.mealReminders ? "bg-blue-500" : "bg-gray-200"
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  preferences.mealReminders
                    ? "translate-x-4"
                    : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Shopping List Reminders */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Shopping Reminders
                </p>
                <p className="text-xs text-gray-500">
                  Weekly reminder for your shopping list
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                updatePreferences({
                  shoppingListReminders: !preferences.shoppingListReminders,
                })
              }
              className={`w-10 h-6 rounded-full transition-colors ${
                preferences.shoppingListReminders ? "bg-blue-500" : "bg-gray-200"
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  preferences.shoppingListReminders
                    ? "translate-x-4"
                    : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Promotional Messages */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Megaphone className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Updates & Tips
                </p>
                <p className="text-xs text-gray-500">
                  New features and cooking tips
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                updatePreferences({
                  promotionalMessages: !preferences.promotionalMessages,
                })
              }
              className={`w-10 h-6 rounded-full transition-colors ${
                preferences.promotionalMessages ? "bg-blue-500" : "bg-gray-200"
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  preferences.promotionalMessages
                    ? "translate-x-4"
                    : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Test Notification Button */}
          <div className="pt-4 border-t border-gray-100">
            <button
              onClick={sendTestNotification}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">Send Test Notification</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
