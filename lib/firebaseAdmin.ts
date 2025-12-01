// lib/firebaseAdmin.ts
import "server-only";
import admin from "firebase-admin";

if (!admin.apps.length) {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").replace(/\n/g, "\n");

    if (clientEmail && privateKey && projectId) {
        // Use explicit service account credentials if provided
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
    } else if (projectId) {
        // Fallback to Application Default Credentials
        // Run: gcloud auth application-default login
        admin.initializeApp({
            projectId,
        });
    } else {
        throw new Error(
            "Missing Firebase credentials. Either set FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY, or run: gcloud auth application-default login"
        );
    }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
