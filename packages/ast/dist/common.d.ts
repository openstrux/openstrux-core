/**
 * Shared base types for all AST/IR nodes.
 *
 * Spec reference: openstrux-spec/specs/core/ir.md
 */
export interface SourceLocation {
    readonly file: string;
    readonly line: number;
    readonly col: number;
}
export interface SourceSpan {
    readonly start: SourceLocation;
    readonly end: SourceLocation;
}
export type TopLevelNodeKind = "TypeRecord" | "TypeEnum" | "TypeUnion" | "Panel";
export interface NodeBase {
    /** Discriminant for the node type. */
    readonly kind: string;
    /** Source location for diagnostics. Optional — absent in synthetic nodes. */
    readonly loc?: SourceSpan | undefined;
}
export interface FieldPath {
    readonly segments: readonly string[];
}
export interface TypePath {
    readonly segments: readonly string[];
}
/**
 * The 18 basic rod types built into the language.
 * Custom rod types registered in the Hub use `string` — see {@link RodType}.
 */
export type BasicRodType = "read-data" | "write-data" | "receive" | "respond" | "call" | "transform" | "filter" | "group" | "aggregate" | "merge" | "join" | "window" | "guard" | "store" | "validate" | "pseudonymize" | "encrypt" | "split";
/**
 * Rod type identifier. Basic rod types get autocomplete; custom rod types
 * registered in the Hub are any string (e.g., "my-org/geocode", "acme/enrich").
 */
export type RodType = BasicRodType | (string & {});
export type KnotDir = "in" | "out" | "err";
export type BasicPrimitiveTypeName = "string" | "number" | "bool" | "date" | "bytes";
export type PrimitiveTypeName = BasicPrimitiveTypeName | (string & {});
export type BasicContainerKind = "Optional" | "Batch" | "Map" | "Single" | "Stream";
export type ContainerKind = BasicContainerKind | (string & {});
//# sourceMappingURL=common.d.ts.map