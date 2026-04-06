/**
 * window rod emitter — temporal grouping (Stream → Stream).
 *
 * Spec reference: openstrux-spec/specs/modules/rods/overview.md §3 window
 * Fixed, sliding, session windows. For the Next.js target (non-streaming)
 * this generates batch windowing by timestamp field.
 */

import type { Rod } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";
import { getCfgString } from "./config-extractors.js";

export function emitWindow(rod: Rod, ctx: ChainContext): ChainStep {
  const windowType = getCfgString(rod, "type") ?? "fixed";
  const size = getCfgString(rod, "size") ?? "1h";
  const tsField = getCfgString(rod, "field") ?? "timestamp";

  const sizeMs = parseDuration(size);

  return {
    imports: [],
    statement: [
      `// window: ${windowType}, size=${size}, field=${tsField}`,
      `const windowed = (${ctx.inputVar} as unknown[]).reduce<Record<string, unknown[]>>((acc, item) => {`,
      `  const ts = new Date(String((item as Record<string, unknown>)["${tsField}"])).getTime();`,
      `  const bucket = String(Math.floor(ts / ${sizeMs}) * ${sizeMs});`,
      `  (acc[bucket] ??= []).push(item);`,
      `  return acc;`,
      `}, {});`,
    ].join("\n"),
    outputVar: "windowed",
    outputType: `Record<string, unknown[]>`,
  };
}

function parseDuration(dur: string): number {
  const match = dur.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match || !match[1] || !match[2]) return 3600000; // default 1h
  const n = parseInt(match[1], 10);
  switch (match[2]) {
    case "ms": return n;
    case "s":  return n * 1000;
    case "m":  return n * 60_000;
    case "h":  return n * 3_600_000;
    case "d":  return n * 86_400_000;
    default:   return 3_600_000;
  }
}

