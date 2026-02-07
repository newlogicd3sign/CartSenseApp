import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";

export async function POST(request: Request) {
    try {
        const { sessionCookie } = await request.json();

        if (!sessionCookie) {
            return NextResponse.json({ error: "sessionCookie is required" }, { status: 400 });
        }

        // Verify the session cookie (checkRevoked = true)
        const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);

        // Create a custom token for the user to sign in with
        const customToken = await adminAuth.createCustomToken(decodedClaims.uid);

        return NextResponse.json({ customToken });
    } catch (err: any) {
        console.error("Session restore error:", err);
        return NextResponse.json(
            { error: err.message || "Invalid or expired session" },
            { status: 401 }
        );
    }
}
