/**
 * Expression AST nodes — compiled from expression shorthand.
 *
 * Spec reference: openstrux-spec/specs/core/expression-shorthand.md (v0.6.0)
 *                 openstrux-spec/specs/core/ir.md §Expression AST Nodes
 *
 * v0.6.0: Unified C-family expression grammar. SQL-ism nodes (BetweenExpr,
 * IsNullExpr, LikeExpr, ExistsExpr, HasCheck, CaseWhenExpr) replaced by
 * general expression nodes (RangeExpr, MembershipExpr, MethodCallExpr,
 * TernaryExpr). All syntax normalized by the synonym-normalizer before parsing.
 */

import type { FieldPath, NodeBase } from "./common.js";

// ===================================================================
// General expression — union of predicate and value forms
// ===================================================================

/**
 * Union covering both predicate (boolean) and value expression nodes.
 * Used for lambda bodies and method/function call args that accept either.
 */
export type GeneralExpr = PortableFilter | ScalarExpr;

// ===================================================================
// Top-level expression union
// ===================================================================

export type Expression =
  | FilterExpr
  | ProjectionExpr
  | AggregationExpr
  | GroupKeyExpr
  | JoinCondExpr
  | SortExpr
  | SplitRoutesExpr
  | GuardPolicyExpr;

// ===================================================================
// 1. Filter expressions (arg.predicate)
// ===================================================================

export type FilterExpr =
  | PortableFilter
  | SqlFilter
  | MongoFilter
  | KafkaFilter
  | CustomFilter
  | FunctionRef;

// ---------------------------------------------------------------------------
// Portable filter — pushable to any source
// ---------------------------------------------------------------------------

export type PortableFilter =
  | CompareExpr
  | MembershipExpr
  | RangeExpr
  | MethodCallExpr
  | FieldRefExpr
  | AndExpr
  | OrExpr
  | NotExpr;

export interface CompareExpr extends NodeBase {
  readonly kind: "CompareExpr";
  readonly field: FieldPath;
  readonly op: CompareOp;
  readonly value: ScalarValue;
}

export type CompareOp = "eq" | "ne" | "gt" | "ge" | "lt" | "le";

/** `field in [a, b, c]` or `field !in [a, b, c]` */
export interface MembershipExpr extends NodeBase {
  readonly kind: "MembershipExpr";
  readonly field: FieldPath;
  readonly values: readonly ScalarValue[];
  readonly negated: boolean;
}

/** `field in low..high` (inclusive) or `field in low..<high` (half-open) */
export interface RangeExpr extends NodeBase {
  readonly kind: "RangeExpr";
  readonly field: FieldPath;
  readonly low: ScalarValue;
  readonly high: ScalarValue;
  /** false = `..` inclusive both ends; true = `..<` inclusive low, exclusive high */
  readonly halfOpen: boolean;
}

/**
 * Method call on a value: `receiver.method(args)`.
 * Appears in both PortableFilter (boolean-returning methods like .endsWith(), .includes())
 * and ScalarExpr (value-returning methods like .upper(), .replace()).
 */
export interface MethodCallExpr extends NodeBase {
  readonly kind: "MethodCallExpr";
  readonly receiver: ScalarExpr;
  readonly method: string;
  readonly args: readonly GeneralExpr[];
}

/** Bare boolean field reference used as a predicate (e.g. `!archived`) */
export interface FieldRefExpr extends NodeBase {
  readonly kind: "FieldRefExpr";
  readonly field: FieldPath;
  /** True when accessed via `?.` — `address?.country` */
  readonly optional: boolean;
}

export interface AndExpr extends NodeBase {
  readonly kind: "AndExpr";
  readonly operands: readonly PortableFilter[];
}

export interface OrExpr extends NodeBase {
  readonly kind: "OrExpr";
  readonly operands: readonly PortableFilter[];
}

export interface NotExpr extends NodeBase {
  readonly kind: "NotExpr";
  readonly operand: PortableFilter;
}

// ---------------------------------------------------------------------------
// Source-specific filters — pushable to matching source only
// ---------------------------------------------------------------------------

export interface SqlFilter extends NodeBase {
  readonly kind: "SqlFilter";
  /** If the SQL expression is also portable, the portable form is here. */
  readonly portable?: PortableFilter | undefined;
  /** Raw SQL clause (when not portable). */
  readonly raw?: string | undefined;
}

export interface MongoFilter extends NodeBase {
  readonly kind: "MongoFilter";
  readonly query: string;
}

export interface KafkaFilter extends NodeBase {
  readonly kind: "KafkaFilter";
  readonly clause: string;
}

/**
 * Custom filter for source-specific expressions not covered by built-in types.
 * Covers any `prefix: raw_content` not handled by SqlFilter/MongoFilter/KafkaFilter.
 */
export interface CustomFilter extends NodeBase {
  readonly kind: "CustomFilter";
  readonly prefix: string;
  readonly raw: string;
}

// ---------------------------------------------------------------------------
// Function reference — no pushdown
// ---------------------------------------------------------------------------

export interface FunctionRef extends NodeBase {
  readonly kind: "FunctionRef";
  readonly module: string;
  readonly fn: string;
}

// ===================================================================
// 2. Projection expressions (arg.fields)
// ===================================================================

export type ProjectionExpr = PortableProjection | FunctionRef;

export interface PortableProjection extends NodeBase {
  readonly kind: "PortableProjection";
  readonly entries: readonly ProjectionEntry[];
}

export type ProjectionEntry =
  | SelectAll
  | ExcludeField
  | SelectField
  | ComputedField;

export interface SelectAll extends NodeBase {
  readonly kind: "SelectAll";
}

export interface ExcludeField extends NodeBase {
  readonly kind: "ExcludeField";
  readonly field: FieldPath;
}

export interface SelectField extends NodeBase {
  readonly kind: "SelectField";
  readonly field: FieldPath;
  readonly alias?: string | undefined;
}

export interface ComputedField extends NodeBase {
  readonly kind: "ComputedField";
  readonly expr: ScalarExpr;
  readonly alias: string;
}

// ---------------------------------------------------------------------------
// Scalar expressions — used in computed fields, ternary arms, method args, etc.
// ---------------------------------------------------------------------------

export type ScalarExpr =
  | FieldRefExpr
  | LiteralExpr
  | ArrayLitExpr
  | ArithmeticExpr
  | TernaryExpr
  | NullCoalesceExpr
  | MethodCallExpr
  | FnCallExpr
  | LambdaExpr;

export interface LiteralExpr extends NodeBase {
  readonly kind: "LiteralExpr";
  readonly value: ScalarValue;
}

/** Array literal `[expr, expr, ...]` */
export interface ArrayLitExpr extends NodeBase {
  readonly kind: "ArrayLitExpr";
  readonly elements: readonly ScalarExpr[];
}

export interface ArithmeticExpr extends NodeBase {
  readonly kind: "ArithmeticExpr";
  readonly op: ArithOp;
  readonly left: ScalarExpr;
  readonly right: ScalarExpr;
}

export type ArithOp = "add" | "sub" | "mul" | "div" | "mod";

/** `condition ? thenExpr : elseExpr` */
export interface TernaryExpr extends NodeBase {
  readonly kind: "TernaryExpr";
  readonly condition: PortableFilter;
  readonly then: ScalarExpr;
  readonly else: ScalarExpr;
}

/** `left ?? right` — returns left if non-null, else right */
export interface NullCoalesceExpr extends NodeBase {
  readonly kind: "NullCoalesceExpr";
  readonly left: ScalarExpr;
  readonly right: ScalarExpr;
}

/**
 * Built-in function call: `year(created_at)`, `dateDiff("days", a, b)`, etc.
 * Distinct from MethodCallExpr (which has a receiver object).
 */
export interface FnCallExpr extends NodeBase {
  readonly kind: "FnCallExpr";
  readonly fn: string;
  readonly args: readonly ScalarExpr[];
}

/**
 * Lambda expression `param => body` used in collection methods:
 * `tags.any(t => t.priority > 3)`.
 */
export interface LambdaExpr extends NodeBase {
  readonly kind: "LambdaExpr";
  readonly param: string;
  /** Body may be a predicate (boolean) or a scalar value. */
  readonly body: GeneralExpr;
}

// ===================================================================
// 3. Aggregation expressions (arg.fn)
// ===================================================================

export type AggregationExpr = PortableAggregation | SqlAggregation | CustomAggregation | FunctionRef;

export interface PortableAggregation extends NodeBase {
  readonly kind: "PortableAggregation";
  readonly fns: readonly AggCall[];
}

export interface AggCall {
  readonly fn: AggFn;
  readonly field: FieldPath | null;
  readonly distinct: boolean;
  readonly alias?: string | undefined;
}

/** Built-in aggregation functions — canonical lowercase form. */
export type BasicAggFn =
  | "count"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "first"
  | "last"
  | "collect";

/** Aggregation function — builtins get autocomplete; custom functions allowed. */
export type AggFn = BasicAggFn | (string & {});

export interface SqlAggregation extends NodeBase {
  readonly kind: "SqlAggregation";
  readonly raw: string;
}

export interface CustomAggregation extends NodeBase {
  readonly kind: "CustomAggregation";
  readonly prefix: string;
  readonly raw: string;
}

// ===================================================================
// 4. Group key expressions (arg.key)
// ===================================================================

export type GroupKeyExpr = PortableGroupKey | CustomGroupKey | FunctionRef;

export interface PortableGroupKey extends NodeBase {
  readonly kind: "PortableGroupKey";
  readonly keys: readonly GroupKeyEntry[];
}

export type GroupKeyEntry = FieldGroupKey | ComputedGroupKey;

export interface FieldGroupKey extends NodeBase {
  readonly kind: "FieldGroupKey";
  readonly field: FieldPath;
}

/** Computed group key: `year(created_at)`, `dateTrunc("month", ts)`, etc. */
export interface ComputedGroupKey extends NodeBase {
  readonly kind: "ComputedGroupKey";
  readonly expr: ScalarExpr;
}

export interface CustomGroupKey extends NodeBase {
  readonly kind: "CustomGroupKey";
  readonly prefix: string;
  readonly raw: string;
}

// ===================================================================
// 5. Join condition expressions (arg.on)
// ===================================================================

export type JoinCondExpr = PortableJoinCond | CustomJoinCond | FunctionRef;

export interface PortableJoinCond extends NodeBase {
  readonly kind: "PortableJoinCond";
  readonly matches: readonly KeyMatch[];
}

export interface KeyMatch {
  readonly left: FieldPath;
  readonly right: FieldPath;
}

export interface CustomJoinCond extends NodeBase {
  readonly kind: "CustomJoinCond";
  readonly prefix: string;
  readonly raw: string;
}

// ===================================================================
// 6. Sort expressions (arg.order)
// ===================================================================

export type SortExpr = PortableSort | SqlSort | CustomSort;

export interface PortableSort extends NodeBase {
  readonly kind: "PortableSort";
  readonly fields: readonly SortField[];
}

export interface SortField {
  readonly field: FieldPath;
  /** Canonical lowercase form. */
  readonly direction: "asc" | "desc";
  readonly nulls?: "first" | "last" | undefined;
}

export interface SqlSort extends NodeBase {
  readonly kind: "SqlSort";
  readonly raw: string;
}

export interface CustomSort extends NodeBase {
  readonly kind: "CustomSort";
  readonly prefix: string;
  readonly raw: string;
}

// ===================================================================
// 7. Split route expressions (arg.routes)
// ===================================================================

export interface SplitRoutesExpr extends NodeBase {
  readonly kind: "SplitRoutesExpr";
  readonly routes: readonly RouteEntry[];
}

export interface RouteEntry {
  readonly name: string;
  /** null = default route (*). */
  readonly predicate: PortableFilter | null;
}

// ===================================================================
// 8. Guard policy expressions (arg.policy)
// ===================================================================

/**
 * Guard policy uses the same grammar as portable filter.
 * Context references (principal.*, intent.*, element.*, scope.*) are
 * represented as FieldRefExpr/CompareExpr with field paths that start
 * with the context domain name. The validator/audit layer identifies
 * context references by inspecting the leading path segment.
 */
export type GuardPolicyExpr =
  | PortableFilter
  | ExternalPolicyRef
  | FunctionRef;

/** Shorthand alias — guard policy IS a portable filter at the AST level. */
export type PortablePolicy = PortableFilter;

/** Built-in policy engine prefixes. */
export type BasicPolicyEngine = "opa" | "cedar";

/** Policy engine — builtins get autocomplete; custom engines allowed. */
export type PolicyEngine = BasicPolicyEngine | (string & {});

export interface ExternalPolicyRef extends NodeBase {
  readonly kind: "ExternalPolicyRef";
  readonly engine: PolicyEngine;
  readonly ref: string;
}

// ===================================================================
// Scalar value — leaf values in expressions
// ===================================================================

export type ScalarValue =
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "bool"; readonly value: boolean }
  | { readonly kind: "null" }
  | { readonly kind: "env"; readonly varName: string };
