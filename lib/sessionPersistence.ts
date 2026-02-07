import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";

const SESSION_KEY = "firebase_session_cookie";

function isNative(): boolean {
    return Capacitor.isNativePlatform();
}

/** Store session cookie using native Preferences or localStorage. */
async function storeValue(key: string, value: string): Promise<void> {
    if (isNative()) {
        await Preferences.set({ key, value });
    } else {
        localStorage.setItem(key, value);
    }
}

/** Read session cookie from native Preferences or localStorage. */
async function getValue(key: string): Promise<string | null> {
    if (isNative()) {
        const { value } = await Preferences.get({ key });
        return value;
    }
    return localStorage.getItem(key);
}

/** Remove session cookie from native Preferences or localStorage. */
async function removeValue(key: string): Promise<void> {
    if (isNative()) {
        await Preferences.remove({ key });
    } else {
        localStorage.removeItem(key);
    }
}

/**
 * After login/signup, create a server-side session cookie and store it
 * in Capacitor Preferences (native) or localStorage (web/PWA).
 */
export async function createAndStoreSession(idToken: string): Promise<void> {
    try {
        const res = await fetch("/api/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
        });

        if (!res.ok) return;

        const { sessionCookie } = await res.json();
        await storeValue(SESSION_KEY, sessionCookie);
    } catch (e) {
        console.error("Failed to create/store session:", e);
    }
}

/**
 * On app startup when Firebase has lost its session, read the stored
 * session cookie and use it to restore Firebase Auth.
 * Returns true if session was restored, false otherwise.
 */
export async function restoreSession(): Promise<boolean> {
    try {
        const sessionCookie = await getValue(SESSION_KEY);
        if (!sessionCookie) return false;

        const res = await fetch("/api/auth/restore-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionCookie }),
        });

        if (!res.ok) {
            // Session is invalid/expired — clear it
            await removeValue(SESSION_KEY);
            return false;
        }

        const { customToken } = await res.json();
        await signInWithCustomToken(auth, customToken);
        return true;
    } catch (e) {
        console.error("Failed to restore session:", e);
        return false;
    }
}

/**
 * Remove the stored session cookie (called on logout/delete account).
 */
export async function clearStoredSession(): Promise<void> {
    try {
        await removeValue(SESSION_KEY);
    } catch (e) {
        console.error("Failed to clear stored session:", e);
    }
}
