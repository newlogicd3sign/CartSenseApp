/**
 * Cloud Functions for push notifications.
 * Handles notification queue processing and scheduled reminders.
 */

import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";

const db = admin.firestore();
const messaging = admin.messaging();

type NotificationQueueItem = {
  userId: string;
  type: "meal_reminder" | "shopping_reminder" | "promotional";
  title: string;
  body: string;
  data: { route: string };
  scheduledFor: admin.firestore.Timestamp;
  status: "pending" | "sent" | "failed";
  error?: string;
};

type PushNotificationSettings = {
  enabled: boolean;
  fcmToken: string | null;
  platform: "ios";
  preferences: {
    mealReminders: boolean;
    shoppingListReminders: boolean;
    promotionalMessages: boolean;
  };
};

/**
 * Process notification queue every 5 minutes.
 * Sends pending notifications that are scheduled for now or earlier.
 */
export const processNotificationQueue = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "America/New_York",
  },
  async () => {
    const now = admin.firestore.Timestamp.now();

    try {
      // Get pending notifications that are ready to send
      const snapshot = await db
        .collection("notificationQueue")
        .where("status", "==", "pending")
        .where("scheduledFor", "<=", now)
        .limit(100)
        .get();

      if (snapshot.empty) {
        console.log("No pending notifications to process");
        return;
      }

      console.log(`Processing ${snapshot.size} notifications`);

      const batch = db.batch();
      const sendPromises: Promise<void>[] = [];

      for (const doc of snapshot.docs) {
        const notification = doc.data() as NotificationQueueItem;

        sendPromises.push(
          sendNotificationToUser(notification)
            .then((success) => {
              batch.update(doc.ref, {
                status: success ? "sent" : "failed",
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            })
            .catch((error) => {
              batch.update(doc.ref, {
                status: "failed",
                error: error.message,
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            })
        );
      }

      await Promise.all(sendPromises);
      await batch.commit();

      console.log("Notification queue processed successfully");
    } catch (error) {
      console.error("Error processing notification queue:", error);
      throw error;
    }
  }
);

/**
 * Create meal reminders daily at 5 PM local time.
 * Sends to users who have meal reminders enabled.
 */
export const createMealReminders = onSchedule(
  {
    schedule: "0 17 * * *", // 5 PM every day
    timeZone: "America/New_York",
  },
  async () => {
    try {
      // Get users with meal reminders enabled
      const usersSnapshot = await db
        .collection("users")
        .where("pushNotifications.enabled", "==", true)
        .where("pushNotifications.preferences.mealReminders", "==", true)
        .get();

      if (usersSnapshot.empty) {
        console.log("No users with meal reminders enabled");
        return;
      }

      console.log(`Creating meal reminders for ${usersSnapshot.size} users`);

      const batch = db.batch();
      const now = admin.firestore.Timestamp.now();

      for (const userDoc of usersSnapshot.docs) {
        const notificationRef = db.collection("notificationQueue").doc();

        batch.set(notificationRef, {
          userId: userDoc.id,
          type: "meal_reminder",
          title: "Time to plan your meals!",
          body: "What's for dinner? Generate new meal ideas with CartSense.",
          data: { route: "/prompt" },
          scheduledFor: now,
          status: "pending",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();
      console.log("Meal reminders created successfully");
    } catch (error) {
      console.error("Error creating meal reminders:", error);
      throw error;
    }
  }
);

/**
 * Create shopping list reminders on Saturday at 9 AM.
 * Sends to users who have shopping list reminders enabled and have unchecked items.
 */
export const createShoppingReminders = onSchedule(
  {
    schedule: "0 9 * * 6", // 9 AM on Saturdays
    timeZone: "America/New_York",
  },
  async () => {
    try {
      // Get users with shopping reminders enabled
      const usersSnapshot = await db
        .collection("users")
        .where("pushNotifications.enabled", "==", true)
        .where("pushNotifications.preferences.shoppingListReminders", "==", true)
        .get();

      if (usersSnapshot.empty) {
        console.log("No users with shopping reminders enabled");
        return;
      }

      console.log(`Checking shopping lists for ${usersSnapshot.size} users`);

      const batch = db.batch();
      const now = admin.firestore.Timestamp.now();
      let remindersCreated = 0;

      for (const userDoc of usersSnapshot.docs) {
        // Check if user has unchecked items
        const itemsSnapshot = await db
          .collection("shoppingLists")
          .doc(userDoc.id)
          .collection("items")
          .where("checked", "==", false)
          .limit(1)
          .get();

        if (!itemsSnapshot.empty) {
          const notificationRef = db.collection("notificationQueue").doc();

          batch.set(notificationRef, {
            userId: userDoc.id,
            type: "shopping_reminder",
            title: "Don't forget your shopping list!",
            body: "You have items waiting to be picked up.",
            data: { route: "/shopping-list" },
            scheduledFor: now,
            status: "pending",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          remindersCreated++;
        }
      }

      if (remindersCreated > 0) {
        await batch.commit();
      }

      console.log(`Created ${remindersCreated} shopping reminders`);
    } catch (error) {
      console.error("Error creating shopping reminders:", error);
      throw error;
    }
  }
);

/**
 * Send a test notification to a specific user.
 * Callable function for testing from the app.
 */
export const sendTestNotification = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    const { userId } = request.data;

    if (!userId) {
      throw new HttpsError("invalid-argument", "userId is required");
    }

    try {
      // Get user's FCM token
      const userDoc = await db.collection("users").doc(userId).get();

      if (!userDoc.exists) {
        throw new HttpsError("not-found", "User not found");
      }

      const userData = userDoc.data();
      const pushSettings = userData?.pushNotifications as PushNotificationSettings | undefined;

      if (!pushSettings?.enabled || !pushSettings?.fcmToken) {
        throw new HttpsError(
          "failed-precondition",
          "Push notifications not enabled for this user"
        );
      }

      // Send test notification directly
      await messaging.send({
        token: pushSettings.fcmToken,
        notification: {
          title: "Test Notification",
          body: "If you see this, push notifications are working!",
        },
        data: {
          route: "/account",
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
      });

      return { success: true, message: "Test notification sent" };
    } catch (error) {
      console.error("Error sending test notification:", error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Failed to send notification"
      );
    }
  }
);

/**
 * Helper function to send a notification to a user.
 */
async function sendNotificationToUser(
  notification: NotificationQueueItem
): Promise<boolean> {
  const { userId, type, title, body, data } = notification;

  // Get user's FCM token
  const userDoc = await db.collection("users").doc(userId).get();

  if (!userDoc.exists) {
    console.warn(`User ${userId} not found`);
    return false;
  }

  const userData = userDoc.data();
  const pushSettings = userData?.pushNotifications as PushNotificationSettings | undefined;

  if (!pushSettings?.enabled || !pushSettings?.fcmToken) {
    console.warn(`Push notifications not enabled for user ${userId}`);
    return false;
  }

  // Check if user wants this type of notification
  const prefs = pushSettings.preferences;
  const wantsNotification =
    (type === "meal_reminder" && prefs?.mealReminders) ||
    (type === "shopping_reminder" && prefs?.shoppingListReminders) ||
    (type === "promotional" && prefs?.promotionalMessages);

  if (!wantsNotification) {
    console.log(`User ${userId} has disabled ${type} notifications`);
    return true; // Mark as sent to avoid retrying
  }

  try {
    await messaging.send({
      token: pushSettings.fcmToken,
      notification: {
        title,
        body,
      },
      data: {
        route: data.route,
        type,
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    });

    console.log(`Notification sent to user ${userId}`);
    return true;
  } catch (error: any) {
    // Handle invalid token
    if (
      error.code === "messaging/invalid-registration-token" ||
      error.code === "messaging/registration-token-not-registered"
    ) {
      // Remove invalid token
      await db.collection("users").doc(userId).update({
        "pushNotifications.enabled": false,
        "pushNotifications.fcmToken": null,
      });
      console.log(`Removed invalid token for user ${userId}`);
    }

    throw error;
  }
}
