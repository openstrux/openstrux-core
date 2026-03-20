/**
 * Scope validator.
 * Checks fields in @access scope are declared on referenced types.
 * Emits V003 on mismatch.
 */
import type { PanelNode, KnotValue } from "@openstrux/parser";
import type { ValidationDiagnostic } from "./diagnostics.js";
import type { SymbolTable } from "./symbol-table.js";

export function validateScope(
  panels: readonly PanelNode[],
  symbolTable: SymbolTable,
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];

  for (const panel of panels) {
    if (panel.access === undefined) continue;

    // Look for scope.fieldMask — fields that should be declared on a type
    const scopeVal = panel.access.fields["scope"];
    if (scopeVal === undefined) continue;

    if (scopeVal.kind === "block") {
      const resourcesVal = scopeVal.config["resources"];
      if (resourcesVal !== undefined) {
        // resources is a list of resource grants — check the resource type exists
        const diags = checkResourceGrant(
          resourcesVal,
          panel.name,
          symbolTable,
          panel.loc?.line,
        );
        diagnostics.push(...diags);
      }
    }
  }

  return diagnostics;
}

function checkResourceGrant(
  val: KnotValue,
  panelName: string,
  symbolTable: SymbolTable,
  line?: number | undefined,
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];

  if (val.kind === "path" && val.segments.length > 0) {
    const typeName = val.segments[0];
    // If it looks like a type name and is not found, emit V003
    if (
      typeName !== undefined &&
      isTypeName(typeName) &&
      !symbolTable.has(typeName)
    ) {
      diagnostics.push({
        code: "V003",
        message: `Scope resource type '${typeName}' in panel '${panelName}' is not declared`,
        severity: "error",
        line,
        panel: panelName,
      });
    }
  }

  return diagnostics;
}

function isTypeName(name: string): boolean {
  return (
    name.length > 0 &&
    name[0] === name[0]?.toUpperCase() &&
    name[0] !== name[0]?.toLowerCase()
  );
}
