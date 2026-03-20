/**
 * AccessContext enforcer.
 * Checks every PanelNode.access is non-null.
 * Emits W002 if absent (warning in v0.6.0).
 */
import type { PanelNode } from "@openstrux/parser";
import type { ValidationDiagnostic } from "./diagnostics.js";

export function enforceAccessContext(
  panels: readonly PanelNode[],
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];

  for (const panel of panels) {
    if (panel.access === undefined) {
      diagnostics.push({
        code: "W002",
        message: `Panel '${panel.name}' is missing an @access block — AccessContext required by v0.7.0`,
        severity: "warning",
        line: panel.loc?.line,
        col: panel.loc?.col,
        panel: panel.name,
      });
    }
  }

  return diagnostics;
}
