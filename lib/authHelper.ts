// lib/authHelper.ts
import "server-only";
import { adminAuth } from "@/lib/firebaseAdmin";
import { NextResponse } from "next/server";

export type AuthResult =
  | { success: true; userId: string }
  | { success: false; error: NextResponse };

/**
 * Verify Firebase ID token from Authorization header
 * Returns the verified user ID or an error response
 *
 * Usage in API routes:
 * ```
 * const auth = await verifyAuth(request);
 * if (!auth.success) return auth.error;
 * const userId = auth.userId;
 * ```
 */
export async function verifyAuth(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      success: false,
      error: NextResponse.json(
        { error: "UNAUTHORIZED", message: "Missing or invalid Authorization header" },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    return {
      success: true,
      userId: decodedToken.uid,
    };
  } catch (error) {
    console.error("Token verification failed:", error);
    return {
      success: false,
      error: NextResponse.json(
        { error: "UNAUTHORIZED", message: "Invalid or expired token" },
        { status: 401 }
      ),
    };
  }
}
