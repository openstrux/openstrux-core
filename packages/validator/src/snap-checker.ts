/**
 * Snap chain compatibility checker.
 * Walks panel rod list pairwise, compares out→in container kinds.
 * Emits V002 on mismatch.
 */
import type { PanelNode } from "@openstrux/parser";
import type { ValidationDiagnostic } from "./diagnostics.js";
import { getRodSignature, areContainerKindsCompatible } from "./rod-signatures.js";

export function checkSnapChain(
  panels: readonly PanelNode[],
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];

  for (const panel of panels) {
    const rods = panel.rods;
    for (let i = 0; i < rods.length - 1; i++) {
      const current = rods[i];
      const next = rods[i + 1];
      if (current === undefined || next === undefined) continue;

      const currentSig = getRodSignature(current.rodType);
      const nextSig = getRodSignature(next.rodType);

      if (currentSig === undefined || nextSig === undefined) continue;

      if (!areContainerKindsCompatible(currentSig.outKind, nextSig.inKind)) {
        diagnostics.push({
          code: "V002",
          message: `Snap chain type mismatch: '${current.name}' (${current.rodType}) outputs ${String(currentSig.outKind)} but '${next.name}' (${next.rodType}) expects ${String(nextSig.inKind)} in panel '${panel.name}'`,
          severity: "error",
          line: next.loc?.line,
          col: next.loc?.col,
          panel: panel.name,
          rod: next.name,
        });
      }
    }
  }

  return diagnostics;
}
