// lib/logUserEvent.ts
"use client";

import { db } from "@/lib/firebaseClient";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export type LogUserEventPayload = {
    type:
        | "prompt_submitted"
        | "meal_viewed"
        | "meal_saved"
        | "added_to_shopping_list"
        | "thread_message"
        | string;
    mealId?: string;
    prompt?: string;
    message?: string;
};

export async function logUserEvent(
    uid: string,
    event: LogUserEventPayload,
): Promise<void> {
    try {
        const eventsCol = collection(db, "userEvents", uid, "events");

        await addDoc(eventsCol, {
            ...event,
            mealId: event.mealId ?? null,
            prompt: event.prompt ?? null,
            message: event.message ?? null,
            createdAt: serverTimestamp(),
        });
    } catch (err) {
        console.error("logUserEvent error:", err);
        // MVP: we swallow the error so it never blocks the UI
    }
}
