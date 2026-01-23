import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, indexedDBLocalPersistence, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Explicitly set persistence for Capacitor WebView compatibility
// Try indexedDB first (most reliable), fall back to localStorage
if (typeof window !== "undefined") {
    setPersistence(auth, indexedDBLocalPersistence).catch(() => {
        // Fallback to browserLocalPersistence if indexedDB fails
        setPersistence(auth, browserLocalPersistence).catch(console.error);
    });
}

export const db = getFirestore(app);
export const functions = getFunctions(app);
export { app };
