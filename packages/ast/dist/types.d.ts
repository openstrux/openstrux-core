/**
 * Type system IR nodes: records, enums, unions, and type references.
 *
 * Spec reference: openstrux-spec/specs/core/type-system.md
 *                 openstrux-spec/specs/core/ir.md §Type Nodes
 *                 openstrux-spec/specs/core/grammar.md §2
 */
import type { ContainerKind, NodeBase, PrimitiveTypeName, TypePath } from "./common.js";
export type TypeExpr = PrimitiveType | ContainerType | ConstrainedNumberType | ConstrainedStringType | TypeRef;
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
export interface FieldDecl {
    readonly name: string;
    readonly type: TypeExpr;
}
export interface TypeRecord extends NodeBase {
    readonly kind: "TypeRecord";
    readonly name: string;
    readonly fields: readonly FieldDecl[];
}
export interface TypeEnum extends NodeBase {
    readonly kind: "TypeEnum";
    readonly name: string;
    readonly variants: readonly string[];
}
export interface UnionVariant {
    readonly tag: string;
    readonly type: TypeExpr;
}
export interface TypeUnion extends NodeBase {
    readonly kind: "TypeUnion";
    readonly name: string;
    readonly variants: readonly UnionVariant[];
}
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
import type { ValueExpr } from "./values.js";
export type { ValueExpr as ValueExprRef };
export type TypeDef = TypeRecord | TypeEnum | TypeUnion;
//# sourceMappingURL=types.d.ts.map