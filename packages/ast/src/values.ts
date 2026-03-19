/**
 * Value expression nodes — the right-hand side of knot assignments.
 *
 * Spec reference: openstrux-spec/specs/core/grammar.md §6
 */

import type { NodeBase, TypePath } from "./common.js";
import type { NarrowedUnion } from "./types.js";
import type { Expression } from "./expressions.js";

// ---------------------------------------------------------------------------
// Value expression — union of all possible values
// ---------------------------------------------------------------------------

export type ValueExpr =
  | LitString
  | LitNumber
  | LitBool
  | LitNull
  | EnvRef
  | SecretRef
  | SourceRef
  | TypePathValue
  | ArrayValue
  | ObjectValue
  | ExpressionValue;

// ---------------------------------------------------------------------------
// Literals
// ---------------------------------------------------------------------------

export interface LitString extends NodeBase {
  readonly kind: "LitString";
  readonly value: string;
}

export interface LitNumber extends NodeBase {
  readonly kind: "LitNumber";
  readonly value: number;
}

export interface LitBool extends NodeBase {
  readonly kind: "LitBool";
  readonly value: boolean;
}

export interface LitNull extends NodeBase {
  readonly kind: "LitNull";
}

// ---------------------------------------------------------------------------
// env("VAR_NAME") — environment variable reference
// ---------------------------------------------------------------------------

export interface EnvRef extends NodeBase {
  readonly kind: "EnvRef";
  readonly varName: string;
}

// ---------------------------------------------------------------------------
// secret_ref { provider: ..., path: ... }
// ---------------------------------------------------------------------------

export interface SecretRef extends NodeBase {
  readonly kind: "SecretRef";
  readonly fields: Record<string, ValueExpr>;
}

// ---------------------------------------------------------------------------
// @name — named source/target reference from strux.context
// ---------------------------------------------------------------------------

export interface SourceRef extends NodeBase {
  readonly kind: "SourceRef";
  /** The alias name (e.g., "production"). */
  readonly alias: string;
  /** Inline field overrides (e.g., { dataset: "eu_users" }). */
  readonly overrides: Record<string, ValueExpr>;
}

// ---------------------------------------------------------------------------
// Type path value — e.g., db.sql.postgres { host: ..., port: ... }
// After resolution, this becomes a NarrowedUnion in the IR.
// ---------------------------------------------------------------------------

export interface TypePathValue extends NodeBase {
  readonly kind: "TypePathValue";
  readonly typePath: TypePath;
  readonly fields: Record<string, ValueExpr>;
  /** Set after type resolution. */
  readonly narrowed?: NarrowedUnion | undefined;
}

// ---------------------------------------------------------------------------
// Compound values
// ---------------------------------------------------------------------------

export interface ArrayValue extends NodeBase {
  readonly kind: "ArrayValue";
  readonly elements: readonly ValueExpr[];
}

export interface ObjectValue extends NodeBase {
  readonly kind: "ObjectValue";
  readonly fields: Record<string, ValueExpr>;
}

// ---------------------------------------------------------------------------
// Expression as value — wraps an expression AST node
// (used when arg.* values contain expression shorthand)
// ---------------------------------------------------------------------------

export interface ExpressionValue extends NodeBase {
  readonly kind: "ExpressionValue";
  readonly expr: Expression;
}
