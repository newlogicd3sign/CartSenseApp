// lib/firebaseAdmin.ts
import "server-only";
import admin from "firebase-admin";

if (!admin.apps.length) {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    // Handle private key - support both direct and Base64-encoded formats
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const privateKeyBase64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;

    if (privateKeyBase64) {
        // Decode Base64-encoded key (avoids Vercel escaping issues)
        privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');
    }

    if (privateKey) {
        // Replace literal \n strings with actual newlines
        privateKey = privateKey.split(String.raw`\n`).join('\n');
        // Remove surrounding quotes if present
        privateKey = privateKey.replace(/^["']|["']$/g, '');
    }

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
