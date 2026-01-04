import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";

export async function POST(request: Request) {
    try {
        const { code } = await request.json();

        if (!code) {
            return NextResponse.json({ error: "Verification code is required" }, { status: 400 });
        }

        // Verify the action code and get the email
        const info = await adminAuth.verifyIdToken(code).catch(() => null);

        // Use the action code to get user info
        // Firebase Admin doesn't have applyActionCode, so we need to verify differently
        // We'll check the code by attempting to get the user info from Firebase's REST API

        const response = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ oobCode: code }),
            }
        );

        const data = await response.json();

        if (data.error) {
            console.error("Firebase verification error:", data.error);
            return NextResponse.json({
                error: data.error.message || "Invalid or expired verification code"
            }, { status: 400 });
        }

        // The code was valid - data.email contains the verified email
        const email = data.email;

        if (email) {
            // Get user by email and update emailVerified via Admin SDK
            try {
                const user = await adminAuth.getUserByEmail(email);
                await adminAuth.updateUser(user.uid, { emailVerified: true });
                console.log(`Email verified for user: ${email} (${user.uid})`);
            } catch (adminError) {
                console.error("Admin SDK update error:", adminError);
                // Don't fail - the Firebase REST API already verified the email
            }
        }

        return NextResponse.json({
            success: true,
            email: data.email,
            message: "Email verified successfully"
        });

    } catch (err: any) {
        console.error("Verification error:", err);
        return NextResponse.json({
            error: err.message || "Verification failed",
        }, { status: 500 });
    }
}
