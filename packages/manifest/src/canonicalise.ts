/**
 * Source canonicaliser — re-exports the shared implementation from @openstrux/lock.
 *
 * Canonical form (RFC-0001 Annex A):
 *   1. Line comments stripped (`//` to end of line, excluding inside strings)
 *   2. @cert blocks stripped (excluded from hash input to avoid circular dependency)
 *   3. Source split into top-level declarations (@type, @panel) by tracking brace depth
 *   4. Whitespace within each declaration normalised (collapsed to single spaces)
 *   5. Declarations sorted alphabetically by name
 *   6. Joined with a single newline
 *
 * The resulting string is then SHA-256 hashed to produce `contentHash`.
 */

export { canonicalise, computeContentHash } from "@openstrux/lock";
