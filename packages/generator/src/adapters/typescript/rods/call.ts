/**
 * Tier 1 emitter — call rod.
 * Emits a fetch() stub with URL/method from cfg.endpoint/cfg.method.
 */

import type { Rod } from "@openstrux/ast";
import type { Panel } from "@openstrux/ast";

export function emitCall(rod: Rod, _panel: Panel): string {
  const endpoint = getCfgString(rod, "endpoint") ?? "TODO: endpoint";
  const method = getCfgString(rod, "method") ?? "GET";
  const pascalName = toPascalCase(rod.name);
  return [
    `// call: ${rod.name}`,
    `async function call${pascalName}(input: unknown): Promise<unknown> {`,
    `  const result = await fetch("${endpoint}", { method: "${method}" });`,
    `  return result.json();`,
    `}`,
    ``,
  ].join("\n");
}

function getCfgString(rod: Rod, key: string): string | undefined {
  const val = rod.cfg[key] as unknown as Record<string, unknown> | undefined;
  if (val === undefined) return undefined;
  // LitString: { kind: "LitString", value: "POST" }
  if (val["kind"] === "LitString" && typeof val["value"] === "string") return val["value"] as string;
  // Promoted string shorthand
  if (typeof val === "string") return val;
  return undefined;
}

function toPascalCase(name: string): string {
  return name.split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join("");
}
