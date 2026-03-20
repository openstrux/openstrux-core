/**
 * W003 — non-PascalCase type name warning.
 */
import type { StruxNode } from "@openstrux/parser";
import type { ValidationDiagnostic } from "./diagnostics.js";

export function checkTypeNames(
  ast: readonly StruxNode[],
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];

  for (const node of ast) {
    if (
      node.kind === "record" ||
      node.kind === "enum" ||
      node.kind === "union"
    ) {
      if (!isPascalCase(node.name)) {
        diagnostics.push({
          code: "W003",
          message: `Type name '${node.name}' is not PascalCase — recommended naming convention`,
          severity: "warning",
          line: node.loc?.line,
          col: node.loc?.col,
        });
      }
    }
  }

  return diagnostics;
}

function isPascalCase(name: string): boolean {
  return (
    name.length > 0 &&
    /^[A-Z]/.test(name) &&
    !/[^a-zA-Z0-9]/.test(name)
  );
}
