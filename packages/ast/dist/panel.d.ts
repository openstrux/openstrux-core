/**
 * Panel and Rod IR nodes — the core pipeline graph representation.
 *
 * Spec reference: openstrux-spec/specs/core/ir.md §Panel Node, §Rod Nodes
 *                 openstrux-spec/specs/core/semantics.md
 *                 openstrux-spec/specs/core/panel-shorthand.md
 *                 openstrux-spec/specs/core/config-inheritance.md
 */
import type { KnotDir, NodeBase, RodType } from "./common.js";
import type { AccessContext } from "./access.js";
import type { Expression } from "./expressions.js";
import type { NarrowedUnion } from "./types.js";
import type { ValueExpr } from "./values.js";
export interface Panel extends NodeBase {
    readonly kind: "Panel";
    readonly name: string;
    /** Resolved @dp metadata (merged from context cascade + panel). */
    readonly dp: DpMetadata;
    /** Resolved AccessContext (merged, narrowing verified). */
    readonly access: AccessContext;
    /** Resolved @ops defaults (merged from context cascade). */
    readonly ops?: OpsConfig | undefined;
    /** Resolved @sec (merged from context cascade). */
    readonly sec?: Record<string, ValueExpr> | undefined;
    /** Ordered rod list (declaration order preserved). */
    readonly rods: readonly Rod[];
    /**
     * Snap graph — all connections between rod knots.
     * Implicit linear chains are resolved to explicit edges.
     */
    readonly snaps: readonly SnapEdge[];
}
export interface Rod extends NodeBase {
    readonly kind: "Rod";
    readonly name: string;
    readonly rodType: RodType;
    /** Resolved cfg knots (union types narrowed). */
    readonly cfg: Record<string, CfgValue>;
    /** Resolved arg knots (expressions compiled to AST). */
    readonly arg: Record<string, ArgValue>;
    /** Per-rod @ops override (merged with panel/context). */
    readonly ops?: OpsConfig | undefined;
    /** Per-rod @sec. */
    readonly sec?: Record<string, ValueExpr> | undefined;
    /** Per-rod @cert — never inherited. */
    readonly cert?: CertMetadata | undefined;
}
/** Cfg knots hold either a plain value or a narrowed union. */
export type CfgValue = ValueExpr | NarrowedUnion;
/** Arg knots hold either a plain value or a compiled expression. */
export type ArgValue = ValueExpr | Expression;
export interface SnapEdge {
    readonly from: QualifiedKnot;
    readonly to: QualifiedKnot;
}
export interface QualifiedKnot {
    readonly rod: string;
    readonly dir: KnotDir;
    readonly knot: string;
}
/** @dp block — GDPR / data protection metadata. */
export interface DpMetadata {
    readonly controller?: string | undefined;
    readonly controllerId?: string | undefined;
    readonly dpo?: string | undefined;
    readonly record?: string | undefined;
    readonly [key: string]: ValueExpr | string | undefined;
}
/** @ops block — operational defaults (retry, timeout, etc.). */
export interface OpsConfig {
    readonly retry?: number | undefined;
    readonly timeout?: string | undefined;
    readonly [key: string]: ValueExpr | string | number | undefined;
}
/** @cert block — certification metadata (per-component, never inherited). */
export interface CertMetadata {
    readonly level?: string | undefined;
    readonly scope?: Record<string, string> | undefined;
    readonly [key: string]: ValueExpr | Record<string, string> | string | undefined;
}
export interface ResolvedContext {
    readonly dp?: DpMetadata | undefined;
    readonly access?: AccessContext | undefined;
    readonly ops?: OpsConfig | undefined;
    readonly sec?: Record<string, ValueExpr> | undefined;
    readonly sources: Record<string, NamedSource>;
    readonly targets: Record<string, NamedSource>;
}
export interface NamedSource {
    readonly alias: string;
    readonly value: NarrowedUnion;
}
//# sourceMappingURL=panel.d.ts.map