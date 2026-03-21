/**
 * Rod dispatch table — maps all 18 rod type strings to TypeScript emitter functions.
 *
 * Tier 1: real emitters (transform, filter, write-data, call, split, pseudonymize, encrypt)
 * Tier 2: handled stubs (group, aggregate, merge, join, window) — emit STRUX-STUB comments
 * Fallback: unknown rod types emit a STRUX-STUB comment and log a warning
 */

import type { Rod, Panel } from "@openstrux/ast";

import { emitTransform } from "./transform.js";
import { emitFilter } from "./filter.js";
import { emitStore } from "./store.js";
import { emitWriteData } from "./write-data.js";
import { emitCall } from "./call.js";
import { emitSplit } from "./split.js";
import { emitPseudonymize } from "./pseudonymize.js";
import { emitEncrypt } from "./encrypt.js";
import { emitGroup } from "./group.js";
import { emitAggregate } from "./aggregate.js";
import { emitMerge } from "./merge.js";
import { emitJoin } from "./join.js";
import { emitWindow } from "./window.js";

// ---------------------------------------------------------------------------
// RodEmitter — returns a string code block to include in the route file
// ---------------------------------------------------------------------------

export type RodEmitter = (rod: Rod, panel: Panel) => string;

// ---------------------------------------------------------------------------
// Tier classification
// ---------------------------------------------------------------------------

/** Rod types with real emitters (demo-capable). */
export const TIER1_ROD_TYPES = new Set<string>([
  "transform",
  "filter",
  "write-data",
  "call",
  "split",
  "pseudonymize",
  "encrypt",
  // existing Tier 1 — handled structurally by emitRouteFile and emitGuardFile
  "receive",
  "respond",
  "store",
  "read-data",
  "guard",
  "validate",
]);

/** Rod types that emit STRUX-STUB comments (not demo-capable). */
export const TIER2_ROD_TYPES = new Set<string>([
  "group",
  "aggregate",
  "merge",
  "join",
  "window",
]);

// ---------------------------------------------------------------------------
// Dispatch table
// ---------------------------------------------------------------------------

const ROD_EMITTERS: Record<string, RodEmitter> = {
  // Tier 1 — new emitters
  "transform":    emitTransform,
  "filter":       emitFilter,
  "store":        emitStore,
  "write-data":   emitWriteData,
  "call":         emitCall,
  "split":        emitSplit,
  "pseudonymize": emitPseudonymize,
  "encrypt":      emitEncrypt,
  // Tier 2 — stubs
  "group":     emitGroup,
  "aggregate": emitAggregate,
  "merge":     emitMerge,
  "join":      emitJoin,
  "window":    emitWindow,
};

/**
 * Rod types handled structurally by the route / guard / validate emitters.
 * These are NOT dispatched through the snippet table.
 */
const STRUCTURAL_ROD_TYPES = new Set<string>([
  "receive",
  "respond",
  "guard",
  "validate",
]);

// ---------------------------------------------------------------------------
// dispatchRod — returns a code snippet for the given rod, or empty string if structural
// ---------------------------------------------------------------------------

export function dispatchRod(rod: Rod, panel: Panel): string {
  if (STRUCTURAL_ROD_TYPES.has(rod.rodType)) return "";
  const emitter = ROD_EMITTERS[rod.rodType];
  if (emitter !== undefined) {
    return emitter(rod, panel);
  }
  // Fallback for unrecognised rod types
  console.warn(
    `[openstrux-generator] Unrecognised rod type "${rod.rodType}" in panel "${(panel as { name?: string }).name ?? "unknown"}" — emitting stub`
  );
  return `// STRUX-STUB: ${rod.rodType} — ${rod.name} — unrecognised rod type\n`;
}

// ---------------------------------------------------------------------------
// isTier2Rod — true if the rod type is a Tier 2 stub
// ---------------------------------------------------------------------------

export function isTier2Rod(rodType: string): boolean {
  return TIER2_ROD_TYPES.has(rodType);
}
