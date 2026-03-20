/**
 * @openstrux/parser — parse-level AST node types and diagnostic structures.
 *
 * These are parse-level types, not the fully resolved IR from @openstrux/ast.
 * The validator promotes parse nodes to resolved IR nodes.
 */

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export interface Diagnostic {
  /** Short stable code, e.g. "E001", "W001". */
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
  /** 1-based line number. */
  readonly line: number;
  /** 1-based column. */
  readonly col: number;
  /** Length of the offending token or span. */
  readonly length: number;
}

// ---------------------------------------------------------------------------
// ParseResult
// ---------------------------------------------------------------------------

export type ParseResult = {
  readonly ast: StruxNode[];
  readonly diagnostics: Diagnostic[];
};

// ---------------------------------------------------------------------------
// Source location
// ---------------------------------------------------------------------------

export interface NodeLoc {
  readonly line: number;
  readonly col: number;
}

// ---------------------------------------------------------------------------
// StruxNode — top-level union
// ---------------------------------------------------------------------------

export type StruxNode = RecordNode | EnumNode | UnionNode | PanelNode;

// ---------------------------------------------------------------------------
// Type expressions (parse-level, pre-resolution)
// ---------------------------------------------------------------------------

export type ParseTypeExpr =
  | { kind: "primitive"; name: string }
  | { kind: "named"; name: string }
  | { kind: "container"; container: string; args: ParseTypeExpr[] };

/** Primitive type names built into the language. */
export const PRIMITIVE_TYPES = new Set([
  "string",
  "number",
  "bool",
  "date",
  "bytes",
]);

// ---------------------------------------------------------------------------
// @type — record, enum, union
// ---------------------------------------------------------------------------

export interface FieldDecl {
  readonly name: string;
  readonly type: ParseTypeExpr;
}

export interface RecordNode {
  readonly kind: "record";
  readonly name: string;
  readonly fields: FieldDecl[];
  readonly loc?: NodeLoc | undefined;
}

export interface EnumNode {
  readonly kind: "enum";
  readonly name: string;
  readonly variants: string[];
  readonly loc?: NodeLoc | undefined;
}

export interface UnionVariantDecl {
  readonly tag: string;
  readonly type: ParseTypeExpr;
}

export interface UnionNode {
  readonly kind: "union";
  readonly name: string;
  readonly variants: UnionVariantDecl[];
  readonly loc?: NodeLoc | undefined;
}

// ---------------------------------------------------------------------------
// Knot values
// ---------------------------------------------------------------------------

/**
 * Value of a knot (cfg key, arg key, @dp key, @access key).
 *
 * - string / number / bool: literal values
 * - path: identifier path (optionally with inline config block),
 *   e.g. `db.sql.postgres { host: "x" }` or just `Proposal`
 * - raw-expr: expression shorthand captured verbatim, e.g. `status == "submitted"`
 * - block: anonymous `{ k: v, ... }` block (used in nested configs)
 */
export type KnotValue =
  | { kind: "string"; value: string }
  | { kind: "number"; value: number }
  | { kind: "bool"; value: boolean }
  | { kind: "path"; segments: string[]; config?: Record<string, KnotValue> | undefined }
  | { kind: "raw-expr"; text: string }
  | { kind: "block"; config: Record<string, KnotValue> };

// ---------------------------------------------------------------------------
// @access block
// ---------------------------------------------------------------------------

export interface PanelAccessNode {
  readonly kind: "access";
  readonly fields: Record<string, KnotValue>;
}

// ---------------------------------------------------------------------------
// @panel — panel and rod nodes
// ---------------------------------------------------------------------------

export interface RodNode {
  readonly kind: "rod";
  readonly name: string;
  readonly rodType: string;
  readonly knots: Record<string, KnotValue>;
  readonly loc?: NodeLoc | undefined;
}

export interface PanelNode {
  readonly kind: "panel";
  readonly name: string;
  readonly dp?: Record<string, KnotValue> | undefined;
  readonly access?: PanelAccessNode | undefined;
  readonly rods: RodNode[];
  readonly loc?: NodeLoc | undefined;
}
