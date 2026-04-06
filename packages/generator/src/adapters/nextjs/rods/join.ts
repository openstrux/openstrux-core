/**
 * join rod emitter — combine by key (Stream → Stream).
 *
 * Spec reference: openstrux-spec/specs/modules/rods/overview.md §3 join
 * Modes: inner, left, right, outer, cross, lookup.
 * In a linear chain context, join receives one input; the second input
 * would come from snap wiring.  This emitter generates a lookup join
 * against a typed right-side reference.
 */

import type { Rod } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";
import { getCfgString } from "./config-extractors.js";

export function emitJoin(rod: Rod, ctx: ChainContext): ChainStep {
  const mode = getCfgString(rod, "mode") ?? "inner";
  const key = getCfgString(rod, "key") ?? "id";
  const rightVar = getCfgString(rod, "right") ?? "rightData";
  const fnName = `join${toPascal(rod.name)}`;

  return {
    imports: [],
    statement: [
      `function ${fnName}(left: unknown[], right: unknown[]): unknown[] {`,
      `  const rightIndex = new Map<string, unknown>();`,
      `  for (const r of right) rightIndex.set(String((r as Record<string, unknown>)["${key}"]), r);`,
      mode === "inner"
        ? `  return left.filter(l => rightIndex.has(String((l as Record<string, unknown>)["${key}"]))).map(l => ({ ...l as object, ...rightIndex.get(String((l as Record<string, unknown>)["${key}"])) as object }));`
        : mode === "left"
        ? `  return left.map(l => ({ ...l as object, ...(rightIndex.get(String((l as Record<string, unknown>)["${key}"])) as object ?? {}) }));`
        : mode === "outer"
        ? [
            `  const leftKeys = new Set(left.map(l => String((l as Record<string, unknown>)["${key}"])));`,
            `  const matched = left.map(l => ({ ...l as object, ...(rightIndex.get(String((l as Record<string, unknown>)["${key}"])) as object ?? {}) }));`,
            `  const unmatched = right.filter(r => !leftKeys.has(String((r as Record<string, unknown>)["${key}"])));`,
            `  return [...matched, ...unmatched];`,
          ].join("\n")
        : `  return left.filter(l => rightIndex.has(String((l as Record<string, unknown>)["${key}"]))).map(l => ({ ...l as object, ...rightIndex.get(String((l as Record<string, unknown>)["${key}"])) as object }));`,
      `}`,
      `const joined = ${fnName}(${ctx.inputVar} as unknown[], ${rightVar} as unknown[]);`,
    ].join("\n"),
    outputVar: "joined",
    outputType: "unknown[]",
  };
}

function toPascal(name: string): string {
  return name.split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join("");
}
