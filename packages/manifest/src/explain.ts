/**
 * Explain output generator.
 *
 * Takes a Manifest (or its audit data) and produces a human-readable
 * panel explanation following the ADR-013 template.
 *
 * CLI surface:
 *   strux panel build --explain               → stdout
 *   strux panel build --explain-output <path> → file
 *
 * The `--explain` text and `manifest.audit` are generated from the same
 * ManifestAudit data structure (task 4.5 / EX-006). Wire this function in
 * the CLI package once available.
 *
 * Spec reference: specs/explain/spec.md §EX-001 – EX-007
 *                 design.md §--explain and manifest.audit are generated from same IR traversal
 */

import { writeFileSync } from "node:fs";
import type { Manifest, ManifestAudit, AuditEntry, AccessContextSummary, PolicyVerification } from "./types.js";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ExplainOptions {
  /**
   * File path to write explain output.
   * When omitted or undefined, caller should write to stdout.
   * Maps to CLI flag --explain-output <path>.
   */
  readonly outputPath?: string | undefined;

  /**
   * Show full detail for every rod entry.
   * Maps to CLI flag --explain --verbose.
   * Default: false (summary mode).
   */
  readonly verbose?: boolean | undefined;

  /**
   * Panel name — written as the explanation header.
   * When omitted, a generic header is used.
   */
  readonly panelName?: string | undefined;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const SEPARATOR = "=".repeat(60);
const THIN_SEP = "-".repeat(60);

function formatLoc(entry: AuditEntry): string {
  const { file, line, col } = entry.loc;
  return line > 0 ? `${file}:${line}:${col}` : file;
}

function formatAccessContext(ctx: AccessContextSummary): string {
  const parts: string[] = [];
  if (ctx.principal) parts.push(`principal=${ctx.principal}`);
  if (ctx.intent) parts.push(`intent=${ctx.intent}`);
  if (ctx.scope && ctx.scope.length > 0) parts.push(`scope=[${ctx.scope.join(", ")}]`);
  return parts.length > 0 ? parts.join(", ") : "(none)";
}

function formatPolicyVerification(pv: PolicyVerification): string {
  const parts: string[] = [];
  if (pv.inlineCount > 0) parts.push(`${pv.inlineCount} inline`);
  if (pv.hubCount > 0) parts.push(`${pv.hubCount} hub`);
  if (pv.externalCount > 0) parts.push(`${pv.externalCount} external`);
  if (pv.opaqueWarnings > 0) parts.push(`${pv.opaqueWarnings} opaque (⚠)`);
  return parts.length > 0 ? parts.join(", ") : "none";
}

function formatEntry(entry: AuditEntry, verbose: boolean): string {
  const lines: string[] = [];
  lines.push(`Step ${entry.step} [${entry.rod}] ${entry.description.replace(`${entry.rod} rod: `, "")}`);
  lines.push(`  Location: ${formatLoc(entry)}`);
  lines.push(`  Description: ${entry.description}`);

  if (verbose || entry.pushdownStatus) {
    lines.push(`  Pushdown: ${entry.pushdownStatus ?? "none"}`);
  }
  if (verbose || entry.policyVerification) {
    lines.push(`  Policy: ${entry.policyVerification ?? "none"}`);
  }
  if (verbose && entry.accessContext) {
    lines.push(`  Access Context: ${JSON.stringify(entry.accessContext)}`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Core formatter
// ---------------------------------------------------------------------------

/**
 * Produce the human-readable explanation text from a ManifestAudit.
 *
 * Follows ADR-013 template:
 *   - Numbered steps with rod types and source locations (EX-002)
 *   - Access context summary (EX-003)
 *   - Pushdown status count (EX-004)
 *   - Policy verification summary (EX-005)
 */
export function formatExplain(audit: ManifestAudit, options: ExplainOptions = {}): string {
  const { verbose = false, panelName } = options;
  const lines: string[] = [];

  // Header
  const title = panelName ? `Panel Explanation: ${panelName}` : "Panel Explanation";
  lines.push(SEPARATOR);
  lines.push(title);
  lines.push(SEPARATOR);
  lines.push("");

  // Access context summary (EX-003)
  if (audit.accessContext) {
    lines.push("Access Context");
    lines.push(THIN_SEP);
    lines.push(formatAccessContext(audit.accessContext));
    lines.push("");
  }

  // Numbered steps (EX-002)
  lines.push("Steps");
  lines.push(THIN_SEP);
  if (audit.entries.length === 0) {
    lines.push("  (no rods)");
  } else {
    for (const entry of audit.entries) {
      lines.push(formatEntry(entry, verbose));
      lines.push("");
    }
  }

  // Summary
  lines.push(THIN_SEP);
  lines.push("Summary");
  lines.push(THIN_SEP);
  lines.push(`  Rods: ${audit.entries.length}`);

  const pushdownCount = audit.entries.filter(
    (e) => e.pushdownStatus && e.pushdownStatus !== "none"
  ).length;
  lines.push(`  Pushdown annotations: ${pushdownCount}`); // EX-004

  const escapeHatchCount = audit.entries.filter(
    (e) => e.policyVerification === "opaque"
  ).length;
  lines.push(`  Escape hatches: ${escapeHatchCount}`);

  if (audit.policyVerification) {
    lines.push(`  Policy verification: ${formatPolicyVerification(audit.policyVerification)}`); // EX-005
  }

  lines.push(SEPARATOR);

  return lines.join("\n");
}

/**
 * Convenience wrapper over formatExplain that accepts a full Manifest.
 */
export function explain(manifest: Manifest, options: ExplainOptions = {}): string {
  const panelName = options.panelName;
  return formatExplain(manifest.audit, { ...options, panelName });
}

// ---------------------------------------------------------------------------
// Output routing — stdout vs file (EX-007)
// ---------------------------------------------------------------------------

/**
 * Write explain output to stdout or to a file.
 *
 * CLI wiring:
 *   strux panel build --explain                      → writeExplain(text, {})
 *   strux panel build --explain-output /tmp/out.txt  → writeExplain(text, { outputPath: "/tmp/out.txt" })
 *
 * When outputPath is set, nothing is written to stdout (EX-007).
 */
export function writeExplain(text: string, options: ExplainOptions = {}): void {
  if (options.outputPath) {
    writeFileSync(options.outputPath, text, "utf8");
  } else {
    process.stdout.write(text + "\n");
  }
}
