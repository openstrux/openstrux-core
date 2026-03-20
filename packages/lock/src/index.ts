/**
 * @openstrux/lock — snap.lock semantics and determinism.
 *
 * Full implementation pending: v0-6-0-lock-determinism change package.
 * This stub exports the SnapLock interface so downstream packages
 * (e.g. @openstrux/manifest) can reference the lock structure.
 */

/**
 * Parsed representation of a snap.lock file.
 *
 * sourceHash is SHA-256 of the canonicalised source at lock-freeze time.
 * It is referenced as `lockRef` in the compiled manifest to create a
 * verifiable chain: source → lock → manifest.
 */
export interface SnapLock {
  /** Schema version of the lock format. */
  readonly schemaVersion: string;
  /** SHA-256 of canonicalised source at lock-freeze time (RFC-0001 Annex A). */
  readonly sourceHash: string;
  /** ISO 8601 timestamp when the lock was frozen. */
  readonly timestamp: string;
  /** Resolved dependency snapshot (package → content hash). */
  readonly dependencies: Record<string, string>;
}
