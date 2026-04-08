/**
 * filter rod emitter — predicate-based row selection (Stream → Stream).
 *
 * Spec reference: openstrux-spec/specs/modules/rods/overview.md §3 filter
 *
 * Lowering:
 *   PortableFilter  → (item) => <predicate>       (fully lowered)
 *   FunctionRef     → (item) => fn(item)           (import + call)
 *   source-specific → throw stub                   (comment + throw)
 *   no predicate    → pass-through                 (identity filter)
 */

import type { Rod } from "@openstrux/ast";
import type { FilterExpr, FunctionRef } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";
import { lowerFilter, isPortableFilter, sourceSpecificStub } from "./expression-lowerer.js";

export function emitFilter(rod: Rod, ctx: ChainContext): ChainStep {
  const predArg = rod.arg["predicate"] as unknown as FilterExpr | undefined;

  if (predArg === undefined) {
    return {
      imports: [],
      statement: `const result = ${ctx.inputVar} as unknown[];`,
      outputVar: "result",
      outputType: "unknown[]",
    };
  }

  // FunctionRef (task 4.9): emit import + call
  if (predArg.kind === "FunctionRef") {
    const ref = predArg as FunctionRef;
    return {
      imports: [{ names: [ref.fn], from: ref.module }],
      statement: `const result = (${ctx.inputVar} as unknown[]).filter((item) => ${ref.fn}(item));`,
      outputVar: "result",
      outputType: "unknown[]",
    };
  }

  // Portable filter (task 4.2)
  if (isPortableFilter(predArg)) {
    const predicate = lowerFilter(predArg, { rootVar: "item" });
    return {
      imports: [],
      statement: `const result = (${ctx.inputVar} as unknown[]).filter((item) => ${predicate});`,
      outputVar: "result",
      outputType: "unknown[]",
    };
  }

  // Source-specific (SqlFilter, MongoFilter, KafkaFilter, CustomFilter) (task 4.10)
  const prefix = (predArg as { prefix?: string }).prefix ?? predArg.kind;
  const raw = (predArg as { raw?: string; query?: string; clause?: string }).raw
    ?? (predArg as { query?: string }).query
    ?? (predArg as { clause?: string }).clause
    ?? "";
  return {
    imports: [],
    statement: `const result = (() => {\n  ${sourceSpecificStub(prefix, raw)}\n})();`,
    outputVar: "result",
    outputType: "unknown[]",
  };
}
