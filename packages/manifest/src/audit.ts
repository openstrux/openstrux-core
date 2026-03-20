/**
 * Audit metadata generator.
 *
 * Walks the validated IR (SourceFile) and produces per-rod AuditEntry[]
 * with source locations, access context, pushdown status, and policy
 * verification. The same data is serialised into manifest.audit and rendered
 * as --explain text — a single IR traversal, no divergence possible (EX-006).
 *
 * Spec reference: design.md §Manifest includes structured audit field
 *                 specs/manifest/spec.md §MF-006
 */

import type { SourceFile, Panel, Rod } from "@openstrux/ast";
import type {
  AuditEntry,
  AuditLoc,
  AccessContextSummary,
  ManifestAudit,
  PolicyVerification,
} from "./types.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function rodDescription(rod: Rod): string {
  return `${rod.rodType} rod: ${rod.name}`;
}

function rodLoc(rod: Rod, panelName: string): AuditLoc {
  if (rod.loc) {
    return {
      file: rod.loc.start.file,
      line: rod.loc.start.line,
      col: rod.loc.start.col,
    };
  }
  // Synthetic rods (no source location) — use panel name as file
  return { file: panelName, line: 0, col: 0 };
}

function pushdownStatus(rod: Rod): string | undefined {
  // Derive from @cert scope if present
  const certScope = rod.cert?.scope;
  if (certScope && "pushdown" in certScope) {
    return String(certScope["pushdown"]);
  }
  // Presence of a cert at all implies some pushdown verification
  if (rod.cert) return "partial";
  return undefined;
}

function policyVerification(rod: Rod): string | undefined {
  const certScope = rod.cert?.scope;
  if (!certScope) return undefined;
  if ("policy" in certScope) return String(certScope["policy"]);
  return "inline";
}

function accessContextForRod(rod: Rod): object | undefined {
  // Rod-level access context is derived from cert scope if present
  const scope = rod.cert?.scope;
  if (!scope) return undefined;
  return scope as object;
}

function buildPanelAccessContextSummary(
  panel: Panel
): AccessContextSummary | undefined {
  const { access } = panel;
  if (!access) return undefined;

  const summary: {
    principal?: string;
    intent?: string;
    scope?: string[];
  } = {};

  if (access.principal) {
    summary.principal = `${access.principal.kind}:${access.principal.id}`;
  }
  if (access.intent) {
    const intent = access.intent;
    summary.intent = `${intent.purpose} (${intent.operation}, basis=${intent.basis})`;
  }
  if (access.scope) {
    summary.scope = access.scope.resources.map(
      (r) => `${r.resource}[${r.actions.join(",")}]`
    );
  }

  if (Object.keys(summary).length === 0) return undefined;
  return summary as AccessContextSummary;
}

function buildPolicyVerification(entries: readonly AuditEntry[]): PolicyVerification {
  let inlineCount = 0;
  let hubCount = 0;
  let externalCount = 0;
  let opaqueWarnings = 0;

  for (const entry of entries) {
    switch (entry.policyVerification) {
      case "inline":
        inlineCount++;
        break;
      case "hub":
        hubCount++;
        break;
      case "external":
        externalCount++;
        break;
      case "opaque":
        opaqueWarnings++;
        break;
    }
  }

  return { inlineCount, hubCount, externalCount, opaqueWarnings };
}

// ---------------------------------------------------------------------------
// Panel audit generator
// ---------------------------------------------------------------------------

function auditPanel(panel: Panel): ManifestAudit {
  const entries: AuditEntry[] = panel.rods.map((rod, idx) => ({
    step: idx + 1,
    rod: rod.rodType,
    description: rodDescription(rod),
    loc: rodLoc(rod, panel.name),
    pushdownStatus: pushdownStatus(rod),
    accessContext: accessContextForRod(rod),
    policyVerification: policyVerification(rod),
  }));

  const accessContext = buildPanelAccessContextSummary(panel);
  const policyVerif = buildPolicyVerification(entries);

  return {
    entries,
    ...(accessContext !== undefined ? { accessContext } : {}),
    policyVerification: policyVerif,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate audit metadata from a validated SourceFile.
 *
 * When the file contains exactly one panel, returns that panel's audit data.
 * When multiple panels are present, entries are concatenated in order with
 * step numbers restarting per panel (the manifest is per-file, not per-panel).
 *
 * This function performs a single IR traversal. The same data structure
 * is used both for manifest.audit serialisation and for --explain rendering
 * (EX-006 / task 4.5).
 */
export function generateAudit(sourceFile: SourceFile): ManifestAudit {
  if (sourceFile.panels.length === 0) {
    return { entries: [], policyVerification: { inlineCount: 0, hubCount: 0, externalCount: 0, opaqueWarnings: 0 } };
  }

  if (sourceFile.panels.length === 1) {
    const panel = sourceFile.panels[0];
    if (panel === undefined) {
      return { entries: [], policyVerification: { inlineCount: 0, hubCount: 0, externalCount: 0, opaqueWarnings: 0 } };
    }
    return auditPanel(panel);
  }

  // Multiple panels: merge entries, merge policy counts
  const allEntries: AuditEntry[] = [];
  let merged: PolicyVerification = { inlineCount: 0, hubCount: 0, externalCount: 0, opaqueWarnings: 0 };
  let accessContext: AccessContextSummary | undefined;

  for (const panel of sourceFile.panels) {
    const audit = auditPanel(panel);
    // Re-number steps globally
    const offset = allEntries.length;
    for (const entry of audit.entries) {
      allEntries.push({ ...entry, step: offset + entry.step });
    }
    if (audit.policyVerification) {
      merged = {
        inlineCount: merged.inlineCount + audit.policyVerification.inlineCount,
        hubCount: merged.hubCount + audit.policyVerification.hubCount,
        externalCount: merged.externalCount + audit.policyVerification.externalCount,
        opaqueWarnings: merged.opaqueWarnings + audit.policyVerification.opaqueWarnings,
      };
    }
    // Use first panel's access context as the file-level context
    if (!accessContext && audit.accessContext) {
      accessContext = audit.accessContext;
    }
  }

  return {
    entries: allEntries,
    ...(accessContext !== undefined ? { accessContext } : {}),
    policyVerification: merged,
  };
}
