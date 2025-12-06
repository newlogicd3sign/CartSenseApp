import { createHash } from "crypto";

/**
 * Creates a SHA-256 hash of an email address for abuse detection.
 * Normalizes the email by lowercasing and trimming whitespace.
 */
export function hashEmail(email: string): string {
    return createHash("sha256")
        .update(email.toLowerCase().trim())
        .digest("hex");
}