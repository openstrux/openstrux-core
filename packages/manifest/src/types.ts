/**
 * @openstrux/manifest — Manifest schema types.
 *
 * Spec reference: openstrux/openspec/changes/v0-6-0-manifest-explain/specs/manifest/spec.md
 *                 ADR-013
 */

// ===================================================================
// Core manifest shape (mf.strux.json)
// ===================================================================

/** Top-level compiled manifest artifact. */
export interface Manifest {
  /** Schema version of this manifest format. Always "0.6" for this release. */
  readonly schemaVersion: string;
  /** Version of the source package that generated this manifest. */
  readonly version: string;
  /**
   * SHA-256 of the canonicalised source — stable across reformatting.
   * Canonical form: declarations sorted alphabetically, whitespace normalised,
   * comments stripped, @cert blocks excluded.
   * Spec: RFC-0001 Annex A.
   */
  readonly contentHash: string;
  /** All type paths actually used in the validated AST (not just declared). */
  readonly certificationScope: readonly string[];
  /** ISO 8601 timestamp of manifest generation. */
  readonly timestamp: string;
  /**
   * sourceHash from snap.lock used during build — links compiled artifact
   * back to the exact source identity and dependency state.
   * null when no lock file was present (W_NO_LOCK was emitted).
   */
  readonly lockRef: string | null;
  /** Structured audit / explanation data (ADR-013). */
  readonly audit: ManifestAudit;
}

// ===================================================================
// Audit field (ADR-013)
// ===================================================================

/** Per-panel audit container. */
export interface ManifestAudit {
  /** One entry per rod, in declaration order. */
  readonly entries: readonly AuditEntry[];
  /** Resolved access context summary for the panel. */
  readonly accessContext?: AccessContextSummary | undefined;
  /** Policy verification counts for the panel. */
  readonly policyVerification?: PolicyVerification | undefined;
}

/** Per-rod explanation entry. */
export interface AuditEntry {
  /** 1-based step number within the panel. */
  readonly step: number;
  /** Rod type identifier (e.g. "receive", "validate", "write-data"). */
  readonly rod: string;
  /** Human-readable description of the rod's role. */
  readonly description: string;
  /** Source location of the rod declaration. */
  readonly loc: AuditLoc;
  /**
   * Data pushdown status.
   * "none" | "full" | "partial" | or custom annotation.
   * Absent when rod has no pushdown annotation.
   */
  readonly pushdownStatus?: string | undefined;
  /** Narrowed access context at this rod (e.g. scope restrictions). */
  readonly accessContext?: object | undefined;
  /**
   * Policy verification status at this rod.
   * "inline" | "hub" | "external" | "opaque" | "none".
   */
  readonly policyVerification?: string | undefined;
}

/** Compact source location (file + 1-based line + 1-based col). */
export interface AuditLoc {
  readonly file: string;
  readonly line: number;
  readonly col: number;
}

/** Summary of the panel's resolved AccessContext. */
export interface AccessContextSummary {
  readonly principal?: string | undefined;
  readonly intent?: string | undefined;
  readonly scope?: readonly string[] | undefined;
}

/** Counts of different policy verification kinds in the panel. */
export interface PolicyVerification {
  readonly inlineCount: number;
  readonly hubCount: number;
  readonly externalCount: number;
  readonly opaqueWarnings: number;
}

// ===================================================================
// Diagnostic codes
// ===================================================================

export type ManifestDiagnosticCode =
  | "I_MANIFEST_GENERATED"
  | "E_MANIFEST_HASH_CHANGED";

export interface ManifestDiagnostic {
  readonly code: ManifestDiagnosticCode;
  readonly message: string;
  readonly severity: "info" | "error";
}

export const DIAGNOSTIC_MESSAGES: Record<ManifestDiagnosticCode, string> = {
  I_MANIFEST_GENERATED: "Manifest generated successfully",
  E_MANIFEST_HASH_CHANGED:
    "Content hash has changed since last manifest generation",
};
