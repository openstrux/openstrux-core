/**
 * Rod step emitter dispatch — maps all 18 basic + standard rod types to
 * RodStepEmitter functions.
 *
 * Spec reference: openstrux-spec/specs/modules/target-nextjs/rods.md
 */

import type { Rod } from "@openstrux/ast";
import type { ChainContext, ChainStep, RodStepEmitter } from "./types.js";

import { emitReceive }      from "./receive.js";
import { emitValidate }     from "./validate.js";
import { emitGuard }        from "./guard.js";
import { emitWriteData }    from "./write-data.js";
import { emitReadData }     from "./read-data.js";
import { emitRespond }      from "./respond.js";
import { emitTransform }    from "./transform.js";
import { emitFilter }       from "./filter.js";
import { emitSplit }        from "./split.js";
import { emitCall }         from "./call.js";
import { emitPseudonymize } from "./pseudonymize.js";
import { emitEncrypt }      from "./encrypt.js";
import {
  emitGroup, emitAggregate, emitMerge, emitJoin, emitWindow, emitStore,
} from "./tier2.js";
import { emitPrivateData } from "./standard/private-data.js";

export type { ChainStep, ChainContext, RodStepEmitter, ImportDecl } from "./types.js";
export { getTransformHelper } from "./transform.js";
export { getGuardHelper } from "./guard.js";

/**
 * Extract a preamble helper function from any rod step that stored one in
 * the `_helperFn` extension field (used by transform, guard, and future emitters).
 */
export function getStepHelper(step: ChainStep): string | undefined {
  return (step as ChainStep & { _helperFn?: string })._helperFn;
}

// ---------------------------------------------------------------------------
// Tier classification
// ---------------------------------------------------------------------------

export const TIER2_ROD_TYPES = new Set<string>([
  "group", "aggregate", "merge", "join", "window",
]);

// ---------------------------------------------------------------------------
// Dispatch table
// ---------------------------------------------------------------------------

const ROD_STEP_EMITTERS: Record<string, RodStepEmitter> = {
  "receive":      emitReceive,
  "validate":     emitValidate,
  "guard":        emitGuard,
  "write-data":   emitWriteData,
  "read-data":    emitReadData,
  "respond":      emitRespond,
  "transform":    emitTransform,
  "filter":       emitFilter,
  "split":        emitSplit,
  "call":         emitCall,
  "pseudonymize": emitPseudonymize,
  "encrypt":      emitEncrypt,
  "store":        emitStore,
  // Standard rods
  "private-data": emitPrivateData,
  // Tier 2 rods
  "group":        emitGroup,
  "aggregate":    emitAggregate,
  "merge":        emitMerge,
  "join":         emitJoin,
  "window":       emitWindow,
};

// ---------------------------------------------------------------------------
// dispatchRodStep — returns a ChainStep for the given rod
// ---------------------------------------------------------------------------

export function dispatchRodStep(rod: Rod, ctx: ChainContext): ChainStep {
  const emitter = ROD_STEP_EMITTERS[rod.rodType];
  if (emitter !== undefined) return emitter(rod, ctx);

  // Fallback for unrecognised rod types
  console.warn(
    `[openstrux-generator] Unrecognised rod type "${rod.rodType}" — emitting stub`
  );
  return {
    imports: [],
    statement: `// STRUX-STUB: ${rod.rodType} — ${rod.name} — unrecognised rod type`,
    outputVar: ctx.inputVar,
    outputType: ctx.inputType,
  };
}

export function isTier2Rod(rodType: string): boolean {
  return TIER2_ROD_TYPES.has(rodType);
}
