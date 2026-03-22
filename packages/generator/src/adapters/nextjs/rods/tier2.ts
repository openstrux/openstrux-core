/**
 * Tier 2 stub step emitters — group, aggregate, merge, join, window.
 * Each produces a STRUX-STUB chain step with a diagnostic comment.
 */

import type { Rod } from "@openstrux/ast";
import type { ChainContext, ChainStep, RodStepEmitter } from "./types.js";

function makeStub(rodType: string): RodStepEmitter {
  return (rod: Rod, ctx: ChainContext): ChainStep => ({
    imports: [],
    statement: `// STRUX-STUB: ${rodType} — ${rod.name} — not implemented in v0.6`,
    outputVar: ctx.inputVar,
    outputType: ctx.inputType,
  });
}

export const emitGroup     = makeStub("group");
export const emitAggregate = makeStub("aggregate");
export const emitMerge     = makeStub("merge");
export const emitJoin      = makeStub("join");
export const emitWindow    = makeStub("window");
export const emitStore     = makeStub("store");
