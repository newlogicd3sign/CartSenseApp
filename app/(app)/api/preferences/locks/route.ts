// app/(app)/api/preferences/locks/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import type { PreferenceLockRule, PreferenceLockScope } from "@/types/preferences";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "USER_ID_REQUIRED", message: "User ID is required." },
        { status: 400 }
      );
    }

    const locksRef = adminDb
      .collection("preferenceLocks")
      .doc(userId)
      .collection("locks");

    const snapshot = await locksRef.orderBy("createdAt", "desc").get();

    const locks = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ locks }, { status: 200 });
  } catch (error) {
    console.error("Error fetching preference locks:", error);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Failed to fetch preference locks." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, scope, key, rule, context, note } = body as {
      userId?: string;
      scope?: PreferenceLockScope;
      key?: string;
      rule?: PreferenceLockRule;
      context?: {
        mealTime?: "breakfast" | "lunch" | "dinner" | "snack";
        dayType?: "weekday" | "weekend";
        audience?: "solo" | "family";
      };
      note?: string;
    };

    if (!userId) {
      return NextResponse.json(
        { error: "USER_ID_REQUIRED", message: "User ID is required." },
        { status: 400 }
      );
    }

    if (!scope || !key || !rule) {
      return NextResponse.json(
        {
          error: "INVALID_PARAMS",
          message: "Missing required fields: scope, key, and rule.",
        },
        { status: 400 }
      );
    }

    // Validate scope
    const validScopes: PreferenceLockScope[] = [
      "ingredient",
      "tag",
      "cuisine",
      "method",
      "product",
      "brand",
    ];
    if (!validScopes.includes(scope)) {
      return NextResponse.json(
        { error: "INVALID_SCOPE", message: "Invalid scope value." },
        { status: 400 }
      );
    }

    // Validate rule
    const validRules: PreferenceLockRule[] = [
      "ALWAYS_INCLUDE",
      "NEVER_INCLUDE",
      "AVOID",
      "PREFER",
    ];
    if (!validRules.includes(rule)) {
      return NextResponse.json(
        { error: "INVALID_RULE", message: "Invalid rule value." },
        { status: 400 }
      );
    }

    // Normalize the key
    const normalizedKey = key
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

    if (!normalizedKey) {
      return NextResponse.json(
        { error: "INVALID_KEY", message: "Key cannot be empty after normalization." },
        { status: 400 }
      );
    }

    const locksRef = adminDb
      .collection("preferenceLocks")
      .doc(userId)
      .collection("locks");

    // Check for existing lock with same scope and key
    const existing = await locksRef
      .where("scope", "==", scope)
      .where("key", "==", normalizedKey)
      .limit(1)
      .get();

    if (!existing.empty) {
      // Update existing lock
      const existingDoc = existing.docs[0];
      await existingDoc.ref.update({
        rule,
        context: context || null,
        note: note || null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json(
        {
          id: existingDoc.id,
          scope,
          key: normalizedKey,
          rule,
          context: context || null,
          note: note || null,
          updated: true,
        },
        { status: 200 }
      );
    }

    // Create new lock
    const newLock = {
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      scope,
      key: normalizedKey,
      rule,
      context: context || null,
      note: note || null,
      confidence: 1.0,
    };

    const docRef = await locksRef.add(newLock);

    return NextResponse.json(
      {
        id: docRef.id,
        ...newLock,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating preference lock:", error);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Failed to create preference lock." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const lockId = searchParams.get("lockId");

    if (!userId) {
      return NextResponse.json(
        { error: "USER_ID_REQUIRED", message: "User ID is required." },
        { status: 400 }
      );
    }

    if (!lockId) {
      return NextResponse.json(
        { error: "LOCK_ID_REQUIRED", message: "Lock ID is required." },
        { status: 400 }
      );
    }

    const lockRef = adminDb
      .collection("preferenceLocks")
      .doc(userId)
      .collection("locks")
      .doc(lockId);

    const lockDoc = await lockRef.get();

    if (!lockDoc.exists) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Preference lock not found." },
        { status: 404 }
      );
    }

    await lockRef.delete();

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting preference lock:", error);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Failed to delete preference lock." },
      { status: 500 }
    );
  }
}
