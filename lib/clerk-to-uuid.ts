/*
<ai_context>
Utility to convert Clerk user IDs to deterministic UUIDs for Supabase compatibility.
</ai_context>
*/

import { createHash } from "crypto"

/**
 * Converts a Clerk user ID to a deterministic UUID v4 format
 * Same input will always produce the same UUID
 */
export function clerkUserIdToUuid(clerkUserId: string): string {
  // Create a SHA-256 hash of the Clerk user ID
  const hash = createHash("sha256").update(clerkUserId).digest("hex")

  // Take first 32 characters and format as UUID v4
  const uuid = [
    hash.substring(0, 8),
    hash.substring(8, 12),
    "4" + hash.substring(13, 16), // Version 4 UUID starts with 4
    ((parseInt(hash.substring(16, 17), 16) & 0x3) | 0x8).toString(16) +
      hash.substring(17, 20), // Variant bits
    hash.substring(20, 32)
  ].join("-")

  return uuid
}

/**
 * Helper type for functions that need UUID conversion
 */
export type ClerkUserIdToUuidFn = typeof clerkUserIdToUuid
