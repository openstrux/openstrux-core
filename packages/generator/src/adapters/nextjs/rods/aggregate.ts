/**
 * aggregate rod emitter — associative reduction (Stream → Single).
 *
 * Spec reference: openstrux-spec/specs/modules/rods/overview.md §3 aggregate
 * Built-in functions: count, sum, avg, min, max.
 */

import type { Rod } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";
import { getCfgString } from "./config-extractors.js";

export function emitAggregate(rod: Rod, ctx: ChainContext): ChainStep {
  const fn = getCfgString(rod, "fn") ?? "count";
  const field = getCfgString(rod, "field") ?? "";

  const fieldAccess = field
    ? `(item as Record<string, unknown>)["${field}"]`
    : "item";

  let statement: string;
  switch (fn) {
    case "count":
      statement = `const aggregated = (${ctx.inputVar} as unknown[]).length;`;
      break;
    case "sum":
      statement = `const aggregated = (${ctx.inputVar} as unknown[]).reduce((acc, item) => acc + Number(${fieldAccess}), 0);`;
      break;
    case "avg":
      statement = [
        `const _items = ${ctx.inputVar} as unknown[];`,
        `const aggregated = _items.length > 0 ? _items.reduce((acc, item) => acc + Number(${fieldAccess}), 0) / _items.length : 0;`,
      ].join("\n");
      break;
    case "min":
      statement = `const aggregated = Math.min(...(${ctx.inputVar} as unknown[]).map(item => Number(${fieldAccess})));`;
      break;
    case "max":
      statement = `const aggregated = Math.max(...(${ctx.inputVar} as unknown[]).map(item => Number(${fieldAccess})));`;
      break;
    default:
      statement = [
        `// STRUX-STUB: aggregate — unrecognised function "${fn}"`,
        `const aggregated = ${ctx.inputVar};`,
      ].join("\n");
  }

  return {
    imports: [],
    statement,
    outputVar: "aggregated",
    outputType: "number",
  };
}

