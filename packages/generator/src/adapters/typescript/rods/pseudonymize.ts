/**
 * Tier 1 emitter — pseudonymize rod.
 * Emits a compliance wrapper function stub with JSDoc citing AccessContext scope fields.
 */

import type { Rod } from "@openstrux/ast";
import type { Panel } from "@openstrux/ast";
import type { AccessContext } from "@openstrux/ast";

export function emitPseudonymize(rod: Rod, panel: Panel): string {
  const fields = getScopeFields(panel);
  const pascalName = toPascalCase(rod.name);
  const fieldsDoc = fields.length > 0 ? fields.join(", ") : "TODO: specify fields";
  return [
    `// pseudonymize: ${rod.name}`,
    `/**`,
    ` * @access scope.fieldMask: ${fieldsDoc}`,
    ` */`,
    `function pseudonymize${pascalName}(input: unknown): unknown {`,
    `  // TODO: implement pseudonymize — ${rod.name}`,
    `  throw new Error("not implemented");`,
    `}`,
    ``,
  ].join("\n");
}

function getScopeFields(panel: Panel): string[] {
  const access = panel.access as AccessContext;
  const fieldMask = access?.scope?.fieldMask;
  if (Array.isArray(fieldMask)) return [...fieldMask];
  return [];
}

function toPascalCase(name: string): string {
  return name.split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join("");
}
