// lib/firebaseAdmin.ts
import "server-only";
import { initializeFirestore } from "firebase/firestore";
import { initializeApp, getApps, getApp } from "firebase/app";

// Use the same Firebase config as the client
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase app for server-side use
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Export Firestore instance
export const adminDb = initializeFirestore(app, {});