/**
 * @openstrux/manifest — Manifest schema types.
 *
 * Spec reference: openstrux/openspec/changes/v0-6-0-manifest-explain/specs/manifest/spec.md
 *                 ADR-013
 */

// ===================================================================
// Core manifest shape (mf.strux.json)
// ===================================================================

// ===================================================================
// Privacy records (privacyRecords — Art. 30 / BDSG §26 manifest entries)
// Spec: openstrux-spec/specs/modules/manifest.md §Privacy Records
// ===================================================================

/** Art. 30 GDPR record of processing activities. */
export interface Art30Record {
  readonly controller: string;
  readonly controllerId?: string | undefined;
  readonly dpo?: string | undefined;
  readonly dpRecord?: string | undefined;
  readonly purpose: string;
  readonly lawfulBasis: string;
  readonly dataSubjectCategories: readonly string[];
  readonly personalDataCategories: readonly string[];
  readonly specialCategories: readonly string[];
  readonly recipients: readonly string[];
  readonly retention: string;
  readonly technicalMeasures: readonly string[];
  readonly dpiaRef?: string | null | undefined;
  readonly crossBorderTransfer?: {
    readonly mechanism: string;
    readonly destinationCountries: readonly string[];
  } | null | undefined;
}

/** BDSG §26 extension on top of Art. 30. */
export interface BdsgExtension {
  readonly bdsgSection26: boolean;
  readonly employeeCategory?: string | undefined;
  readonly betriebsratConsent?: string | undefined;
}

/** One privacy record per private-data rod instance in the panel. */
export interface PrivacyRecord {
  readonly rodName: string;
  readonly framework: string;
  readonly article30: Art30Record;
  readonly bdsg?: BdsgExtension | undefined;
}

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
  /**
   * Art. 30 / BDSG §26 privacy records — one entry per private-data rod instance.
   * Present only when at least one panel contains a private-data rod.
   * Spec: openstrux-spec/specs/modules/manifest.md §Privacy Records
   */
  readonly privacyRecords?: readonly PrivacyRecord[] | undefined;
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
