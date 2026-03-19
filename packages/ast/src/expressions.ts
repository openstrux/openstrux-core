/**
 * Expression AST nodes — compiled from expression shorthand.
 *
 * Spec reference: openstrux-spec/specs/core/expression-shorthand.md
 *                 openstrux-spec/specs/core/ir.md §Expression AST Nodes
 *                 openstrux-spec/specs/core/grammar.md §7
 */

import type { FieldPath, NodeBase } from "./common.js";

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
  | InListExpr
  | BetweenExpr
  | IsNullExpr
  | LikeExpr
  | ExistsExpr
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

export interface InListExpr extends NodeBase {
  readonly kind: "InListExpr";
  readonly field: FieldPath;
  readonly values: readonly ScalarValue[];
  readonly negated: boolean;
}

export interface BetweenExpr extends NodeBase {
  readonly kind: "BetweenExpr";
  readonly field: FieldPath;
  readonly low: ScalarValue;
  readonly high: ScalarValue;
}

export interface IsNullExpr extends NodeBase {
  readonly kind: "IsNullExpr";
  readonly field: FieldPath;
  readonly negated: boolean;
}

export interface LikeExpr extends NodeBase {
  readonly kind: "LikeExpr";
  readonly field: FieldPath;
  readonly pattern: string;
  readonly negated: boolean;
}

export interface ExistsExpr extends NodeBase {
  readonly kind: "ExistsExpr";
  readonly field: FieldPath;
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
 * Custom filter for custom source-specific expressions.
 * Covers any `prefix: raw_content` not handled by the built-in types above.
 * Pushdown compatibility is determined by matching prefix to source adapter.
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
// Scalar expressions — used in computed fields, CASE WHEN, etc.
// ---------------------------------------------------------------------------

export type ScalarExpr =
  | FieldRefExpr
  | LiteralExpr
  | ArithmeticExpr
  | CoalesceExpr
  | CaseWhenExpr;

export interface FieldRefExpr extends NodeBase {
  readonly kind: "FieldRefExpr";
  readonly field: FieldPath;
}

export interface LiteralExpr extends NodeBase {
  readonly kind: "LiteralExpr";
  readonly value: ScalarValue;
}

export interface ArithmeticExpr extends NodeBase {
  readonly kind: "ArithmeticExpr";
  readonly op: ArithOp;
  readonly left: ScalarExpr;
  readonly right: ScalarExpr;
}

export type ArithOp = "add" | "sub" | "mul" | "div" | "mod";

export interface CoalesceExpr extends NodeBase {
  readonly kind: "CoalesceExpr";
  readonly args: readonly ScalarExpr[];
}

export interface CaseWhenExpr extends NodeBase {
  readonly kind: "CaseWhenExpr";
  readonly branches: readonly CaseWhenBranch[];
  readonly elseExpr: ScalarExpr;
}

export interface CaseWhenBranch {
  readonly when: PortableFilter;
  readonly then: ScalarExpr;
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

/** Built-in aggregation functions. */
export type BasicAggFn =
  | "COUNT"
  | "SUM"
  | "AVG"
  | "MIN"
  | "MAX"
  | "FIRST"
  | "LAST"
  | "COLLECT";

/** Aggregation function — builtins get autocomplete; custom functions allowed. */
export type AggFn = BasicAggFn | (string & {});

export interface SqlAggregation extends NodeBase {
  readonly kind: "SqlAggregation";
  readonly raw: string;
}

/** Custom aggregation for custom source-specific expressions. */
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

export type GroupKeyEntry = FieldGroupKey | FunctionGroupKey;

export interface FieldGroupKey extends NodeBase {
  readonly kind: "FieldGroupKey";
  readonly field: FieldPath;
}

export interface FunctionGroupKey extends NodeBase {
  readonly kind: "FunctionGroupKey";
  readonly fn: string;
  readonly field: FieldPath;
}

/** Custom group key for custom source-specific expressions. */
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

/** Custom join condition for custom source-specific expressions. */
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
  readonly direction: "ASC" | "DESC";
  readonly nulls?: "FIRST" | "LAST" | undefined;
}

export interface SqlSort extends NodeBase {
  readonly kind: "SqlSort";
  readonly raw: string;
}

/** Custom sort for custom source-specific expressions. */
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

export type GuardPolicyExpr =
  | PortablePolicy
  | ExternalPolicyRef
  | FunctionRef;

export type PortablePolicy =
  | ContextCompare
  | HasCheck
  | PolicyAnd
  | PolicyOr
  | PortableFilter;

export type ContextDomain = "principal" | "intent" | "scope" | "element";

export interface ContextCompare extends NodeBase {
  readonly kind: "ContextCompare";
  readonly domain: ContextDomain;
  readonly field: FieldPath;
  readonly op: CompareOp;
  readonly value: ScalarValue;
}

export interface HasCheck extends NodeBase {
  readonly kind: "HasCheck";
  readonly domain: ContextDomain;
  readonly field: FieldPath;
  readonly mode: "HAS" | "HAS_ANY" | "HAS_ALL";
  readonly values: readonly ScalarValue[];
}

export interface PolicyAnd extends NodeBase {
  readonly kind: "PolicyAnd";
  readonly operands: readonly PortablePolicy[];
}

export interface PolicyOr extends NodeBase {
  readonly kind: "PolicyOr";
  readonly operands: readonly PortablePolicy[];
}

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
