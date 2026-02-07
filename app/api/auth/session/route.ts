import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
    try {
        const { idToken } = await request.json();

        if (!idToken) {
            return NextResponse.json({ error: "idToken is required" }, { status: 400 });
        }

        // Verify the ID token
        await adminAuth.verifyIdToken(idToken);

        // Create a 14-day session cookie
        const sessionCookie = await adminAuth.createSessionCookie(idToken, {
            expiresIn: FOURTEEN_DAYS_MS,
        });

        return NextResponse.json({ sessionCookie });
    } catch (err: any) {
        console.error("Session creation error:", err);
        return NextResponse.json(
            { error: err.message || "Failed to create session" },
            { status: 401 }
        );
    }
}
