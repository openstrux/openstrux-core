/**
 * @openstrux/lock — snap.lock schema types.
 *
 * Spec reference: ADR-014, v0-6-0-lock-determinism design.md
 */

// ===================================================================
// Core lock file shape (snap.lock)
// ===================================================================

/**
 * Top-level lock file artifact written as snap.lock.
 *
 * Determinism contract: same source + same LockFile = byte-identical
 * mf.strux.json contentHash and semantically identical generated code.
 * Note: `generatedAt` is informational metadata excluded from the
 * determinism contract — two builds at different times produce different
 * timestamps but identical `sourceHash`, `entries`, and generated output.
 */
export interface LockFile {
  /** Format version of the lock schema. "0.6" for this release. */
  readonly lockVersion: string;
  /** OpenStrux spec version in effect when the lock was generated. */
  readonly specVersion: string;
  /** ISO 8601 UTC timestamp when the lock was frozen. */
  readonly generatedAt: string;
  /**
   * SHA-256 of the canonicalised source at lock-freeze time (RFC-0001 Annex A).
   * Referenced as `lockRef` in the compiled manifest to create a verifiable
   * chain: source → lock → manifest.
   */
  readonly sourceHash: string;
  /** All resolved dependency entries pinned by this lock. */
  readonly entries: readonly LockEntry[];
}

/**
 * A single pinned dependency entry in the lock file.
 *
 * key     — stable identifier for the dependency (e.g. "db.sql.postgres", "Proposal")
 * kind    — what kind of dependency this is
 * version — version string (semver for adapters, "0.6" for types/configs without one)
 * hash    — SHA-256 of the resolved dependency state
 */
export interface LockEntry {
  readonly key: string;
  readonly kind: "adapter" | "config" | "type" | "hub-artifact";
  readonly version: string;
  readonly hash: string;
}

// ===================================================================
// Diagnostic codes
// ===================================================================

export type LockDiagnosticCode =
  | "W_NO_LOCK"
  | "E_LOCK_MISMATCH"
  | "I_LOCK_CREATED"
  | "E_LOCK_STALE";

export interface LockDiagnostic {
  readonly code: LockDiagnosticCode;
  readonly message: string;
  readonly severity: "info" | "warning" | "error";
}

export const LOCK_DIAGNOSTIC_MESSAGES: Record<LockDiagnosticCode, string> = {
  W_NO_LOCK: "No snap.lock found — build proceeds without determinism guarantee",
  E_LOCK_MISMATCH:
    "Resolved dependency state differs from snap.lock — run with --lock-update to refresh",
  I_LOCK_CREATED: "snap.lock created successfully",
  E_LOCK_STALE:
    "snap.lock references a different spec version — run with --lock-update to refresh",
};

/**
 * SnapLock is the public interface referenced by downstream packages
 * (e.g. @openstrux/manifest). It is an alias for LockFile.
 */
export type SnapLock = LockFile;
