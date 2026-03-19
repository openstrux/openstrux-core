/**
 * Value expression nodes — the right-hand side of knot assignments.
 *
 * Spec reference: openstrux-spec/specs/core/grammar.md §6
 */
import type { NodeBase, TypePath } from "./common.js";
import type { NarrowedUnion } from "./types.js";
import type { Expression } from "./expressions.js";
export type ValueExpr = LitString | LitNumber | LitBool | LitNull | EnvRef | SecretRef | SourceRef | TypePathValue | ArrayValue | ObjectValue | ExpressionValue;
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
export interface EnvRef extends NodeBase {
    readonly kind: "EnvRef";
    readonly varName: string;
}
export interface SecretRef extends NodeBase {
    readonly kind: "SecretRef";
    readonly fields: Record<string, ValueExpr>;
}
export interface SourceRef extends NodeBase {
    readonly kind: "SourceRef";
    /** The alias name (e.g., "production"). */
    readonly alias: string;
    /** Inline field overrides (e.g., { dataset: "eu_users" }). */
    readonly overrides: Record<string, ValueExpr>;
}
export interface TypePathValue extends NodeBase {
    readonly kind: "TypePathValue";
    readonly typePath: TypePath;
    readonly fields: Record<string, ValueExpr>;
    /** Set after type resolution. */
    readonly narrowed?: NarrowedUnion | undefined;
}
export interface ArrayValue extends NodeBase {
    readonly kind: "ArrayValue";
    readonly elements: readonly ValueExpr[];
}
export interface ObjectValue extends NodeBase {
    readonly kind: "ObjectValue";
    readonly fields: Record<string, ValueExpr>;
}
export interface ExpressionValue extends NodeBase {
    readonly kind: "ExpressionValue";
    readonly expr: Expression;
}
//# sourceMappingURL=values.d.ts.map