/**
 * merge rod emitter — N inputs → 1 output (union of same-type streams).
 *
 * Spec reference: openstrux-spec/specs/modules/rods/overview.md §3 merge
 */

import type { Rod } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";

export function emitMerge(_rod: Rod, ctx: ChainContext): ChainStep {
  // In an implicit linear chain the merge rod receives the previous step's
  // output.  When explicit multi-input snap wiring is available the chain
  // composer will supply additional input variables; for now we emit a
  // spread-concat that merges the upstream array with itself (identity) so
  // downstream rods see a flat array.
  return {
    imports: [],
    statement: `const merged = [...(Array.isArray(${ctx.inputVar}) ? ${ctx.inputVar} : [${ctx.inputVar}])];`,
    outputVar: "merged",
    outputType: ctx.inputType,
  };
}
