/**
 * group rod emitter — key-based partitioning (Stream → Stream).
 *
 * Spec reference: openstrux-spec/specs/modules/rods/overview.md §3 group
 * Partition stream by key function. Output: Record<string, T[]>.
 */

import type { Rod } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";
import { getCfgString } from "./config-extractors.js";

export function emitGroup(rod: Rod, ctx: ChainContext): ChainStep {
  const key = getCfgString(rod, "key") ?? "id";
  return {
    imports: [],
    statement: [
      `const grouped = (${ctx.inputVar} as unknown[]).reduce<Record<string, unknown[]>>((acc, item) => {`,
      `  const k = String((item as Record<string, unknown>)["${key}"]);`,
      `  (acc[k] ??= []).push(item);`,
      `  return acc;`,
      `}, {});`,
    ].join("\n"),
    outputVar: "grouped",
    outputType: `Record<string, unknown[]>`,
  };
}

