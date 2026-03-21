/**
 * Tier 1 emitter — transform rod.
 * Emits a typed mapping function stub with in/out types from cfg knots.
 */

import type { Rod } from "@openstrux/ast";
import type { Panel } from "@openstrux/ast";

export function emitTransform(rod: Rod, _panel: Panel): string {
  const inType = getCfgTypeName(rod, "in");
  const outType = getCfgTypeName(rod, "out");
  return [
    `// transform: ${rod.name}`,
    `function transform(input: ${inType}): ${outType} {`,
    `  // TODO: implement transform — ${rod.name}`,
    `  throw new Error("not implemented");`,
    `}`,
    ``,
  ].join("\n");
}

function getCfgTypeName(rod: Rod, key: string): string {
  const val = rod.cfg[key] as unknown as Record<string, unknown> | undefined;
  if (val === undefined) return "unknown";
  // TypeRef: { kind: "TypeRef", name: "Proposal" }
  if (val["kind"] === "TypeRef" && typeof val["name"] === "string") return val["name"] as string;
  // NarrowedUnion: { resolvedType: "PostgresConfig", ... }
  if (typeof val["resolvedType"] === "string") return val["resolvedType"] as string;
  return "unknown";
}
