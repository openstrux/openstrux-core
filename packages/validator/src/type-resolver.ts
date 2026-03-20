/**
 * Type reference resolver — Phase 2 pass.
 * Walks rod knots and type paths, looks up against SymbolTable.
 * Emits V001 on unresolved references.
 */
import { PRIMITIVE_TYPES } from "@openstrux/parser";
import type { KnotValue, RodNode, PanelNode } from "@openstrux/parser";
import type { ValidationDiagnostic } from "./diagnostics.js";
import type { SymbolTable } from "./symbol-table.js";

export function resolveTypeReferences(
  panels: readonly PanelNode[],
  symbolTable: SymbolTable,
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];

  for (const panel of panels) {
    for (const rod of panel.rods) {
      for (const [_key, value] of Object.entries(rod.knots)) {
        const rodDiags = checkKnotValue(value, symbolTable, panel.name, rod);
        diagnostics.push(...rodDiags);
      }
    }
  }

  return diagnostics;
}

function checkKnotValue(
  value: KnotValue,
  symbolTable: SymbolTable,
  panelName: string,
  rod: RodNode,
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];

  if (value.kind === "path") {
    // Check if the first segment is a known type (PascalCase = named type reference)
    const first = value.segments[0];
    if (first !== undefined && isTypeName(first)) {
      if (!PRIMITIVE_TYPES.has(first) && !symbolTable.has(first)) {
        diagnostics.push({
          code: "V001",
          message: `Unresolved type reference '${first}' in rod '${rod.name}' of panel '${panelName}'`,
          severity: "error",
          line: rod.loc?.line,
          col: rod.loc?.col,
          panel: panelName,
          rod: rod.name,
        });
      }
    }

    // Recurse into config block
    if (value.config !== undefined) {
      for (const [_k, v] of Object.entries(value.config)) {
        diagnostics.push(...checkKnotValue(v, symbolTable, panelName, rod));
      }
    }
  } else if (value.kind === "block") {
    for (const [_k, v] of Object.entries(value.config)) {
      diagnostics.push(...checkKnotValue(v, symbolTable, panelName, rod));
    }
  }

  return diagnostics;
}

/** A type name starts with uppercase (PascalCase convention). */
function isTypeName(name: string): boolean {
  return (
    name.length > 0 &&
    name[0] === name[0]?.toUpperCase() &&
    name[0] !== name[0]?.toLowerCase()
  );
}
