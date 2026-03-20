/**
 * Build pipeline integration — manifest generation.
 *
 * Called after validation + lock freeze, before target generation.
 * If validation has errors, the pipeline must not call generateManifest;
 * the manifest is null when validation fails (MF-001).
 *
 * This module is the single entry point for manifest emission in the build
 * pipeline. Wire it after @openstrux/validator and @openstrux/lock succeed.
 *
 * Spec reference: design.md §Manifest is emitted as a side effect of build pipeline
 *                 specs/manifest/spec.md §MF-001, §MF-005
 */

import type { SourceFile } from "@openstrux/ast";
import type { SnapLock } from "@openstrux/lock";
import { computeContentHash } from "./canonicalise.js";
import { extractScope } from "./scope.js";
import { generateAudit } from "./audit.js";
import {
  type Manifest,
  type ManifestDiagnostic,
  DIAGNOSTIC_MESSAGES,
} from "./types.js";

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

export interface GenerateManifestInput {
  /**
   * Raw source text of the .strux file.
   * Used to compute contentHash via the source canonicaliser.
   */
  readonly source: string;

  /**
   * Validated IR — must be a fully valid SourceFile.
   * The pipeline must not call generateManifest when validation errors exist.
   */
  readonly sourceFile: SourceFile;

  /**
   * Semantic version of the package being compiled.
   * Written as manifest.version.
   */
  readonly version: string;

  /**
   * Parsed snap.lock — present after lock freeze succeeds.
   * If null / undefined, lockRef is null and W_NO_LOCK was already emitted.
   */
  readonly lock?: SnapLock | null | undefined;

  /**
   * Previous manifest for changed-hash detection.
   * When provided and contentHash differs, E_MANIFEST_HASH_CHANGED is emitted.
   */
  readonly previous?: Manifest | null | undefined;
}

export interface GenerateManifestResult {
  readonly manifest: Manifest;
  readonly diagnostics: readonly ManifestDiagnostic[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a compiled manifest from a validated, locked AST.
 *
 * Pipeline position: after validation + lock freeze, before target generation.
 *
 * Guarantee: a single IR traversal produces both `manifest.audit` and the
 * data used by `explain()` — they can never diverge (EX-006).
 */
export function generateManifest(
  input: GenerateManifestInput
): GenerateManifestResult {
  const contentHash = computeContentHash(input.source);
  const certificationScope = extractScope(input.sourceFile);
  const audit = generateAudit(input.sourceFile);

  const lockRef: string | null = input.lock?.sourceHash ?? null;
  const timestamp = new Date().toISOString();

  const manifest: Manifest = {
    schemaVersion: "0.6",
    version: input.version,
    contentHash,
    certificationScope,
    timestamp,
    lockRef,
    audit,
  };

  const diagnostics: ManifestDiagnostic[] = [
    {
      code: "I_MANIFEST_GENERATED",
      message: DIAGNOSTIC_MESSAGES.I_MANIFEST_GENERATED,
      severity: "info",
    },
  ];

  // Detect changed hash (regression guard)
  if (input.previous && input.previous.contentHash !== contentHash) {
    diagnostics.push({
      code: "E_MANIFEST_HASH_CHANGED",
      message: DIAGNOSTIC_MESSAGES.E_MANIFEST_HASH_CHANGED,
      severity: "error",
    });
  }

  return { manifest, diagnostics };
}
