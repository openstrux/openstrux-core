/**
 * Parse a strux.context file into a RawContextFile.
 * Uses the tokenizer from @openstrux/parser.
 */
import { tokenize, TokenType } from "@openstrux/parser";
import type { Token } from "@openstrux/parser";
import type { KnotValue } from "@openstrux/parser";
import type { ConfigDiagnostic, RawContextFile, RawNamedEndpoint } from "./types.js";

export function parseContextFile(
  source: string,
  filePath: string,
): { raw: RawContextFile; diagnostics: ConfigDiagnostic[] } {
  const tokens = tokenize(source);
  const diagnostics: ConfigDiagnostic[] = [];
  let cursor = 0;
  let hasCert = false;
  let certLine: number | undefined;

  const dp: Record<string, KnotValue> = {};
  const access: Record<string, KnotValue> = {};
  const ops: Record<string, KnotValue> = {};
  const sec: Record<string, KnotValue> = {};
  const sources: Record<string, RawNamedEndpoint> = {};
  const targets: Record<string, RawNamedEndpoint> = {};

  function peek(): Token {
    return (
      tokens[cursor] ?? {
        type: TokenType.EOF,
        value: "",
        line: 1,
        col: 1,
        length: 0,
        offset: 0,
      }
    );
  }

  function consume(): Token {
    const tok = peek();
    if (tok.type !== TokenType.EOF) cursor++;
    return tok;
  }

  function skipBlock(): void {
    if (peek().type !== TokenType.LBRACE) return;
    consume();
    let depth = 1;
    while (depth > 0 && peek().type !== TokenType.EOF) {
      const t = consume();
      if (t.type === TokenType.LBRACE) depth++;
      else if (t.type === TokenType.RBRACE) depth--;
    }
  }

  function parseKnotBlock(): Record<string, KnotValue> {
    const innerParser = new InnerParser(tokens, cursor, source);
    const result = innerParser.parseKnotBlock();
    cursor = innerParser.cursor;
    for (const d of innerParser.diagnostics) {
      diagnostics.push({
        code: d.code,
        message: d.message,
        severity: d.severity,
        file: filePath,
        line: d.line,
        col: d.col,
      });
    }
    return result;
  }

  while (peek().type !== TokenType.EOF) {
    const tok = peek();

    if (tok.type === TokenType.AT_DP) {
      consume();
      const block = parseKnotBlock();
      Object.assign(dp, block);
      continue;
    }

    if (tok.type === TokenType.AT_ACCESS) {
      consume();
      const block = parseKnotBlock();
      Object.assign(access, block);
      continue;
    }

    if (tok.type === TokenType.AT_UNKNOWN) {
      const kw = tok.value;
      consume();

      if (kw === "@ops") {
        const block = parseKnotBlock();
        Object.assign(ops, block);
        continue;
      }

      if (kw === "@sec") {
        const block = parseKnotBlock();
        Object.assign(sec, block);
        continue;
      }

      if (kw === "@cert") {
        hasCert = true;
        certLine = tok.line;
        diagnostics.push({
          code: "E_CERT_IN_CONTEXT",
          message: `@cert block found in strux.context file '${filePath}' — cert blocks are not allowed in context files (ADR-011)`,
          severity: "error",
          file: filePath,
          line: tok.line,
          col: tok.col,
        });
        skipBlock();
        continue;
      }

      if (kw === "@source" || kw === "@target") {
        const nameTok = peek();
        let endpointName = "";
        if (nameTok.type === TokenType.IDENT) {
          consume();
          endpointName = nameTok.value;
        } else {
          diagnostics.push({
            code: "E_CONTEXT_PARSE",
            message: `Expected name after ${kw}`,
            severity: "error",
            file: filePath,
            line: nameTok.line,
            col: nameTok.col,
          });
          skipBlock();
          continue;
        }
        const config = parseKnotBlock();
        const endpoint: RawNamedEndpoint = {
          name: endpointName,
          config,
          line: tok.line,
          col: tok.col,
        };
        if (kw === "@source") {
          sources[endpointName] = endpoint;
        } else {
          targets[endpointName] = endpoint;
        }
        continue;
      }

      // Unknown @ keyword in context — skip block
      if (peek().type === TokenType.IDENT) consume(); // skip optional name
      if (peek().type === TokenType.LBRACE) skipBlock();
      continue;
    }

    // Skip anything else
    consume();
  }

  const raw: RawContextFile = {
    path: filePath,
    dp,
    access,
    ops,
    sec,
    sources,
    targets,
    hasCert,
    ...(certLine !== undefined ? { certLine } : {}),
  };

  return { raw, diagnostics };
}

// ---------------------------------------------------------------------------
// InnerParser — lightweight token-stream parser for knot blocks
// ---------------------------------------------------------------------------

class InnerParser {
  cursor: number;
  readonly diagnostics: Array<{
    code: string;
    message: string;
    severity: "error" | "warning";
    line: number;
    col: number;
  }> = [];
  private readonly tokens: readonly Token[];
  private readonly source: string;

  constructor(tokens: readonly Token[], cursor: number, source: string) {
    this.tokens = tokens;
    this.cursor = cursor;
    this.source = source;
  }

  peek(offset = 0): Token {
    const idx = this.cursor + offset;
    return (
      this.tokens[idx] ?? {
        type: TokenType.EOF,
        value: "",
        line: 1,
        col: 1,
        length: 0,
        offset: 0,
      }
    );
  }

  consume(): Token {
    const tok = this.peek();
    if (tok.type !== TokenType.EOF) this.cursor++;
    return tok;
  }

  parseKnotBlock(): Record<string, KnotValue> {
    const result: Record<string, KnotValue> = {};
    if (this.peek().type !== TokenType.LBRACE) {
      this.diagnostics.push({
        code: "E_CONTEXT_PARSE",
        message: "Expected '{' for block",
        severity: "error",
        line: this.peek().line,
        col: this.peek().col,
      });
      return result;
    }
    this.consume(); // consume {

    while (
      this.peek().type !== TokenType.RBRACE &&
      this.peek().type !== TokenType.EOF
    ) {
      const keyTok = this.peek();
      if (keyTok.type !== TokenType.IDENT) {
        this.consume(); // skip unknown token
        continue;
      }
      this.consume();
      const key = keyTok.value;

      if (this.peek().type !== TokenType.COLON) {
        this.diagnostics.push({
          code: "E_CONTEXT_PARSE",
          message: `Expected ':' after key '${key}'`,
          severity: "error",
          line: this.peek().line,
          col: this.peek().col,
        });
        continue;
      }
      this.consume(); // consume :

      const value = this.parseKnotValue();
      result[key] = value;

      if (this.peek().type === TokenType.COMMA) this.consume();
    }

    if (this.peek().type === TokenType.RBRACE) this.consume();
    return result;
  }

  parseKnotValue(): KnotValue {
    const tok = this.peek();

    if (tok.type === TokenType.STRING) {
      this.consume();
      const raw = tok.value;
      const inner = raw.slice(1, raw.length - 1).replace(/\\"/g, '"');
      return { kind: "string", value: inner };
    }

    if (tok.type === TokenType.NUMBER) {
      this.consume();
      return { kind: "number", value: parseFloat(tok.value) };
    }

    if (tok.type === TokenType.IDENT) {
      if (tok.value === "true") {
        this.consume();
        return { kind: "bool", value: true };
      }
      if (tok.value === "false") {
        this.consume();
        return { kind: "bool", value: false };
      }

      const startOffset = tok.offset;
      const segments = this.parseDotPath();
      const next = this.peek();

      if (next.type === TokenType.LBRACE) {
        const config = this.parseKnotBlock();
        return { kind: "path", segments, config };
      }

      if (
        next.type !== TokenType.COMMA &&
        next.type !== TokenType.RBRACE &&
        next.type !== TokenType.EOF
      ) {
        return this.captureRawExpr(startOffset);
      }

      return { kind: "path", segments };
    }

    if (tok.type === TokenType.LBRACE) {
      const config = this.parseKnotBlock();
      return { kind: "block", config };
    }

    return this.captureRawExpr(tok.offset);
  }

  private parseDotPath(): string[] {
    const segments: string[] = [];
    if (this.peek().type !== TokenType.IDENT) return segments;
    this.consume();
    segments.push(this.tokens[this.cursor - 1]?.value ?? "");

    while (this.peek().type === TokenType.DOT) {
      this.consume();
      if (this.peek().type !== TokenType.IDENT) break;
      this.consume();
      segments.push(this.tokens[this.cursor - 1]?.value ?? "");
    }
    return segments;
  }

  private captureRawExpr(startOffset: number): KnotValue {
    let exprEnd = startOffset;
    if (this.cursor > 0) {
      const lastConsumed = this.tokens[this.cursor - 1];
      if (
        lastConsumed !== undefined &&
        lastConsumed.offset >= startOffset
      ) {
        exprEnd = lastConsumed.offset + lastConsumed.length;
      }
    }

    let braceDepth = 0;
    while (true) {
      const t = this.peek();
      if (t.type === TokenType.EOF) break;
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
}
