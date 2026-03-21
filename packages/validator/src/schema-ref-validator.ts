/**
 * SchemaRef validator — validates validate rod schema: fields.
 *
 * Rules:
 *   - schema value must be an identifier (path), not a string literal
 *   - schema identifier must resolve to a declared @type in the symbol table
 *
 * Emits:
 *   E_SCHEMA_STRING    — schema value is a string literal (use identifier instead)
 *   E_SCHEMA_UNRESOLVED — schema identifier is not a declared @type
 */

import type { PanelNode } from "@openstrux/parser";
import type { ValidationDiagnostic } from "./diagnostics.js";
import type { SymbolTable } from "./symbol-table.js";

export function validateSchemaRefs(
  panels: readonly PanelNode[],
  symbolTable: SymbolTable,
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];

  for (const panel of panels) {
    for (const rod of panel.rods) {
      if (rod.rodType !== "validate") continue;

      const schemaValue = rod.knots["schema"];
      if (schemaValue === undefined) continue;

      if (schemaValue.kind === "string") {
        // E_SCHEMA_STRING: user wrote schema: "TypeName" (string) instead of schema: TypeName (identifier)
        const suggestion = schemaValue.value;
        diagnostics.push({
          code: "E_SCHEMA_STRING",
          message: `validate.schema must be an identifier, not a string. Use \`schema: ${suggestion}\` instead of \`schema: "${suggestion}"\``,
          severity: "error",
          line: rod.loc?.line,
          col: rod.loc?.col,
          panel: panel.name,
          rod: rod.name,
        });
        continue;
      }

      if (schemaValue.kind === "path") {
        const typeName = schemaValue.segments[0];
        if (typeName !== undefined && !symbolTable.has(typeName)) {
          diagnostics.push({
            code: "E_SCHEMA_UNRESOLVED",
            message: `validate.schema references undeclared @type '${typeName}' in rod '${rod.name}' of panel '${panel.name}'`,
            severity: "error",
            line: rod.loc?.line,
            col: rod.loc?.col,
            panel: panel.name,
            rod: rod.name,
          });
        }
      }
    }
  }

  return diagnostics;
}
