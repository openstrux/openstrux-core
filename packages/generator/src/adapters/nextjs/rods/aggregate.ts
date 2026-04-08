/**
 * aggregate rod emitter — associative reduction (Stream → Single).
 *
 * Spec reference: openstrux-spec/specs/modules/rods/overview.md §3 aggregate
 *
 * Lowering:
 *   PortableAggregation → typed reduce/map expressions per AggCall
 *   FunctionRef         → import + call
 *   legacy cfg.fn       → simple switch (backward compat)
 */

import type { Rod } from "@openstrux/ast";
import type {
  AggregationExpr,
  PortableAggregation,
  AggCall,
  FunctionRef,
  FieldPath,
} from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";
import { getCfgString } from "./config-extractors.js";

export function emitAggregate(rod: Rod, ctx: ChainContext): ChainStep {
  const aggArg = rod.arg["fn"] as unknown as AggregationExpr | undefined;

  // FunctionRef (task 4.9)
  if (aggArg?.kind === "FunctionRef") {
    const ref = aggArg as FunctionRef;
    return {
      imports: [{ names: [ref.fn], from: ref.module }],
      statement: `const aggregated = ${ref.fn}(${ctx.inputVar} as unknown[]);`,
      outputVar: "aggregated",
      outputType: "unknown",
    };
  }

  // PortableAggregation (task 4.5)
  if (aggArg?.kind === "PortableAggregation") {
    const pagg = aggArg as PortableAggregation;
    return lowerPortableAgg(pagg.fns, ctx.inputVar);
  }

  // Legacy fallback: cfg.fn + cfg.field strings (backward compat)
  return legacyAgg(rod, ctx.inputVar);
}

// ---------------------------------------------------------------------------
// PortableAggregation lowering
// ---------------------------------------------------------------------------

function lowerPortableAgg(fns: readonly AggCall[], inputVar: string): ChainStep {
  if (fns.length === 1) {
    // Single aggregation — scalar result
    const stmt = lowerAggCall(fns[0]!, inputVar, "aggregated");
    return {
      imports: [],
      statement: stmt,
      outputVar: "aggregated",
      outputType: aggOutputType(fns[0]!),
    };
  }

  // Multiple aggregations — object result with aliases
  const stmts: string[] = [];
  const props: string[] = [];
  for (const call of fns) {
    const varName = `_agg_${call.alias ?? call.fn}`;
    stmts.push(lowerAggCall(call, inputVar, varName));
    const key = call.alias ?? call.fn;
    props.push(`  ${key}: ${varName}`);
  }
  stmts.push(`const aggregated = {`);
  stmts.push(...props.map(p => p + ","));
  stmts.push(`};`);

  return {
    imports: [],
    statement: stmts.join("\n"),
    outputVar: "aggregated",
    outputType: "Record<string, unknown>",
  };
}

/** Emit a single AggCall as `const varName = ...` */
function lowerAggCall(call: AggCall, inputVar: string, varName: string): string {
  const arr = `(${inputVar} as unknown[])`;
  const fieldAccess = call.field ? fieldAccessExpr(call.field) : "item";

  switch (call.fn) {
    case "count":
      if (call.distinct && call.field) {
        return `const ${varName} = new Set(${arr}.map((item) => ${fieldAccess})).size;`;
      }
      return `const ${varName} = ${arr}.length;`;

    case "sum":
      return `const ${varName} = ${arr}.reduce((acc, item) => acc + Number(${fieldAccess}), 0);`;

    case "avg": {
      const tmp = `_avg_items_${varName}`;
      return [
        `const ${tmp} = ${arr};`,
        `const ${varName} = ${tmp}.length > 0 ? ${tmp}.reduce((acc, item) => acc + Number(${fieldAccess}), 0) / ${tmp}.length : 0;`,
      ].join("\n");
    }

    case "min":
      return `const ${varName} = Math.min(...${arr}.map((item) => Number(${fieldAccess})));`;

    case "max":
      return `const ${varName} = Math.max(...${arr}.map((item) => Number(${fieldAccess})));`;

    case "first":
      return `const ${varName} = (${arr}[0] as Record<string, unknown>)${call.field ? `?.["${call.field.segments.at(-1)!}"]` : ""};`;

    case "last":
      return `const ${varName} = ((${arr} as unknown[]).at(-1) as Record<string, unknown>)${call.field ? `?.["${call.field.segments.at(-1)!}"]` : ""};`;

    case "collect":
      if (call.distinct && call.field) {
        return `const ${varName} = [...new Set(${arr}.map((item) => ${fieldAccess}))];`;
      }
      return call.field
        ? `const ${varName} = ${arr}.map((item) => ${fieldAccess});`
        : `const ${varName} = ${arr};`;

    default:
      return `const ${varName} = /* STRUX-STUB: unknown agg fn "${call.fn}" */ undefined;`;
  }
}

function fieldAccessExpr(field: FieldPath): string {
  const path = field.segments.map(s => `["${s}"]`).join("");
  return `(item as Record<string, unknown>)${path}`;
}

function aggOutputType(call: AggCall): string {
  switch (call.fn) {
    case "count":
    case "sum":
    case "avg":
    case "min":
    case "max":
      return "number";
    case "first":
    case "last":
      return "unknown";
    case "collect":
      return "unknown[]";
    default:
      return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Legacy fallback (cfg.fn / cfg.field strings from pre-v0.6.0 parser)
// ---------------------------------------------------------------------------

function legacyAgg(rod: Rod, inputVar: string): ChainStep {
  const fn    = getCfgString(rod, "fn") ?? "count";
  const field = getCfgString(rod, "field") ?? "";
  const arr   = `(${inputVar} as unknown[])`;
  const fa    = field
    ? `(item as Record<string, unknown>)["${field}"]`
    : "item";

  let statement: string;
  switch (fn) {
    case "count":
      statement = `const aggregated = ${arr}.length;`;
      break;
    case "sum":
      statement = `const aggregated = ${arr}.reduce((acc, item) => acc + Number(${fa}), 0);`;
      break;
    case "avg":
      statement = [
        `const _items = ${inputVar} as unknown[];`,
        `const aggregated = _items.length > 0 ? _items.reduce((acc, item) => acc + Number(${fa}), 0) / _items.length : 0;`,
      ].join("\n");
      break;
    case "min":
      statement = `const aggregated = Math.min(...${arr}.map(item => Number(${fa})));`;
      break;
    case "max":
      statement = `const aggregated = Math.max(...${arr}.map(item => Number(${fa})));`;
      break;
    default:
      statement = [
        `// STRUX-STUB: aggregate — unrecognised function "${fn}"`,
        `const aggregated = ${inputVar};`,
      ].join("\n");
  }

  return { imports: [], statement, outputVar: "aggregated", outputType: "number" };
}
