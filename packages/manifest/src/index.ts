/**
 * @openstrux/manifest — compiled manifest model, generation, and explanation.
 *
 * Public API:
 *   - Types: Manifest, AuditEntry, ManifestDiagnostic, ...
 *   - generateManifest(): build-pipeline entry point
 *   - explain() / formatExplain(): --explain text generation
 *   - writeExplain(): route explain output to stdout or file
 *   - computeContentHash() / canonicalise(): source canonicalisation
 *   - extractScope(): certification scope from validated IR
 *   - generateAudit(): audit metadata from validated IR
 */

// Types
export type {
  Manifest,
  ManifestAudit,
  AuditEntry,
  AuditLoc,
  AccessContextSummary,
  PolicyVerification,
  ManifestDiagnostic,
  ManifestDiagnosticCode,
} from "./types.js";
export { DIAGNOSTIC_MESSAGES } from "./types.js";

// Build pipeline
export type {
  GenerateManifestInput,
  GenerateManifestResult,
} from "./pipeline.js";
export { generateManifest } from "./pipeline.js";

// Content hash
export { canonicalise, computeContentHash } from "./canonicalise.js";

// Scope
export { extractScope } from "./scope.js";

// Audit
export { generateAudit } from "./audit.js";

// Explain
export type { ExplainOptions } from "./explain.js";
export { explain, formatExplain, writeExplain } from "./explain.js";
