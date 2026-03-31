/**
 * @openstrux/parser — recursive-descent parser
 *
 * Consumes a Token[] from the lexer and produces a ParseResult.
 * Never throws — all errors are recorded as Diagnostic entries.
 *
 * Error recovery: on a syntax error the parser skips tokens until the next
 * NEWLINE, RBRACE, or EOF (skip-to-next-statement).
 */

import { tokenize, TokenType } from "./lexer.js";
import type { Token } from "./lexer.js";
import {
  PRIMITIVE_TYPES,
  type Diagnostic,
  type EnumNode,
  type FieldDecl,
  type KnotValue,
  type NodeLoc,
  type PanelAccessNode,
  type PanelNode,
  type ParseResult,
  type ParseTypeExpr,
  type RecordNode,
  type RodNode,
  type StruxNode,
  type UnionNode,
  type UnionVariantDecl,
} from "./types.js";

// ---------------------------------------------------------------------------
// Known rod types (spec: openstrux-spec/specs/core/syntax-reference.md)
// ---------------------------------------------------------------------------

const KNOWN_ROD_TYPES = new Set<string>([
  // Basic rods (18)
  "read-data", "write-data",
  "receive", "respond", "call",
  "transform", "filter", "group", "aggregate", "merge", "join", "window",
  "guard", "store",
  "validate", "pseudonymize", "encrypt",
  "split",
  // Standard rods (spec: modules/rods/standard/)
  "private-data",
]);

// ---------------------------------------------------------------------------
// Parser class
// ---------------------------------------------------------------------------

export class Parser {
  private readonly tokens: Token[];
  private cursor: number = 0;
  private readonly diagnostics: Diagnostic[] = [];
  private readonly source: string;

  constructor(source: string) {
    this.source = source;
    this.tokens = tokenize(source);
  }

  // ---- token cursor helpers ----

  peek(offset = 0): Token {
    const idx = this.cursor + offset;
    return this.tokens[idx] ?? this.eofToken();
  }

  private eofToken(): Token {
    const last = this.tokens[this.tokens.length - 1];
    return last ?? { type: TokenType.EOF, value: "", line: 1, col: 1, length: 0, offset: 0 };
  }

  consume(): Token {
    const tok = this.peek();
    if (tok.type !== TokenType.EOF) this.cursor++;
    return tok;
  }

  /** Consume if the next token matches `type`; otherwise add diagnostic and return null. */
  expect(type: TokenType, context?: string): Token | null {
    const tok = this.peek();
    if (tok.type === type) {
      return this.consume();
    }
    this.addError(
      "E000",
      `Expected ${type}${context ? ` ${context}` : ""} but got ${tok.type} (${JSON.stringify(tok.value)})`,
      tok,
    );
    return null;
  }

  /** Skip tokens until NEWLINE, RBRACE, or EOF (error recovery). */
  recover(): void {
    while (true) {
      const tok = this.peek();
      if (
        tok.type === TokenType.EOF ||
        tok.type === TokenType.NEWLINE ||
        tok.type === TokenType.RBRACE
      ) {
        break;
      }
      this.consume();
    }
  }

  private addError(code: string, message: string, tok: Token): void {
    this.diagnostics.push({
      code,
      message,
      severity: "error",
      line: tok.line,
      col: tok.col,
      length: tok.length > 0 ? tok.length : 1,
    });
  }

  private addWarning(code: string, message: string, tok: Token): void {
    this.diagnostics.push({
      code,
      message,
      severity: "warning",
      line: tok.line,
      col: tok.col,
      length: tok.length > 0 ? tok.length : 1,
    });
  }

  private loc(tok: Token): NodeLoc {
    return { line: tok.line, col: tok.col };
  }

  // ---- skip NEWLINEs ----
  private skipNewlines(): void {
    while (this.peek().type === TokenType.NEWLINE) this.consume();
  }

  // -------------------------------------------------------------------------
  // parseFile — top-level dispatcher
  // -------------------------------------------------------------------------

  parseFile(): ParseResult {
    const ast: StruxNode[] = [];

    while (this.peek().type !== TokenType.EOF) {
      const tok = this.peek();

      if (tok.type === TokenType.AT_TYPE) {
        const node = this.parseTypeDecl();
        if (node !== null) ast.push(node);
      } else if (tok.type === TokenType.AT_PANEL) {
        const node = this.parsePanel();
        if (node !== null) ast.push(node);
      } else if (tok.type === TokenType.AT_CONTEXT) {
        // @context blocks — skip the whole block for v0.6.0
        this.consume(); // consume @context
        this.consume(); // consume name
        if (this.peek().type === TokenType.LBRACE) {
          this.skipBlock();
        }
      } else if (tok.type === TokenType.NEWLINE) {
        this.consume();
      } else {
        // Unknown top-level token — consume it first to guarantee progress, then recover
        this.consume();
        this.addError("E000", `Unexpected token at top level: ${JSON.stringify(tok.value)}`, tok);
        this.recover();
        if (this.peek().type === TokenType.NEWLINE) this.consume();
      }
    }

    return { ast, diagnostics: this.diagnostics };
  }

  // -------------------------------------------------------------------------
  // @type declarations
  // -------------------------------------------------------------------------

  private parseTypeDecl(): RecordNode | EnumNode | UnionNode | null {
    const atTok = this.consume(); // consume @type
    const nameTok = this.peek();
    if (nameTok.type !== TokenType.IDENT) {
      this.addError("E000", "Expected type name after @type", atTok);
      this.recover();
      return null;
    }
    this.consume(); // consume name
    const name = nameTok.value;

    if (this.peek().type === TokenType.LBRACE) {
      return this.parseRecord(name, this.loc(atTok));
    } else if (this.peek().type === TokenType.EQUALS) {
      this.consume(); // consume =
      const kw = this.peek();
      if (kw.type === TokenType.IDENT && kw.value === "enum") {
        return this.parseEnum(name, this.loc(atTok));
      } else if (kw.type === TokenType.IDENT && kw.value === "union") {
        return this.parseUnion(name, this.loc(atTok));
      } else {
        this.addError("E000", `Expected 'enum' or 'union' after '=' in @type declaration, got ${JSON.stringify(kw.value)}`, kw);
        this.recover();
        return null;
      }
    } else {
      this.addError("E000", `Expected '{' or '=' after type name '${name}'`, this.peek());
      this.recover();
      return null;
    }
  }

  /** Parse `{ field: Type, ... }` record body (assumes @type Name already consumed). */
  private parseRecord(name: string, loc: NodeLoc): RecordNode | null {
    const lbrace = this.expect(TokenType.LBRACE, "opening '{' of record");
    if (lbrace === null) return null;

    const fields: FieldDecl[] = [];

    while (this.peek().type !== TokenType.RBRACE && this.peek().type !== TokenType.EOF) {
      this.skipNewlines();
      if (this.peek().type === TokenType.RBRACE || this.peek().type === TokenType.EOF) break;

      const fieldTok = this.peek();
      if (fieldTok.type !== TokenType.IDENT) {
        this.addError("E000", `Expected field name, got ${JSON.stringify(fieldTok.value)}`, fieldTok);
        this.recover();
        continue;
      }
      this.consume(); // consume field name
      const fieldName = fieldTok.value;

      if (this.expect(TokenType.COLON, `':' after field '${fieldName}'`) === null) {
        this.recover();
        continue;
      }

      const typeExpr = this.parseTypeExpr();
      if (typeExpr === null) {
        this.recover();
        continue;
      }
      fields.push({ name: fieldName, type: typeExpr });

      // Allow comma or newline as separator
      if (this.peek().type === TokenType.COMMA) this.consume();
      this.skipNewlines();
    }

    const rbraceTok = this.peek();
    if (this.expect(TokenType.RBRACE, "closing '}' of record") === null) {
      this.addError("E001", `Unclosed '{' in record type '${name}'`, rbraceTok);
      return null;
    }

    return { kind: "record", name, fields, loc };
  }

  /** Parse `enum { val1, val2 }` (assumes @type Name = already consumed). */
  private parseEnum(name: string, loc: NodeLoc): EnumNode | null {
    this.consume(); // consume 'enum'
    const lbrace = this.expect(TokenType.LBRACE, "'{' after enum");
    if (lbrace === null) return null;

    const variants: string[] = [];

    while (this.peek().type !== TokenType.RBRACE && this.peek().type !== TokenType.EOF) {
      this.skipNewlines();
      if (this.peek().type === TokenType.RBRACE || this.peek().type === TokenType.EOF) break;

      const vTok = this.peek();
      if (vTok.type !== TokenType.IDENT) {
        this.addError("E000", `Expected enum variant name, got ${JSON.stringify(vTok.value)}`, vTok);
        this.recover();
        break;
      }
      this.consume();
      variants.push(vTok.value);

      if (this.peek().type === TokenType.COMMA) this.consume();
      this.skipNewlines();
    }

    const rbraceTok = this.peek();
    if (this.expect(TokenType.RBRACE, "closing '}' of enum") === null) {
      this.addError("E001", `Unclosed '{' in enum type '${name}'`, rbraceTok);
      return null;
    }

    return { kind: "enum", name, variants, loc };
  }

  /** Parse `union { tag: Type, ... }` (assumes @type Name = already consumed). */
  private parseUnion(name: string, loc: NodeLoc): UnionNode | null {
    this.consume(); // consume 'union'
    const lbrace = this.expect(TokenType.LBRACE, "'{' after union");
    if (lbrace === null) return null;

    const variants: UnionVariantDecl[] = [];

    while (this.peek().type !== TokenType.RBRACE && this.peek().type !== TokenType.EOF) {
      this.skipNewlines();
      if (this.peek().type === TokenType.RBRACE || this.peek().type === TokenType.EOF) break;

      const tagTok = this.peek();
      if (tagTok.type !== TokenType.IDENT) {
        this.addError("E000", `Expected union variant tag, got ${JSON.stringify(tagTok.value)}`, tagTok);
        this.recover();
        break;
      }
      this.consume();
      const tag = tagTok.value;

      if (this.expect(TokenType.COLON, `':' after union variant '${tag}'`) === null) {
        this.recover();
        continue;
      }

      const typeExpr = this.parseTypeExpr();
      if (typeExpr === null) {
        this.recover();
        continue;
      }
      variants.push({ tag, type: typeExpr });

      if (this.peek().type === TokenType.COMMA) this.consume();
      this.skipNewlines();
    }

    const rbraceTok = this.peek();
    if (this.expect(TokenType.RBRACE, "closing '}' of union") === null) {
      this.addError("E001", `Unclosed '{' in union type '${name}'`, rbraceTok);
      return null;
    }

    return { kind: "union", name, variants, loc };
  }

  /** Parse a type expression: `string`, `Optional<T>`, `Map<K,V>`, `MyType`. */
  private parseTypeExpr(): ParseTypeExpr | null {
    const tok = this.peek();
    if (tok.type !== TokenType.IDENT) {
      this.addError("E000", `Expected type expression, got ${JSON.stringify(tok.value)}`, tok);
      return null;
    }
    this.consume();
    const name = tok.value;

    if (this.peek().type === TokenType.LANGLE) {
      // Container type: Optional<T>, Batch<T>, Map<K,V>, etc.
      this.consume(); // consume <
      const args: ParseTypeExpr[] = [];
      while (this.peek().type !== TokenType.RANGLE && this.peek().type !== TokenType.EOF) {
        const arg = this.parseTypeExpr();
        if (arg === null) { this.recover(); break; }
        args.push(arg);
        if (this.peek().type === TokenType.COMMA) this.consume();
      }
      this.expect(TokenType.RANGLE, "closing '>' of container type");
      return { kind: "container", container: name, args };
    }

    // Constraint syntax: `string ["a", "b"]` or `number [0..100]`
    if (this.peek().type === TokenType.LBRACKET) {
      if (name === "string") {
        this.consume(); // consume [
        const values: string[] = [];
        while (this.peek().type !== TokenType.RBRACKET && this.peek().type !== TokenType.EOF) {
          const vTok = this.peek();
          if (vTok.type !== TokenType.STRING) {
            this.addError("E000", `Expected string literal in string constraint, got ${JSON.stringify(vTok.value)}`, vTok);
            this.recover();
            break;
          }
          this.consume();
          values.push(vTok.value as string);
          if (this.peek().type === TokenType.COMMA) this.consume();
        }
        this.expect(TokenType.RBRACKET, "closing ']' of string constraint");
        return { kind: "constrained-string", values };
      }
      if (name === "number") {
        this.consume(); // consume [
        const minTok = this.peek();
        if (minTok.type !== TokenType.NUMBER) {
          this.addError("E000", `Expected number in numeric range constraint, got ${JSON.stringify(minTok.value)}`, minTok);
          this.recover();
          return { kind: "primitive", name: "number" };
        }
        this.consume();
        const min = Number(minTok.value);
        // expect ".."
        const dot1 = this.peek();
        if (dot1.type !== TokenType.IDENT || dot1.value !== "..") {
          // Try consuming two dots
          if (this.peek().type === TokenType.IDENT && (this.peek().value as string).startsWith("..")) {
            this.consume();
          } else {
            this.addError("E000", `Expected '..' in numeric range constraint`, dot1);
            this.recover();
            return { kind: "primitive", name: "number" };
          }
        } else {
          this.consume();
        }
        const maxTok = this.peek();
        if (maxTok.type !== TokenType.NUMBER) {
          this.addError("E000", `Expected number after '..' in numeric range constraint, got ${JSON.stringify(maxTok.value)}`, maxTok);
          this.recover();
          return { kind: "primitive", name: "number" };
        }
        this.consume();
        const max = Number(maxTok.value);
        this.expect(TokenType.RBRACKET, "closing ']' of numeric range constraint");
        return { kind: "constrained-number", min, max };
      }
    }

    if (PRIMITIVE_TYPES.has(name)) {
      return { kind: "primitive", name };
    }
    return { kind: "named", name };
  }

  // -------------------------------------------------------------------------
  // @panel
  // -------------------------------------------------------------------------

  private parsePanel(): PanelNode | null {
    const atTok = this.consume(); // consume @panel
    const nameTok = this.peek();
    if (nameTok.type !== TokenType.IDENT) {
      this.addError("E000", "Expected panel name after @panel", atTok);
      this.recover();
      return null;
    }
    this.consume(); // consume name
    const name = nameTok.value;

    if (this.peek().type !== TokenType.LBRACE) {
      this.addError("E001", `Expected '{' to open panel '${name}'`, this.peek());
      this.recover();
      return null;
    }
    this.consume(); // consume {  (lexer sets panelBraceDepth = 1)

    let dp: Record<string, KnotValue> | undefined;
    let access: PanelAccessNode | undefined;
    const rods: RodNode[] = [];

    this.skipNewlines();

    while (this.peek().type !== TokenType.RBRACE && this.peek().type !== TokenType.EOF) {
      const tok = this.peek();

      if (tok.type === TokenType.AT_DP) {
        this.consume(); // @dp
        const block = this.parseKnotBlock();
        dp = block;
        this.skipNewlines();
        continue;
      }

      if (tok.type === TokenType.AT_ACCESS) {
        this.consume(); // @access
        access = this.parseAccessBlock();
        this.skipNewlines();
        continue;
      }

      if (tok.type === TokenType.NEWLINE) {
        this.consume();
        continue;
      }

      // Rod line: name = rod-type { ... }
      if (tok.type === TokenType.IDENT) {
        const rod = this.parseRod();
        if (rod !== null) rods.push(rod);
        this.skipNewlines();
        continue;
      }

      // Unexpected token inside panel — recover
      this.addError("E000", `Unexpected token inside panel '${name}': ${JSON.stringify(tok.value)}`, tok);
      this.recover();
      this.skipNewlines();
    }

    const rbraceTok = this.peek();
    if (rbraceTok.type !== TokenType.RBRACE) {
      this.addError("E001", `Unclosed '{' in panel '${name}'`, rbraceTok);
      return null;
    }
    this.consume(); // consume }

    // W001 — missing @access
    if (access === undefined) {
      this.addWarning(
        "W001",
        `Panel '${name}' is missing an @access block`,
        atTok,
      );
    }

    return { kind: "panel", name, dp, access, rods, loc: this.loc(atTok) };
  }

  /** Parse `{ key: value, ... }` knot block (for @dp, rod bodies, nested configs). */
  parseKnotBlock(): Record<string, KnotValue> {
    const result: Record<string, KnotValue> = {};
    if (this.peek().type !== TokenType.LBRACE) {
      this.addError("E000", "Expected '{' for block", this.peek());
      return result;
    }
    this.consume(); // consume {

    this.skipNewlines();
    while (this.peek().type !== TokenType.RBRACE && this.peek().type !== TokenType.EOF) {
      if (this.peek().type === TokenType.NEWLINE) { this.consume(); continue; }

      const keyTok = this.peek();
      if (keyTok.type !== TokenType.IDENT) {
        this.addError("E000", `Expected key in block, got ${JSON.stringify(keyTok.value)}`, keyTok);
        this.recover();
        break;
      }
      this.consume(); // consume key
      const key = keyTok.value;

      if (this.expect(TokenType.COLON, `':' after key '${key}'`) === null) {
        this.recover();
        continue;
      }

      const value = this.parseKnotValue(key);
      result[key] = value;

      if (this.peek().type === TokenType.COMMA) this.consume();
      this.skipNewlines();
    }

    this.expect(TokenType.RBRACE, "closing '}' of block");
    return result;
  }

  /** Parse `@access { ... }` into a PanelAccessNode. */
  private parseAccessBlock(): PanelAccessNode {
    const fields = this.parseKnotBlock();
    return { kind: "access", fields };
  }

  // -------------------------------------------------------------------------
  // Rod parsing
  // -------------------------------------------------------------------------

  /** Parse `name = rod-type { knots }`. Handles optional nested `@ops { ... }` inside rod body. */
  private parseRod(): RodNode | null {
    const nameTok = this.consume(); // consume rod name
    const rodName = nameTok.value;

    if (this.expect(TokenType.EQUALS, `'=' after rod name '${rodName}'`) === null) {
      this.recover();
      return null;
    }

    const typeTok = this.peek();
    if (typeTok.type !== TokenType.IDENT) {
      this.addError("E000", `Expected rod type after '=', got ${JSON.stringify(typeTok.value)}`, typeTok);
      this.recover();
      return null;
    }
    this.consume(); // consume rod type
    const rodType = typeTok.value;

    // E002 — unknown rod type
    if (!KNOWN_ROD_TYPES.has(rodType)) {
      this.addError(
        "E002",
        `Unknown rod type '${rodType}'. Known types: ${[...KNOWN_ROD_TYPES].join(", ")}`,
        typeTok,
      );
    }

    // Parse rod body: { key: value pairs, and optionally @ops { ... } }
    const { knots, ops } = this.parseRodBody();

    return { kind: "rod", name: rodName, rodType, knots, ops, loc: this.loc(nameTok) };
  }

  /**
   * Parse a rod body block `{ ... }`, allowing both `key: value` pairs
   * and a nested `@ops { ... }` decorator block.
   */
  private parseRodBody(): { knots: Record<string, KnotValue>; ops: Record<string, KnotValue> | undefined } {
    const knots: Record<string, KnotValue> = {};
    let ops: Record<string, KnotValue> | undefined;

    if (this.peek().type !== TokenType.LBRACE) {
      this.addError("E000", "Expected '{' for rod body", this.peek());
      return { knots, ops };
    }
    this.consume(); // consume {

    this.skipNewlines();
    while (this.peek().type !== TokenType.RBRACE && this.peek().type !== TokenType.EOF) {
      if (this.peek().type === TokenType.NEWLINE) { this.consume(); continue; }

      // @ops decorator inside rod body
      if (this.peek().type === TokenType.AT_UNKNOWN && this.peek().value === "@ops") {
        this.consume(); // consume @ops
        ops = this.parseKnotBlock();
        this.skipNewlines();
        continue;
      }

      const keyTok = this.peek();
      if (keyTok.type !== TokenType.IDENT) {
        this.addError("E000", `Expected key in rod body, got ${JSON.stringify(keyTok.value)}`, keyTok);
        this.recover();
        break;
      }
      this.consume(); // consume key
      const key = keyTok.value;

      if (this.expect(TokenType.COLON, `':' after key '${key}'`) === null) {
        this.recover();
        continue;
      }

      const value = this.parseKnotValue(key);
      knots[key] = value;

      if (this.peek().type === TokenType.COMMA) this.consume();
      this.skipNewlines();
    }

    this.expect(TokenType.RBRACE, "closing '}' of rod body");
    return { knots, ops };
  }

  // -------------------------------------------------------------------------
  // Knot value parsing
  // -------------------------------------------------------------------------

  /**
   * Parse the value of a knot. Handles:
   * - string literals: `"value"`
   * - number literals: `5432`
   * - bool: `true` / `false`
   * - type paths with optional block: `db.sql.postgres { ... }`, `http { ... }`, `Proposal`
   * - raw expressions: `status == "submitted"`, `env("DB_HOST")`, etc.
   * - nested blocks: `{ key: val }`
   */
  parseKnotValue(_key = ""): KnotValue {
    const tok = this.peek();

    // String literal
    if (tok.type === TokenType.STRING) {
      this.consume();
      const raw = tok.value; // includes surrounding quotes
      const inner = raw.slice(1, raw.length - 1).replace(/\\"/g, '"');
      return { kind: "string", value: inner };
    }

    // Number literal
    if (tok.type === TokenType.NUMBER) {
      this.consume();
      return { kind: "number", value: parseFloat(tok.value) };
    }

    // Duration literal: e.g. "5m", "30s", "24h", "7d"
    if (tok.type === TokenType.DURATION) {
      this.consume();
      const raw = tok.value; // e.g. "5m"
      const unit = raw[raw.length - 1] as "s" | "m" | "h" | "d";
      const value = parseFloat(raw.slice(0, -1));
      return { kind: "duration", value, unit };
    }

    // Identifier — could be bool, type path, or start of expression
    if (tok.type === TokenType.IDENT) {
      if (tok.value === "true") { this.consume(); return { kind: "bool", value: true }; }
      if (tok.value === "false") { this.consume(); return { kind: "bool", value: false }; }

      // Save offset before parseDotPath consumes tokens so captureRawExpr
      // can slice from the start of the identifier.
      const startOffset = tok.offset;
      const segments = this.parseDotPath();

      const next = this.peek();

      // Malformed type path check: if we ended on a DOT (shouldn't happen given parseDotPath)
      // is already handled inside parseDotPath.

      if (next.type === TokenType.LBRACE) {
        // Type path / named block with config: db.sql.postgres { ... }
        const config = this.parseKnotBlock();
        return { kind: "path", segments, config };
      }

      // Check if what follows is an operator / call — if so, capture as raw expr
      if (
        next.type !== TokenType.COMMA &&
        next.type !== TokenType.RBRACE &&
        next.type !== TokenType.NEWLINE &&
        next.type !== TokenType.EOF &&
        next.type !== TokenType.COLON // shouldn't appear mid-value, but guard
      ) {
        // Looks like an expression — capture everything as raw text
        return this.captureRawExpr(startOffset);
      }

      // Simple identifier or type path with no block
      return { kind: "path", segments };
    }

    // Anonymous block: { key: val, ... }
    if (tok.type === TokenType.LBRACE) {
      const config = this.parseKnotBlock();
      return { kind: "block", config };
    }

    // Anything else (operators, UNKNOWN, etc.) — capture as raw expression
    // tok is NOT yet consumed here
    return this.captureRawExpr(tok.offset);
  }

  /**
   * Parse a dot-separated identifier path: `a`, `a.b`, `a.b.c`.
   * Emits E003 if a segment is missing (e.g. trailing dot or double dot).
   */
  private parseDotPath(): string[] {
    const segments: string[] = [];
    const firstTok = this.peek();
    if (firstTok.type !== TokenType.IDENT) return segments;
    this.consume();
    segments.push(firstTok.value);

    while (this.peek().type === TokenType.DOT) {
      const dotTok = this.consume(); // consume .
      const segTok = this.peek();
      if (segTok.type !== TokenType.IDENT) {
        // Malformed type path — emit E003
        this.addError(
          "E003",
          `Malformed type path: expected identifier after '.' but got ${JSON.stringify(segTok.value)}`,
          dotTok,
        );
        break;
      }
      this.consume();
      segments.push(segTok.value);
    }

    return segments;
  }

  /**
   * Capture a raw expression as text by reading tokens until a stopping point.
   *
   * Stopping points: COMMA or RBRACE at nesting depth 0, NEWLINE, EOF.
   * Text is reconstructed by slicing the source string.
   *
   * @param startOffset - Byte offset where the expression begins in source.
   *   The cursor may already be past this position (when called after parseDotPath
   *   has consumed tokens). Tokens from cursor onward are consumed until the stop.
   */
  private captureRawExpr(startOffset: number): KnotValue {
    // Include any tokens already consumed that belong to this expression
    // (e.g. the dot-path segments consumed by parseDotPath before we decided
    // this is a raw expression).
    let exprEnd = startOffset;
    if (this.cursor > 0) {
      const lastConsumed = this.tokens[this.cursor - 1];
      if (lastConsumed !== undefined && lastConsumed.offset >= startOffset) {
        exprEnd = lastConsumed.offset + lastConsumed.length;
      }
    }

    let braceDepth = 0;
    while (true) {
      const t = this.peek();
      if (t.type === TokenType.EOF) break;
      if (t.type === TokenType.NEWLINE) break;
      if (t.type === TokenType.COMMA && braceDepth === 0) break;
      if (t.type === TokenType.RBRACE && braceDepth === 0) break;

      if (t.type === TokenType.LBRACE) braceDepth++;
      else if (t.type === TokenType.RBRACE) braceDepth--;

      this.consume();
      exprEnd = t.offset + t.length;
    }

    const text = this.source.slice(startOffset, exprEnd).trim();
    return { kind: "raw-expr", text };
  }

  // -------------------------------------------------------------------------
  // Utility: skip an entire { ... } block (used for @context)
  // -------------------------------------------------------------------------

  private skipBlock(): void {
    if (this.peek().type !== TokenType.LBRACE) return;
    this.consume(); // consume {
    let depth = 1;
    while (depth > 0 && this.peek().type !== TokenType.EOF) {
      const t = this.consume();
      if (t.type === TokenType.LBRACE) depth++;
      else if (t.type === TokenType.RBRACE) depth--;
    }
  }
}

// ---------------------------------------------------------------------------
// parse — public entry point
// ---------------------------------------------------------------------------

/**
 * Parse a `.strux` source string.
 *
 * @param source - UTF-8 source text
 * @returns ParseResult with AST and diagnostics (never throws)
 */
export function parse(source: string): ParseResult {
  const parser = new Parser(source);
  return parser.parseFile();
}
