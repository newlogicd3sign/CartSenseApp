// app/(app)/api/kroger/callback/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebaseAdmin";
import { doc, setDoc } from "firebase/firestore";

const TOKEN_URL = process.env.KROGER_TOKEN_URL ?? "https://api-ce.kroger.com/v1/connect/oauth2/token";
const CLIENT_ID = process.env.KROGER_CLIENT_ID!;
const CLIENT_SECRET = process.env.KROGER_CLIENT_SECRET!;
const REDIRECT_URI = process.env.KROGER_REDIRECT_URI!;

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle OAuth errors
    if (error) {
        console.error("Kroger OAuth error:", error);
        return NextResponse.redirect(
            new URL("/account?kroger_error=oauth_denied", request.url)
        );
    }

    if (!code || !state) {
        return NextResponse.redirect(
            new URL("/account?kroger_error=missing_params", request.url)
        );
    }

    // Verify state matches cookie
    const cookieStore = await cookies();
    const savedState = cookieStore.get("kroger_oauth_state")?.value;

    if (!savedState || savedState !== state) {
        console.error("State mismatch", { savedState, state });
        return NextResponse.redirect(
            new URL("/account?kroger_error=state_mismatch", request.url)
        );
    }

    // Decode state to get userId
    let userId: string;
    try {
        const decoded = JSON.parse(
            Buffer.from(state, "base64url").toString("utf-8")
        );
        userId = decoded.userId;
    } catch (err) {
        console.error("Failed to decode state:", err);
        return NextResponse.redirect(
            new URL("/account?kroger_error=invalid_state", request.url)
        );
    }

    // Exchange code for tokens
    try {
        const body = new URLSearchParams();
        body.append("grant_type", "authorization_code");
        body.append("code", code);
        body.append("redirect_uri", REDIRECT_URI);

        const res = await fetch(TOKEN_URL, {
            method: "POST",
            headers: {
                Authorization:
                    "Basic " +
                    Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body,
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("Token exchange failed:", text);
            return NextResponse.redirect(
                new URL("/account?kroger_error=token_exchange_failed", request.url)
            );
        }

        const tokens = await res.json();
        const { access_token, refresh_token, expires_in } = tokens;

        // Store tokens in Firebase
        const expiresAt = Date.now() + expires_in * 1000;

        await setDoc(
            doc(adminDb, "users", userId),
            {
                krogerLinked: true,
                krogerTokens: {
                    accessToken: access_token,
                    refreshToken: refresh_token,
                    expiresAt,
                    updatedAt: Date.now(),
                },
            },
            { merge: true }
        );

        // Clear the state cookie
        cookieStore.delete("kroger_oauth_state");

        return NextResponse.redirect(
            new URL("/account?kroger_linked=success", request.url)
        );
    } catch (err) {
        console.error("Error during token exchange:", err);
        return NextResponse.redirect(
            new URL("/account?kroger_error=server_error", request.url)
        );
    }
}