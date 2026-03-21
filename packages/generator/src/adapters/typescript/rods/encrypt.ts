/**
 * Tier 1 emitter — encrypt rod.
 * Emits a compliance wrapper function stub with JSDoc citing AccessContext scope fields.
 */

import type { Rod } from "@openstrux/ast";
import type { Panel } from "@openstrux/ast";
import type { AccessContext } from "@openstrux/ast";

export function emitEncrypt(rod: Rod, panel: Panel): string {
  const fields = getScopeFields(panel);
  const pascalName = toPascalCase(rod.name);
  const fieldsDoc = fields.length > 0 ? fields.join(", ") : "TODO: specify fields";
  return [
    `// encrypt: ${rod.name}`,
    `/**`,
    ` * @access scope.fieldMask: ${fieldsDoc}`,
    ` */`,
    `function encrypt${pascalName}(input: unknown): unknown {`,
    `  // TODO: implement encrypt — ${rod.name}`,
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
