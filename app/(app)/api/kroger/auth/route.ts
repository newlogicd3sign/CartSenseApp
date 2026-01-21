// app/(app)/api/kroger/auth/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const KROGER_AUTH_URL =
    process.env.KROGER_AUTH_URL ??
    "https://api-ce.kroger.com/v1/connect/oauth2/authorize";

const CLIENT_ID = process.env.KROGER_CLIENT_ID;
const REDIRECT_URI = process.env.KROGER_REDIRECT_URI;

// Scopes for linking + cart (CE app has profile + cart access)
const SCOPES =
    process.env.KROGER_SCOPE ?? "profile.compact cart.basic:write";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");
        const returnTo = searchParams.get("returnTo"); // Optional: "setup" or "account"
        const step = searchParams.get("step"); // Optional: step number for setup wizard
        const mobile = searchParams.get("mobile"); // Optional: "true" for mobile app OAuth

        if (!userId) {
            return NextResponse.json(
                {
                    error: "USER_ID_REQUIRED",
                    message: "User ID is required.",
                },
                { status: 400 }
            );
        }

        if (!CLIENT_ID || !REDIRECT_URI) {
            console.error("[KROGER_AUTH] Missing env vars", {
                CLIENT_ID: !!CLIENT_ID,
                REDIRECT_URI: !!REDIRECT_URI,
            });
            return NextResponse.json(
                {
                    error: "MISSING_ENV",
                    message:
                        "KROGER_CLIENT_ID and KROGER_REDIRECT_URI must be set.",
                },
                { status: 500 }
            );
        }

        // Build state payload with optional returnTo, step, and mobile flag
        const statePayload: {
            userId: string;
            nonce: string;
            returnTo?: string;
            step?: string;
            mobile?: boolean;
        } = {
            userId,
            nonce: crypto.randomUUID(),
        };

        if (returnTo) {
            statePayload.returnTo = returnTo;
        }
        if (step) {
            statePayload.step = step;
        }
        if (mobile === "true") {
            statePayload.mobile = true;
        }

        const state = Buffer.from(
            JSON.stringify(statePayload),
            "utf8"
        ).toString("base64url");

        const params = new URLSearchParams({
            scope: SCOPES,
            response_type: "code",
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            state,
        });

        const authUrl = `${KROGER_AUTH_URL}?${params.toString()}`;

        // Redirect + set CSRF state cookie
        const res = NextResponse.redirect(authUrl);
        res.cookies.set("kroger_oauth_state", state, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 10, // 10 minutes
            path: "/",
        });

        return res;
    } catch (err) {
        console.error("[KROGER_AUTH] Unexpected error:", err);
        return NextResponse.json(
            {
                error: "INTERNAL_ERROR",
                message: "Failed to start Kroger auth.",
            },
            { status: 500 }
        );
    }
}
