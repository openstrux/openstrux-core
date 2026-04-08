/**
 * Expression lowerer — portable expression AST → TypeScript string.
 *
 * Spec reference: openstrux-spec/specs/core/expression-shorthand.md (v0.6.0)
 *
 * Covers all GeneralExpr nodes (PortableFilter + ScalarExpr).
 * FunctionRef and source-specific expressions are handled by each rod emitter
 * since they need to contribute imports or produce statements rather than
 * inline expressions.
 */

import type {
  GeneralExpr,
  PortableFilter,
  CompareExpr,
  MembershipExpr,
  RangeExpr,
  MethodCallExpr,
  FieldRefExpr,
  AndExpr,
  OrExpr,
  NotExpr,
  LiteralExpr,
  ArrayLitExpr,
  ArithmeticExpr,
  TernaryExpr,
  NullCoalesceExpr,
  FnCallExpr,
  LambdaExpr,
  ScalarValue,
  FieldPath,
} from "@openstrux/ast";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface LowerCtx {
  /** Root object variable — field paths are accessed from this. */
  rootVar: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Lower any general expression (filter predicate or scalar value) to a
 * TypeScript expression string. The returned string is suitable for inline
 * use in arrow functions, object properties, and if conditions.
 */
export function lowerExpr(node: GeneralExpr, ctx: LowerCtx): string {
  switch (node.kind) {
    case "CompareExpr":      return lowerCompare(node, ctx);
    case "MembershipExpr":   return lowerMembership(node, ctx);
    case "RangeExpr":        return lowerRange(node, ctx);
    case "AndExpr":          return lowerAnd(node, ctx);
    case "OrExpr":           return lowerOr(node, ctx);
    case "NotExpr":          return lowerNot(node, ctx);
    case "FieldRefExpr":     return lowerFieldRef(node, ctx);
    case "LiteralExpr":      return lowerScalarValue((node as LiteralExpr).value);
    case "ArrayLitExpr":     return lowerArrayLit(node, ctx);
    case "ArithmeticExpr":   return lowerArith(node, ctx);
    case "TernaryExpr":      return lowerTernary(node, ctx);
    case "NullCoalesceExpr": return lowerNullCoalesce(node, ctx);
    case "MethodCallExpr":   return lowerMethodCall(node, ctx);
    case "FnCallExpr":       return lowerFnCall(node, ctx);
    case "LambdaExpr":       return lowerLambda(node, ctx);
    default:
      return `/* STRUX-STUB: unhandled expr kind ${(node as { kind: string }).kind} */`;
  }
}

/** Convenience alias — lowers a portable filter predicate. */
export const lowerFilter = lowerExpr;

// ---------------------------------------------------------------------------
// Field path helpers
// ---------------------------------------------------------------------------

/** Lower a plain FieldPath (no optional chaining) against a root var. */
export function lowerFieldPath(field: FieldPath, ctx: LowerCtx): string {
  return [ctx.rootVar, ...field.segments].join(".");
}

// ---------------------------------------------------------------------------
// Leaf nodes
// ---------------------------------------------------------------------------

/** Lower a ScalarValue to a TypeScript literal. */
export function lowerScalarValue(v: ScalarValue): string {
  switch (v.kind) {
    case "string": return JSON.stringify(v.value);
    case "number": return String(v.value);
    case "bool":   return String(v.value);
    case "null":   return "null";
    case "env":    return `process.env[${JSON.stringify(v.varName)}]`;
  }
}

function lowerFieldRef(node: FieldRefExpr, ctx: LowerCtx): string {
  const allSegs = [ctx.rootVar, ...node.field.segments];
  if (!node.optional) return allSegs.join(".");
  // optional: root.first?.rest?.chain
  return allSegs[0] + "." + allSegs.slice(1).join("?.");
}

// ---------------------------------------------------------------------------
// Boolean / predicate nodes
// ---------------------------------------------------------------------------

function lowerCompare(node: CompareExpr, ctx: LowerCtx): string {
  const left = lowerFieldPath(node.field, ctx);
  const right = lowerScalarValue(node.value);
  const opMap: Record<string, string> = {
    eq: "===", ne: "!==", gt: ">", ge: ">=", lt: "<", le: "<=",
  };
  return `${left} ${opMap[node.op] ?? "==="} ${right}`;
}

function lowerMembership(node: MembershipExpr, ctx: LowerCtx): string {
  const field = lowerFieldPath(node.field, ctx);
  const values = node.values.map(lowerScalarValue).join(", ");
  const check = `[${values}].includes(${field})`;
  return node.negated ? `!(${check})` : check;
}

function lowerRange(node: RangeExpr, ctx: LowerCtx): string {
  const field = lowerFieldPath(node.field, ctx);
  const low = lowerScalarValue(node.low);
  const high = lowerScalarValue(node.high);
  const hiOp = node.halfOpen ? "<" : "<=";
  return `(${field} >= ${low} && ${field} ${hiOp} ${high})`;
}

function lowerAnd(node: AndExpr, ctx: LowerCtx): string {
  return node.operands.map(op => `(${lowerExpr(op, ctx)})`).join(" && ");
}

function lowerOr(node: OrExpr, ctx: LowerCtx): string {
  return node.operands.map(op => `(${lowerExpr(op, ctx)})`).join(" || ");
}

function lowerNot(node: NotExpr, ctx: LowerCtx): string {
  return `!(${lowerExpr(node.operand, ctx)})`;
}

// ---------------------------------------------------------------------------
// Scalar / value nodes
// ---------------------------------------------------------------------------

function lowerArrayLit(node: ArrayLitExpr, ctx: LowerCtx): string {
  return `[${node.elements.map(e => lowerExpr(e, ctx)).join(", ")}]`;
}

function lowerArith(node: ArithmeticExpr, ctx: LowerCtx): string {
  const opMap: Record<string, string> = {
    add: "+", sub: "-", mul: "*", div: "/", mod: "%",
  };
  return `(${lowerExpr(node.left, ctx)} ${opMap[node.op] ?? "+"} ${lowerExpr(node.right, ctx)})`;
}

function lowerTernary(node: TernaryExpr, ctx: LowerCtx): string {
  return `(${lowerExpr(node.condition, ctx)} ? ${lowerExpr(node.then, ctx)} : ${lowerExpr(node.else, ctx)})`;
}

function lowerNullCoalesce(node: NullCoalesceExpr, ctx: LowerCtx): string {
  return `(${lowerExpr(node.left, ctx)} ?? ${lowerExpr(node.right, ctx)})`;
}

function lowerMethodCall(node: MethodCallExpr, ctx: LowerCtx): string {
  const recv = lowerExpr(node.receiver, ctx);
  const args = node.args.map(a => lowerExpr(a, ctx));

  switch (node.method) {
    case "contains":
      return `${recv}.includes(${args.join(", ")})`;
    case "any":
      return `${recv}.some(${args.join(", ")})`;
    case "all":
      return `${recv}.every(${args.join(", ")})`;
    case "matches":
      return `new RegExp(${args[0]}).test(${recv})`;
    case "includesAny":
      return `(${args[0]}).some((v: unknown) => (${recv} as unknown[]).includes(v))`;
    case "includesAll":
      return `(${args[0]}).every((v: unknown) => (${recv} as unknown[]).includes(v))`;
    default:
      return `${recv}.${node.method}(${args.join(", ")})`;
  }
}

function lowerFnCall(node: FnCallExpr, ctx: LowerCtx): string {
  const args = node.args.map(a => lowerExpr(a, ctx));
  return lowerBuiltin(node.fn, args);
}

function lowerLambda(node: LambdaExpr, _ctx: LowerCtx): string {
  // Lambda param becomes the rootVar for the body expression; outer ctx is unused
  const bodyCtx: LowerCtx = { rootVar: node.param };
  return `(${node.param}) => ${lowerExpr(node.body, bodyCtx)}`;
}

// ---------------------------------------------------------------------------
// Built-in function dispatch
// ---------------------------------------------------------------------------

function lowerBuiltin(fn: string, args: string[]): string {
  const unitMs = (u: string) =>
    `(${u} === "days" ? 86400000 : ${u} === "hours" ? 3600000 : ${u} === "minutes" ? 60000 : 1000)`;

  switch (fn) {
    case "env":      return `process.env[${args[0]}]`;
    case "now":      return `new Date()`;
    case "year":     return `new Date(${args[0]}).getFullYear()`;
    case "month":    return `(new Date(${args[0]}).getMonth() + 1)`;
    case "day":      return `new Date(${args[0]}).getDate()`;
    case "hour":     return `new Date(${args[0]}).getHours()`;
    case "abs":      return `Math.abs(${args[0]})`;
    case "round":    return `Math.round(${args[0]})`;
    case "floor":    return `Math.floor(${args[0]})`;
    case "ceil":     return `Math.ceil(${args[0]})`;
    case "pow":      return `Math.pow(${args[0]}, ${args[1]})`;
    case "sqrt":     return `Math.sqrt(${args[0]})`;
    case "int":      return `Math.trunc(Number(${args[0]}))`;
    case "float":    return `Number(${args[0]})`;
    case "str":      return `String(${args[0]})`;
    case "bool":     return `Boolean(${args[0]})`;
    case "coalesce": return `(${args[0]} ?? ${args[1]})`;
    case "len":      return `(${args[0]} as unknown[]).length`;
    case "dateDiff": {
      const unit = args[0] ?? "\"days\"";
      const a    = args[1] ?? "undefined";
      const b    = args[2] ?? "undefined";
      return `Math.floor((new Date(${b}).getTime() - new Date(${a}).getTime()) / ${unitMs(unit)})`;
    }
    case "dateAdd": {
      const unit = args[0] ?? "\"days\"";
      const d    = args[1] ?? "undefined";
      const n    = args[2] ?? "0";
      return `new Date(new Date(${d}).getTime() + ${n} * ${unitMs(unit)})`;
    }
    case "dateTrunc": {
      const unit = args[0] ?? "\"day\"";
      const d    = args[1] ?? "undefined";
      return (
        `(${unit} === "year" ? new Date(new Date(${d}).getFullYear(), 0, 1)` +
        ` : ${unit} === "month" ? new Date(new Date(${d}).getFullYear(), new Date(${d}).getMonth(), 1)` +
        ` : new Date(new Date(${d}).getFullYear(), new Date(${d}).getMonth(), new Date(${d}).getDate()))`
      );
    }
    default:
      return `/* STRUX-STUB: unknown built-in "${fn}" */ (undefined as unknown)`;
  }
}

// ---------------------------------------------------------------------------
// Source-specific pass-through (task 4.10)
// ---------------------------------------------------------------------------

/**
 * Emit a source-specific expression as a commented stub.
 * Used by rod emitters when the expression kind is not portable.
 */
export function sourceSpecificStub(prefix: string, raw: string): string {
  return [
    `// Source-specific (${prefix}): ${raw}`,
    `throw new Error("source-specific expression — manual implementation required");`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// PortableFilter type guard (used by rod emitters)
// ---------------------------------------------------------------------------

const PORTABLE_FILTER_KINDS = new Set([
  "CompareExpr", "MembershipExpr", "RangeExpr",
  "MethodCallExpr", "FieldRefExpr",
  "AndExpr", "OrExpr", "NotExpr",
]);

export function isPortableFilter(node: unknown): node is PortableFilter {
  return (
    typeof node === "object" &&
    node !== null &&
    PORTABLE_FILTER_KINDS.has((node as { kind?: string }).kind ?? "")
  );
}
