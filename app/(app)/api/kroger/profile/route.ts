// app/(app)/api/kroger/profile/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

const API_BASE = process.env.KROGER_API_BASE_URL ?? "https://api.kroger.com/v1";
const TOKEN_URL = process.env.KROGER_TOKEN_URL ?? "https://api.kroger.com/v1/connect/oauth2/token";
const CLIENT_ID = process.env.KROGER_CLIENT_ID!;
const CLIENT_SECRET = process.env.KROGER_CLIENT_SECRET!;

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: number } | null> {
    const body = new URLSearchParams();
    body.append("grant_type", "refresh_token");
    body.append("refresh_token", refreshToken);

    const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
            Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });

    if (!res.ok) {
        return null;
    }

    const tokens = await res.json();
    return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
    };
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    try {
        // Get user's Kroger tokens from Firebase
        const userDoc = await adminDb.collection("users").doc(userId).get();
        const userData = userDoc.data();

        if (!userData?.krogerLinked || !userData?.krogerTokens) {
            return NextResponse.json({ error: "Kroger account not linked" }, { status: 400 });
        }

        let { accessToken, refreshToken, expiresAt } = userData.krogerTokens;

        // Check if token is expired (with 5 minute buffer)
        if (Date.now() > expiresAt - 5 * 60 * 1000) {
            const newTokens = await refreshAccessToken(refreshToken);
            if (!newTokens) {
                // Token refresh failed, unlink account
                await adminDb.collection("users").doc(userId).update({
                    krogerLinked: false,
                    krogerTokens: null,
                });
                return NextResponse.json({ error: "Session expired, please re-link your Kroger account" }, { status: 401 });
            }

            // Update tokens in Firebase
            await adminDb.collection("users").doc(userId).update({
                krogerTokens: {
                    accessToken: newTokens.accessToken,
                    refreshToken: newTokens.refreshToken,
                    expiresAt: newTokens.expiresAt,
                    updatedAt: Date.now(),
                },
            });

            accessToken = newTokens.accessToken;
        }

        // Fetch profile from Kroger API
        const profileRes = await fetch(`${API_BASE}/identity/profile`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
            },
        });

        if (!profileRes.ok) {
            const errorText = await profileRes.text();
            console.error("Kroger profile fetch failed:", errorText);
            return NextResponse.json({ error: "Failed to fetch profile" }, { status: profileRes.status });
        }

        const profileData = await profileRes.json();
        console.log("Kroger profile response:", JSON.stringify(profileData, null, 2));

        // The profile.compact scope returns data in this format
        const profile = profileData.data;

        return NextResponse.json({
            id: profile?.id,
            firstName: profile?.firstName,
            lastName: profile?.lastName,
        });
    } catch (err) {
        console.error("Error fetching Kroger profile:", err);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}