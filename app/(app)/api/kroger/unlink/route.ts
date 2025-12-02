// app/(app)/api/kroger/unlink/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId } = body;

        if (!userId) {
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }

        // Remove Kroger tokens and linked status from Firebase
        await adminDb.collection("users").doc(userId).update({
            krogerLinked: false,
            krogerTokens: null,
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Error unlinking Kroger account:", err);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}