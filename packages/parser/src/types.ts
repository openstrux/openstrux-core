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
  | { kind: "container"; container: string; args: ParseTypeExpr[] }
  | { kind: "constrained-string"; values: string[] }
  | { kind: "constrained-number"; min: number; max: number };

/** Primitive type names built into the language. */
export const PRIMITIVE_TYPES = new Set([
  "string",
  "number",
  "bool",
  "date",
  "bytes",
]);

// ---------------------------------------------------------------------------
// Field-level persistence annotations (parse-level, v0.6)
// ---------------------------------------------------------------------------

export type ParseReferentialAction = "Cascade" | "SetNull" | "Restrict" | "NoAction";
export type ParsePkDefault = "cuid" | "uuid" | "ulid" | "autoincrement";

export type ParseFieldAnnotation =
  | { readonly kind: "pk";       readonly default?: ParsePkDefault }
  | { readonly kind: "default";  readonly value: "now" | string | number | boolean }
  | { readonly kind: "unique" }
  | { readonly kind: "relation";
      readonly field: string;
      readonly ref: { readonly model: string; readonly field: string };
      readonly onDelete?: ParseReferentialAction;
      readonly onUpdate?: ParseReferentialAction }
  | { readonly kind: "updatedAt" }
  | { readonly kind: "column";   readonly name: string }
  | { readonly kind: "ignore" };

// ---------------------------------------------------------------------------
// Block-level persistence annotations (parse-level, v0.6)
// ---------------------------------------------------------------------------

export type ParseBlockAnnotation =
  | { readonly kind: "index";  readonly fields: string[] }
  | { readonly kind: "unique"; readonly fields: string[] }
  | { readonly kind: "table";  readonly name: string }
  | { readonly kind: "opaque"; readonly content: string };

// ---------------------------------------------------------------------------
// @type — record, enum, union
// ---------------------------------------------------------------------------

export interface FieldDecl {
  readonly name: string;
  readonly type: ParseTypeExpr;
  /** Field-level annotations (e.g. @pk, @relation). Absent or empty when none. */
  readonly annotations?: ParseFieldAnnotation[];
}

export interface RecordNode {
  readonly kind: "record";
  readonly name: string;
  readonly fields: FieldDecl[];
  /** Block-level annotations inside the record body (@@index, @@table, @opaque). */
  readonly blockAnnotations?: ParseBlockAnnotation[];
  /** True when `@external type` modifier is present. */
  readonly external?: boolean;
  /** True when `@timestamps` decorator is present on the @type line. */
  readonly timestamps?: boolean;
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
 * - duration: typed duration literal, e.g. `5m`, `30s`, `24h`, `7d`
 * - path: identifier path (optionally with inline config block),
 *   e.g. `db.sql.postgres { host: "x" }` or just `Proposal`
 * - raw-expr: expression shorthand captured verbatim, e.g. `status == "submitted"`
 * - block: anonymous `{ k: v, ... }` block (used in nested configs)
 */
export type KnotValue =
  | { kind: "string"; value: string }
  | { kind: "number"; value: number }
  | { kind: "bool"; value: boolean }
  | { kind: "duration"; value: number; unit: "s" | "m" | "h" | "d" }
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
  /** Rod-level @ops decorator. Wins over panel @ops in merge cascade. */
  readonly ops?: Record<string, KnotValue> | undefined;
  readonly loc?: NodeLoc | undefined;
}

export interface PanelNode {
  readonly kind: "panel";
  readonly name: string;
  readonly dp?: Record<string, KnotValue> | undefined;
  readonly access?: PanelAccessNode | undefined;
  /** `@privacy { framework: gdpr, dpa_ref?: "..." }` — declares the governing privacy framework. */
  readonly privacy?: Record<string, KnotValue> | undefined;
  readonly rods: RodNode[];
  readonly loc?: NodeLoc | undefined;
}
