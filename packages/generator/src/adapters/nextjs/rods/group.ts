/**
 * group rod emitter — key-based partitioning (Stream → Stream).
 *
 * Spec reference: openstrux-spec/specs/modules/rods/overview.md §3 group
 *
 * Lowering:
 *   PortableGroupKey  → Map-based grouping with key expression
 *   FunctionRef       → import + call
 *   legacy cfg.key    → single field grouping (backward compat)
 */

import type { Rod } from "@openstrux/ast";
import type {
  GroupKeyExpr,
  PortableGroupKey,
  GroupKeyEntry,
  FieldGroupKey,
  ComputedGroupKey,
  FunctionRef,
} from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";
import { getCfgString } from "./config-extractors.js";
import { lowerExpr } from "./expression-lowerer.js";

export function emitGroup(rod: Rod, ctx: ChainContext): ChainStep {
  const keyArg = rod.arg["key"] as unknown as GroupKeyExpr | undefined;

  // FunctionRef (task 4.9)
  if (keyArg?.kind === "FunctionRef") {
    const ref = keyArg as FunctionRef;
    return {
      imports: [{ names: [ref.fn], from: ref.module }],
      statement: buildGroupStmt(ctx.inputVar, `(item) => String(${ref.fn}(item))`),
      outputVar: "grouped",
      outputType: `Record<string, unknown[]>`,
    };
  }

  // PortableGroupKey (task 4.6)
  if (keyArg?.kind === "PortableGroupKey") {
    const pgk = keyArg as PortableGroupKey;
    const keyFn = lowerGroupKeyFn(pgk.keys);
    return {
      imports: [],
      statement: buildGroupStmt(ctx.inputVar, keyFn),
      outputVar: "grouped",
      outputType: `Record<string, unknown[]>`,
    };
  }

  // Legacy fallback: cfg.key string
  const key = getCfgString(rod, "key") ?? "id";
  return {
    imports: [],
    statement: buildGroupStmt(
      ctx.inputVar,
      `(item) => String((item as Record<string, unknown>)["${key}"])`,
    ),
    outputVar: "grouped",
    outputType: `Record<string, unknown[]>`,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildGroupStmt(inputVar: string, keyFn: string): string {
  return [
    `const grouped = (${inputVar} as unknown[]).reduce<Record<string, unknown[]>>((acc, item) => {`,
    `  const k = (${keyFn})(item);`,
    `  (acc[k] ??= []).push(item);`,
    `  return acc;`,
    `}, {});`,
  ].join("\n");
}

function lowerGroupKeyFn(keys: readonly GroupKeyEntry[]): string {
  if (keys.length === 0) {
    return `(item) => "__all__"`;
  }

  if (keys.length === 1) {
    return lowerSingleKey(keys[0]!);
  }

  // Composite key: JSON.stringify array of key values
  const parts = keys.map(k => keyExpr(k)).join(", ");
  return `(item) => JSON.stringify([${parts}])`;
}

function lowerSingleKey(entry: GroupKeyEntry): string {
  if (entry.kind === "FieldGroupKey") {
    const fg = entry as FieldGroupKey;
    const path = ["(item as Record<string, unknown>)", ...fg.field.segments].join('"]["');
    return `(item) => String((item as Record<string, unknown>)["${path}"])`;
  }
  // ComputedGroupKey
  const cg = entry as ComputedGroupKey;
  const expr = lowerExpr(cg.expr, { rootVar: "item" });
  return `(item) => String(${expr})`;
}

function keyExpr(entry: GroupKeyEntry): string {
  if (entry.kind === "FieldGroupKey") {
    const fg = entry as FieldGroupKey;
    const access = fg.field.segments.map(s => `["${s}"]`).join("");
    return `(item as Record<string, unknown>)${access}`;
  }
  const cg = entry as ComputedGroupKey;
  return lowerExpr(cg.expr, { rootVar: "item" });
}
