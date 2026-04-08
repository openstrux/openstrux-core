/**
 * transform rod emitter — field projection / reshaping (Stream → Stream).
 *
 * Spec reference: openstrux-spec/specs/modules/rods/overview.md §3 transform
 *
 * Lowering:
 *   PortableProjection  → typed helper fn with explicit field mapping
 *   FunctionRef         → import + call
 *   no fields arg       → stub (unchanged from before)
 */

import type { Rod } from "@openstrux/ast";
import type {
  ProjectionExpr,
  PortableProjection,
  ProjectionEntry,
  SelectField,
  ExcludeField,
  ComputedField,
  FunctionRef,
} from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";
import { getCfgTypeName } from "./config-extractors.js";
import { lowerExpr, lowerFieldPath, sourceSpecificStub } from "./expression-lowerer.js";

export function emitTransform(rod: Rod, ctx: ChainContext): ChainStep {
  const inType  = getCfgTypeName(rod, "in")  ?? ctx.inputType;
  const outType = getCfgTypeName(rod, "out") ?? "unknown";
  const fnName  = `transform${toPascal(rod.name)}`;

  const fieldsArg = rod.arg["fields"] as unknown as ProjectionExpr | undefined;

  // FunctionRef (task 4.9)
  if (fieldsArg?.kind === "FunctionRef") {
    const ref = fieldsArg as FunctionRef;
    return {
      imports: [{ names: [ref.fn], from: ref.module }],
      statement: `const result = (${ctx.inputVar} as ${inType}[]).map((input) => ${ref.fn}(input));`,
      outputVar: "result",
      outputType: `${outType}[]`,
    };
  }

  // PortableProjection (task 4.3)
  if (fieldsArg?.kind === "PortableProjection") {
    const proj = fieldsArg as PortableProjection;
    const helperFn = buildProjectionFn(fnName, proj.entries, inType, outType);
    return {
      imports: [],
      statement: `const result = (${ctx.inputVar} as ${inType}[]).map((input) => ${fnName}(input));`,
      outputVar: "result",
      outputType: `${outType}[]`,
      ...({ _helperFn: helperFn } as object),
    };
  }

  // No fields arg — emit stub
  const helperFn = buildStubFn(fnName, inType, outType, rod.name);
  return {
    imports: [],
    statement: `const result = (${ctx.inputVar} as ${inType}[]).map((input) => ${fnName}(input));`,
    outputVar: "result",
    outputType: `${outType}[]`,
    ...({ _helperFn: helperFn } as object),
  };
}

export function getTransformHelper(step: ChainStep): string | undefined {
  return (step as ChainStep & { _helperFn?: string })._helperFn;
}

// ---------------------------------------------------------------------------
// Projection function builder
// ---------------------------------------------------------------------------

function buildProjectionFn(
  fnName: string,
  entries: readonly ProjectionEntry[],
  inType: string,
  outType: string,
): string {
  const lowerCtx = { rootVar: "input" };
  const lines: string[] = [`function ${fnName}(input: ${inType}): ${outType} {`];

  const hasSelectAll = entries.some(e => e.kind === "SelectAll");
  const excludes = entries.filter(e => e.kind === "ExcludeField") as ExcludeField[];
  const selects  = entries.filter(e => e.kind === "SelectField")  as SelectField[];
  const computed = entries.filter(e => e.kind === "ComputedField") as ComputedField[];

  if (hasSelectAll && excludes.length > 0 && selects.length === 0 && computed.length === 0) {
    // Exclusion pattern: spread minus excluded fields
    const excluded = excludes.map(e => JSON.stringify(e.field.segments.at(-1)!)).join(", ");
    lines.push(`  const _excluded = new Set([${excluded}]);`);
    lines.push(`  return Object.fromEntries(`);
    lines.push(`    Object.entries(input as Record<string, unknown>).filter(([k]) => !_excluded.has(k))`);
    lines.push(`  ) as ${outType};`);
  } else {
    // Explicit field selection
    const props: string[] = [];

    if (hasSelectAll) {
      props.push(`...(input as Record<string, unknown>)`);
    }

    for (const sf of selects) {
      const src  = lowerFieldPath(sf.field, lowerCtx);
      const key  = sf.alias ?? sf.field.segments.at(-1)!;
      props.push(`${key}: ${src}`);
    }

    for (const cf of computed) {
      props.push(`${cf.alias}: ${lowerExpr(cf.expr, lowerCtx)}`);
    }

    if (props.length === 0) {
      lines.push(`  return input as unknown as ${outType};`);
    } else {
      lines.push(`  return {`);
      for (const p of props) lines.push(`    ${p},`);
      lines.push(`  } as ${outType};`);
    }
  }

  lines.push(`}`);
  return lines.join("\n");
}

function buildStubFn(fnName: string, inType: string, outType: string, rodName: string): string {
  return [
    `function ${fnName}(input: ${inType}): ${outType} {`,
    `  // STRUX-STUB: transform — ${rodName} — expression not lowered`,
    `  throw new Error("not implemented");`,
    `}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Source-specific projection (task 4.10) — accessed from emitTransform via
// checking prefix on the arg when neither FunctionRef nor PortableProjection
// ---------------------------------------------------------------------------

export function sourceSpecificProjection(prefix: string, raw: string): string {
  return sourceSpecificStub(prefix, raw);
}

function toPascal(name: string): string {
  return name.split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join("");
}
