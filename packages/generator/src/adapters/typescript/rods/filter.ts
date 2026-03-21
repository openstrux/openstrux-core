/**
 * Tier 1 emitter — filter rod.
 * Emits an inline array-filter function stub.
 */

import type { Rod } from "@openstrux/ast";
import type { Panel } from "@openstrux/ast";

export function emitFilter(rod: Rod, _panel: Panel): string {
  return [
    `// filter: ${rod.name}`,
    `function filter${toPascalCase(rod.name)}(input: unknown[]): unknown[] {`,
    `  return input.filter((item) => /* TODO: ${rod.name} predicate */ false);`,
    `}`,
    ``,
  ].join("\n");
}

function toPascalCase(name: string): string {
  return name.split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join("");
}
