/**
 * SymbolTable — Phase 1 pass collecting all @type declarations.
 * Populated from RecordNode, EnumNode, UnionNode in the parse AST.
 */
import type { RecordNode, EnumNode, UnionNode, StruxNode } from "@openstrux/parser";

export type TypeKind = "record" | "enum" | "union";

export interface TypeEntry {
  readonly name: string;
  readonly kind: TypeKind;
  readonly fields: readonly string[]; // field names for records; variant names for enums/unions
  readonly line?: number | undefined;
  readonly col?: number | undefined;
}

export class SymbolTable {
  private readonly table: Map<string, TypeEntry> = new Map();

  /**
   * Populate the symbol table from a parse AST.
   * Phase 1: collect all @type declarations.
   */
  populate(ast: readonly StruxNode[]): void {
    for (const node of ast) {
      if (node.kind === "record") {
        this.addRecord(node);
      } else if (node.kind === "enum") {
        this.addEnum(node);
      } else if (node.kind === "union") {
        this.addUnion(node);
      }
    }
  }

  private addRecord(node: RecordNode): void {
    this.table.set(node.name, {
      name: node.name,
      kind: "record",
      fields: node.fields.map((f) => f.name),
      line: node.loc?.line,
      col: node.loc?.col,
    });
  }

  private addEnum(node: EnumNode): void {
    this.table.set(node.name, {
      name: node.name,
      kind: "enum",
      fields: node.variants,
      line: node.loc?.line,
      col: node.loc?.col,
    });
  }

  private addUnion(node: UnionNode): void {
    this.table.set(node.name, {
      name: node.name,
      kind: "union",
      fields: node.variants.map((v) => v.tag),
      line: node.loc?.line,
      col: node.loc?.col,
    });
  }

  /** Look up a type by name. Returns undefined if not found. */
  lookup(name: string): TypeEntry | undefined {
    return this.table.get(name);
  }

  /** Check if a type name is defined. */
  has(name: string): boolean {
    return this.table.has(name);
  }

  /** All type names. */
  names(): IterableIterator<string> {
    return this.table.keys();
  }
}
