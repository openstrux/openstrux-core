/**
 * Shared base types for all AST/IR nodes.
 *
 * Spec reference: openstrux-spec/specs/core/ir.md
 */

// ---------------------------------------------------------------------------
// Source location (for diagnostics — not preserved in compiled output)
// ---------------------------------------------------------------------------

export interface SourceLocation {
  readonly file: string;
  readonly line: number;
  readonly col: number;
}

export interface SourceSpan {
  readonly start: SourceLocation;
  readonly end: SourceLocation;
}

// ---------------------------------------------------------------------------
// Node kinds — discriminants for the top-level IR node union
// ---------------------------------------------------------------------------

export type TopLevelNodeKind = "TypeRecord" | "TypeEnum" | "TypeUnion" | "Panel";

// ---------------------------------------------------------------------------
// Base interface shared by all IR nodes
// ---------------------------------------------------------------------------

export interface NodeBase {
  /** Discriminant for the node type. */
  readonly kind: string;
  /** Source location for diagnostics. Optional — absent in synthetic nodes. */
  readonly loc?: SourceSpan | undefined;
}

// ---------------------------------------------------------------------------
// Field path — dot-separated access (e.g., address.country)
// ---------------------------------------------------------------------------

export interface FieldPath {
  readonly segments: readonly string[];
}

// ---------------------------------------------------------------------------
// Type path — dot-separated path through a union tree
// (e.g., ["db", "sql", "postgres"])
// ---------------------------------------------------------------------------

export interface TypePath {
  readonly segments: readonly string[];
}

// ---------------------------------------------------------------------------
// 18 basic rod types (spec: modules/rods/overview.md)
// ---------------------------------------------------------------------------

/**
 * The 18 basic rod types built into the language.
 * Custom rod types registered in the Hub use `string` — see {@link RodType}.
 */
export type BasicRodType =
  // I/O — Data
  | "read-data"
  | "write-data"
  // I/O — Service
  | "receive"
  | "respond"
  | "call"
  // Computation
  | "transform"
  | "filter"
  | "group"
  | "aggregate"
  | "merge"
  | "join"
  | "window"
  // Control
  | "guard"
  | "store"
  // Compliance
  | "validate"
  | "pseudonymize"
  | "encrypt"
  // Topology
  | "split";

/**
 * Rod type identifier. Basic rod types get autocomplete; custom rod types
 * registered in the Hub are any string (e.g., "my-org/geocode", "acme/enrich").
 */
export type RodType = BasicRodType | (string & {});

// ---------------------------------------------------------------------------
// Knot direction
// ---------------------------------------------------------------------------

export type KnotDir = "in" | "out" | "err";

// ---------------------------------------------------------------------------
// Primitive types in the type system (spec: grammar.md §2)
// ---------------------------------------------------------------------------

export type BasicPrimitiveTypeName = "string" | "number" | "bool" | "date" | "bytes";
export type PrimitiveTypeName = BasicPrimitiveTypeName | (string & {});

// ---------------------------------------------------------------------------
// Container type kinds (spec: grammar.md §2)
// ---------------------------------------------------------------------------

export type BasicContainerKind = "Optional" | "Batch" | "Map" | "Single" | "Stream";
export type ContainerKind = BasicContainerKind | (string & {});
