// lib/authFetch.ts
import { auth } from "@/lib/firebaseClient";

/**
 * Fetch wrapper that automatically adds Firebase ID token to requests
 * Use this instead of fetch() for authenticated API calls
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User not authenticated");
  }

  const token = await user.getIdToken();

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);

  // Ensure Content-Type is set for JSON requests
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
