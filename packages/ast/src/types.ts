/**
 * Type system IR nodes: records, enums, unions, and type references.
 *
 * Spec reference: openstrux-spec/specs/core/type-system.md
 *                 openstrux-spec/specs/core/ir.md §Type Nodes
 *                 openstrux-spec/specs/core/grammar.md §2
 */

import type {
  ContainerKind,
  NodeBase,
  PrimitiveTypeName,
  TypePath,
} from "./common.js";

// ---------------------------------------------------------------------------
// Type expression — the resolved type of a field or knot
// ---------------------------------------------------------------------------

export type TypeExpr =
  | PrimitiveType
  | ContainerType
  | ConstrainedNumberType
  | ConstrainedStringType
  | TypeRef;

export interface PrimitiveType extends NodeBase {
  readonly kind: "PrimitiveType";
  readonly name: PrimitiveTypeName;
}

export interface ContainerType extends NodeBase {
  readonly kind: "ContainerType";
  readonly container: ContainerKind;
  readonly typeArgs: readonly TypeExpr[];
}

/** `number[0..100]` — numeric range constraint. */
export interface ConstrainedNumberType extends NodeBase {
  readonly kind: "ConstrainedNumberType";
  readonly min: number;
  readonly max: number;
}

/** `string["a", "b", "c"]` — string enum constraint. */
export interface ConstrainedStringType extends NodeBase {
  readonly kind: "ConstrainedStringType";
  readonly values: readonly string[];
}

/** Reference to a user-defined type by name. Resolved before IR. */
export interface TypeRef extends NodeBase {
  readonly kind: "TypeRef";
  readonly name: string;
}

// ---------------------------------------------------------------------------
// Record fields
// ---------------------------------------------------------------------------

export interface FieldDecl {
  readonly name: string;
  readonly type: TypeExpr;
}

// ---------------------------------------------------------------------------
// IR Node: TypeRecord — @type Name { ... }
// ---------------------------------------------------------------------------

export interface TypeRecord extends NodeBase {
  readonly kind: "TypeRecord";
  readonly name: string;
  readonly fields: readonly FieldDecl[];
}

// ---------------------------------------------------------------------------
// IR Node: TypeEnum — @type Name = enum { ... }
// ---------------------------------------------------------------------------

export interface TypeEnum extends NodeBase {
  readonly kind: "TypeEnum";
  readonly name: string;
  readonly variants: readonly string[];
}

// ---------------------------------------------------------------------------
// IR Node: TypeUnion — @type Name = union { ... }
// ---------------------------------------------------------------------------

export interface UnionVariant {
  readonly tag: string;
  readonly type: TypeExpr;
}

export interface TypeUnion extends NodeBase {
  readonly kind: "TypeUnion";
  readonly name: string;
  readonly variants: readonly UnionVariant[];
}

// ---------------------------------------------------------------------------
// Narrowed union — records type path resolution in the IR
// (spec: ir.md §Union Narrowing)
// ---------------------------------------------------------------------------

export interface NarrowedUnion {
  /** Root union type name (e.g., "DataSource"). */
  readonly rootType: string;
  /** Path through the union tree (e.g., ["db", "sql", "postgres"]). */
  readonly path: TypePath;
  /** Leaf type name after narrowing (e.g., "PostgresConfig"). */
  readonly resolvedType: string;
  /** Concrete config values for the leaf type. */
  readonly value: Record<string, ValueExpr>;
}

// Forward reference — defined in values.ts, re-exported here for convenience.
import type { ValueExpr } from "./values.js";
export type { ValueExpr as ValueExprRef };

// ---------------------------------------------------------------------------
// All type definition nodes
// ---------------------------------------------------------------------------

export type TypeDef = TypeRecord | TypeEnum | TypeUnion;
