/**
 * API endpoint to trigger a test notification.
 * POST /api/notifications/test
 */

import { NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// Initialize Firebase Admin
if (!getApps().length) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  };

  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();
const messaging = getMessaging();

type PushNotificationSettings = {
  enabled: boolean;
  fcmToken: string | null;
  platform: "ios";
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Get user's FCM token
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data();
    const pushSettings = userData?.pushNotifications as PushNotificationSettings | undefined;

    if (!pushSettings?.enabled || !pushSettings?.fcmToken) {
      return NextResponse.json(
        { error: "Push notifications not enabled for this user" },
        { status: 400 }
      );
    }

    // Send test notification
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

    return NextResponse.json({
      success: true,
      message: "Test notification sent",
    });
  } catch (error) {
    console.error("Error sending test notification:", error);

    // Handle invalid token
    if (error instanceof Error) {
      const errorCode = (error as any).code;
      if (
        errorCode === "messaging/invalid-registration-token" ||
        errorCode === "messaging/registration-token-not-registered"
      ) {
        return NextResponse.json(
          { error: "Invalid device token. Please re-enable notifications." },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send notification" },
      { status: 500 }
    );
  }
}
