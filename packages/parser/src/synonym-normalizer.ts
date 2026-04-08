/**
 * Synonym normalizer — pre-pass before expression parsing.
 *
 * Normalizes SQL/v0.5 expression forms to canonical v0.6.0 C-family syntax,
 * emitting info diagnostics for each substitution. This allows existing .strux
 * files with SQL-style expressions to keep working without errors.
 *
 * Spec reference: openstrux-spec/specs/core/expression-shorthand.md
 *                 §Synonym normalization
 *
 * Processing order: multi-token patterns first (most specific), then
 * single-token synonyms, then case normalization.
 */

import type { Diagnostic } from "./types.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface NormalizeResult {
  /** Normalized expression text ready for the recursive-descent parser. */
  readonly normalized: string;
  /**
   * Info diagnostics noting each normalization. Positions refer to the
   * ORIGINAL text, not the normalized output.
   */
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * Normalize SQL/v0.5 synonyms in `rawText` to canonical v0.6.0 form.
 *
 * @param rawText   Raw expression string from captureRawExpr.
 * @param startLine 1-based line number of the expression start (for diagnostics).
 * @param startCol  1-based column of the expression start (for diagnostics).
 */
export function normalizeSynonyms(
  rawText: string,
  startLine: number,
  startCol: number,
): NormalizeResult {
  const tokens = tokenize(rawText);
  const diagnostics: Diagnostic[] = [];

  const result = applyPatterns(tokens, startLine, startCol, diagnostics);
  const normalized = reconstructText(result);

  return { normalized, diagnostics };
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type TokenKind =
  | "STRING"     // "..." or '...'
  | "NUMBER"     // 42, 3.14
  | "IDENT"      // identifiers and keywords
  | "OP"         // operators: ==, !=, >=, <=, >, <, &&, ||, ??, ?., !, +, -, *, /, %
  | "PUNCT"      // punctuation: ( ) [ ] { } , . : ; ? !in
  | "WS"         // whitespace (preserved for reconstruction)
  | "OTHER";

interface SynToken {
  readonly kind: TokenKind;
  readonly text: string;
  /** Byte offset in the original string. */
  readonly offset: number;
}

function tokenize(text: string): SynToken[] {
  const tokens: SynToken[] = [];
  let i = 0;

  while (i < text.length) {
    const ch = text[i]!;

    // Whitespace
    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j]!)) j++;
      tokens.push({ kind: "WS", text: text.slice(i, j), offset: i });
      i = j;
      continue;
    }

    // String literals — preserve exactly
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === '\\') { j += 2; continue; }
        if (text[j] === quote) { j++; break; }
        j++;
      }
      tokens.push({ kind: "STRING", text: text.slice(i, j), offset: i });
      i = j;
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(text[i + 1] ?? ''))) {
      let j = i + (ch === '-' ? 1 : 0);
      while (j < text.length && /[0-9._]/.test(text[j]!)) j++;
      tokens.push({ kind: "NUMBER", text: text.slice(i, j), offset: i });
      i = j;
      continue;
    }

    // Multi-char operators
    const twoChar = text.slice(i, i + 2);
    if (["==", "!=", ">=", "<=", "&&", "||", "??", "?.", "!in"].includes(twoChar)) {
      tokens.push({ kind: twoChar === "!in" ? "PUNCT" : "OP", text: twoChar, offset: i });
      i += 2;
      continue;
    }
    const threeChar = text.slice(i, i + 3);
    if (threeChar === "..<") {
      tokens.push({ kind: "PUNCT", text: threeChar, offset: i });
      i += 3;
      continue;
    }
    const twoCharPunct = text.slice(i, i + 2);
    if (twoCharPunct === "..") {
      tokens.push({ kind: "PUNCT", text: "..", offset: i });
      i += 2;
      continue;
    }

    // Single-char operators / punctuation
    if ("><=!+*/%".includes(ch)) {
      tokens.push({ kind: "OP", text: ch, offset: i });
      i++;
      continue;
    }
    if ("()[]{},:;?-".includes(ch)) {
      tokens.push({ kind: "PUNCT", text: ch, offset: i });
      i++;
      continue;
    }
    if (ch === ".") {
      tokens.push({ kind: "PUNCT", text: ch, offset: i });
      i++;
      continue;
    }

    // Identifiers / keywords
    if (/[a-zA-Z_$]/.test(ch)) {
      let j = i + 1;
      while (j < text.length && /[a-zA-Z0-9_$]/.test(text[j]!)) j++;
      tokens.push({ kind: "IDENT", text: text.slice(i, j), offset: i });
      i = j;
      continue;
    }

    // Anything else
    tokens.push({ kind: "OTHER", text: ch, offset: i });
    i++;
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Pattern matching and substitution
// ---------------------------------------------------------------------------

/** Non-whitespace tokens with their original indices in the full token array. */
interface SigToken {
  readonly tok: SynToken;
  /** Index in the full `tokens` array (including WS). */
  readonly idx: number;
}

function sigTokens(tokens: SynToken[]): SigToken[] {
  return tokens
    .map((tok, idx) => ({ tok, idx }))
    .filter(({ tok }) => tok.kind !== "WS");
}

function offsetToLineCol(
  rawText: string,
  offset: number,
  startLine: number,
  startCol: number,
): { line: number; col: number } {
  let line = startLine;
  let col = startCol;
  for (let i = 0; i < offset && i < rawText.length; i++) {
    if (rawText[i] === "\n") { line++; col = 1; }
    else col++;
  }
  return { line, col };
}

function infoDiag(
  rawText: string,
  offset: number,
  length: number,
  message: string,
  startLine: number,
  startCol: number,
  diagnostics: Diagnostic[],
): void {
  const { line, col } = offsetToLineCol(rawText, offset, startLine, startCol);
  diagnostics.push({ code: "I001", message, severity: "info", line, col, length });
}

/**
 * Apply all synonym patterns to the token stream.
 * Returns a new token array with substitutions applied.
 * Patterns are applied left-to-right, most-specific first.
 */
function applyPatterns(
  tokens: SynToken[],
  startLine: number,
  startCol: number,
  diagnostics: Diagnostic[],
): SynToken[] {
  // Work on a mutable copy; we replace tokens by index.
  const result: (SynToken | null)[] = [...tokens];
  const rawText = tokens.map(t => t.text).join("");

  const sig = sigTokens(tokens);

  for (let s = 0; s < sig.length; s++) {
    const cur = sig[s]!;
    const tok = cur.tok;

    // -----------------------------------------------------------------------
    // BETWEEN x AND y  →  in x..y
    // Pattern: <subject> BETWEEN <low> AND <high>
    // subject is the token BEFORE BETWEEN — already emitted; rewrite in-place.
    // -----------------------------------------------------------------------
    if (isKeyword(tok, "BETWEEN") && s >= 1) {
      const low = sig[s + 1];
      const and = sig[s + 2];
      const high = sig[s + 3];
      if (
        low && and && high &&
        isKeyword(and.tok, "AND") &&
        isValueToken(low.tok) && isValueToken(high.tok)
      ) {
        const lowText = low.tok.text;
        const highText = high.tok.text;
        infoDiag(
          rawText, tok.offset, tok.text.length,
          `Normalized: 'BETWEEN ${lowText} AND ${highText}' → 'in ${lowText}..${highText}'`,
          startLine, startCol, diagnostics,
        );
        // Replace BETWEEN with 'in', low stays, AND becomes '..', high stays
        result[cur.idx] = { kind: "IDENT", text: "in", offset: tok.offset };
        // Keep low.tok as-is
        result[and.idx] = { kind: "PUNCT", text: "..", offset: and.tok.offset };
        // Keep high.tok as-is
        // Skip past these tokens
        s += 3;
        continue;
      }
    }

    // -----------------------------------------------------------------------
    // IS NOT NULL  →  != null
    // -----------------------------------------------------------------------
    if (isKeyword(tok, "IS")) {
      const next1 = sig[s + 1];
      const next2 = sig[s + 2];
      if (next1 && next2 && isKeyword(next1.tok, "NOT") && isKeyword(next2.tok, "NULL")) {
        infoDiag(
          rawText, tok.offset, next2.tok.offset + next2.tok.text.length - tok.offset,
          "Normalized: 'IS NOT NULL' → '!= null'",
          startLine, startCol, diagnostics,
        );
        result[cur.idx] = { kind: "OP", text: "!=", offset: tok.offset };
        result[next1.idx] = null;
        result[next2.idx] = { kind: "IDENT", text: "null", offset: next2.tok.offset };
        s += 2;
        continue;
      }
    }

    // -----------------------------------------------------------------------
    // IS NULL  →  == null
    // -----------------------------------------------------------------------
    if (isKeyword(tok, "IS")) {
      const next = sig[s + 1];
      if (next && isKeyword(next.tok, "NULL")) {
        infoDiag(
          rawText, tok.offset, next.tok.offset + next.tok.text.length - tok.offset,
          "Normalized: 'IS NULL' → '== null'",
          startLine, startCol, diagnostics,
        );
        result[cur.idx] = { kind: "OP", text: "==", offset: tok.offset };
        result[next.idx] = { kind: "IDENT", text: "null", offset: next.tok.offset };
        s += 1;
        continue;
      }
    }

    // -----------------------------------------------------------------------
    // NOT IN (...)  →  !in [...]
    // Rewrite: NOT → !, IN → in, ( → [, ) → ]
    // -----------------------------------------------------------------------
    if (isKeyword(tok, "NOT")) {
      const next = sig[s + 1];
      if (next && isKeyword(next.tok, "IN")) {
        // Look for opening paren
        const openParen = sig[s + 2];
        if (openParen && openParen.tok.text === "(") {
          infoDiag(
            rawText, tok.offset, next.tok.offset + next.tok.text.length - tok.offset,
            "Normalized: 'NOT IN (...)' → '!in [...]'",
            startLine, startCol, diagnostics,
          );
          result[cur.idx] = { kind: "PUNCT", text: "!in", offset: tok.offset };
          result[next.idx] = null;
          result[openParen.idx] = { kind: "PUNCT", text: "[", offset: openParen.tok.offset };
          // Find matching closing paren and replace with ]
          replaceMatchingParen(result, tokens, openParen.idx);
          s += 2;
          continue;
        }
      }
    }

    // -----------------------------------------------------------------------
    // x IN (...)  →  x in [...]
    // Single-token 'IN' not preceded by 'NOT'
    // -----------------------------------------------------------------------
    if (isKeyword(tok, "IN")) {
      const prev = sig[s - 1];
      if (!prev || !isKeyword(prev.tok, "NOT")) {
        const openParen = sig[s + 1];
        if (openParen && openParen.tok.text === "(") {
          infoDiag(
            rawText, tok.offset, tok.text.length,
            "Normalized: 'IN (...)' → 'in [...]'",
            startLine, startCol, diagnostics,
          );
          result[cur.idx] = { kind: "IDENT", text: "in", offset: tok.offset };
          result[openParen.idx] = { kind: "PUNCT", text: "[", offset: openParen.tok.offset };
          replaceMatchingParen(result, tokens, openParen.idx);
          s += 1;
          continue;
        }
      }
    }

    // -----------------------------------------------------------------------
    // HAS ALL (...)  →  .includesAll([...])
    // HAS ANY (...)  →  .includesAny([...])
    // HAS "x"        →  .includes("x")
    // These are guard policy synonyms from v0.5.
    // -----------------------------------------------------------------------
    if (isKeyword(tok, "HAS")) {
      const next1 = sig[s + 1];
      if (next1) {
        if (isKeyword(next1.tok, "ALL")) {
          const openParen = sig[s + 2];
          if (openParen && openParen.tok.text === "(") {
            infoDiag(
              rawText, tok.offset, next1.tok.offset + next1.tok.text.length - tok.offset,
              "Normalized: 'HAS ALL (...)' → '.includesAll([...])'",
              startLine, startCol, diagnostics,
            );
            result[cur.idx] = { kind: "PUNCT", text: ".", offset: tok.offset };
            result[next1.idx] = { kind: "IDENT", text: "includesAll", offset: next1.tok.offset };
            result[openParen.idx] = { kind: "PUNCT", text: "([", offset: openParen.tok.offset };
            replaceMatchingParen(result, tokens, openParen.idx, "])");
            s += 2;
            continue;
          }
        }
        if (isKeyword(next1.tok, "ANY")) {
          const openParen = sig[s + 2];
          if (openParen && openParen.tok.text === "(") {
            infoDiag(
              rawText, tok.offset, next1.tok.offset + next1.tok.text.length - tok.offset,
              "Normalized: 'HAS ANY (...)' → '.includesAny([...])'",
              startLine, startCol, diagnostics,
            );
            result[cur.idx] = { kind: "PUNCT", text: ".", offset: tok.offset };
            result[next1.idx] = { kind: "IDENT", text: "includesAny", offset: next1.tok.offset };
            result[openParen.idx] = { kind: "PUNCT", text: "([", offset: openParen.tok.offset };
            replaceMatchingParen(result, tokens, openParen.idx, "])");
            s += 2;
            continue;
          }
        }
        if (next1.tok.kind === "STRING") {
          infoDiag(
            rawText, tok.offset, tok.text.length,
            `Normalized: 'HAS ${next1.tok.text}' → '.includes(${next1.tok.text})'`,
            startLine, startCol, diagnostics,
          );
          result[cur.idx] = { kind: "PUNCT", text: ".", offset: tok.offset };
          // Insert includes( before the string arg and ) after
          result[next1.idx] = {
            kind: "IDENT",
            text: `includes(${next1.tok.text})`,
            offset: next1.tok.offset,
          };
          s += 1;
          continue;
        }
      }
    }

    // -----------------------------------------------------------------------
    // COALESCE(a, b)  →  a ?? b   (2-arg only)
    // COALESCE(a, b, c, ...)  →  coalesce(a, b, c, ...)  (case normalize only)
    // -----------------------------------------------------------------------
    if (isKeyword(tok, "COALESCE")) {
      const openParen = sig[s + 1];
      if (openParen && openParen.tok.text === "(") {
        const argsResult = extractParenArgs(sig, s + 1);
        if (argsResult && argsResult.argCount === 2) {
          // 2-arg: rewrite to ??
          // We do a simpler text-level rewrite for 2-arg coalesce
          const rawSlice = rawText.slice(tok.offset);
          const coalesceMatch = /^COALESCE\s*\(\s*([^,]+),\s*([^)]+)\s*\)/i.exec(rawSlice);
          if (coalesceMatch) {
            const a = coalesceMatch[1]!.trim();
            const b = coalesceMatch[2]!.trim();
            const fullLen = coalesceMatch[0].length;
            infoDiag(
              rawText, tok.offset, fullLen,
              `Normalized: 'COALESCE(${a}, ${b})' → '${a} ?? ${b}'`,
              startLine, startCol, diagnostics,
            );
            // Replace entire COALESCE(...) span with text substitution token
            const endIdx = findEndIndex(result, tokens, tok.offset, fullLen);
            for (let k = cur.idx; k <= endIdx; k++) result[k] = null;
            result[cur.idx] = {
              kind: "OTHER",
              text: `${a} ?? ${b}`,
              offset: tok.offset,
            };
            s = sig.findIndex(st => st.idx > endIdx) - 1;
            if (s < 0) s = sig.length - 1;
            continue;
          }
        } else if (argsResult && argsResult.argCount > 2) {
          // 3+ args: just lowercase the function name
          infoDiag(
            rawText, tok.offset, tok.text.length,
            "Normalized: 'COALESCE' → 'coalesce' (use ?? for 2-arg form)",
            startLine, startCol, diagnostics,
          );
          result[cur.idx] = { kind: "IDENT", text: "coalesce", offset: tok.offset };
          continue;
        }
      }
    }

    // -----------------------------------------------------------------------
    // EXISTS field  →  field != null
    // -----------------------------------------------------------------------
    if (isKeyword(tok, "EXISTS")) {
      const next = sig[s + 1];
      if (next && (next.tok.kind === "IDENT" || next.tok.kind === "PUNCT")) {
        infoDiag(
          rawText, tok.offset, tok.text.length,
          `Normalized: 'EXISTS ${next.tok.text}' → '${next.tok.text} != null'`,
          startLine, startCol, diagnostics,
        );
        // Swap: EXISTS field → field != null
        result[cur.idx] = { kind: "OTHER", text: `${next.tok.text} != null`, offset: tok.offset };
        result[next.idx] = null;
        s += 1;
        continue;
      }
    }

    // -----------------------------------------------------------------------
    // LIKE pattern normalization
    // Simple cases only; complex patterns emit an error (handled separately).
    // -----------------------------------------------------------------------
    if (isKeyword(tok, "LIKE") || isKeyword(tok, "NOT LIKE")) {
      const isNegated = isKeyword(tok, "NOT LIKE");
      const patTok = sig[s + (isNegated ? 0 : 1)];
      if (!isNegated && patTok && patTok.tok.kind === "STRING") {
        const pat = patTok.tok.text.slice(1, -1); // strip quotes
        const prefix = isNegated ? "!" : "";
        if (/^%[^%_]+$/.test(pat)) {
          // LIKE "%foo" → .endsWith("foo")
          const inner = pat.slice(1);
          infoDiag(
            rawText, tok.offset, patTok.tok.offset + patTok.tok.text.length - tok.offset,
            `Normalized: LIKE "${pat}" → .endsWith("${inner}")`,
            startLine, startCol, diagnostics,
          );
          result[cur.idx] = { kind: "OTHER", text: `${prefix}.endsWith("${inner}")`, offset: tok.offset };
          result[patTok.idx] = null;
          s += 1;
          continue;
        }
        if (/^[^%_]+%$/.test(pat)) {
          // LIKE "foo%" → .startsWith("foo")
          const inner = pat.slice(0, -1);
          infoDiag(
            rawText, tok.offset, patTok.tok.offset + patTok.tok.text.length - tok.offset,
            `Normalized: LIKE "${pat}" → .startsWith("${inner}")`,
            startLine, startCol, diagnostics,
          );
          result[cur.idx] = { kind: "OTHER", text: `${prefix}.startsWith("${inner}")`, offset: tok.offset };
          result[patTok.idx] = null;
          s += 1;
          continue;
        }
        if (/^%[^%_]+%$/.test(pat)) {
          // LIKE "%foo%" → .contains("foo")
          const inner = pat.slice(1, -1);
          infoDiag(
            rawText, tok.offset, patTok.tok.offset + patTok.tok.text.length - tok.offset,
            `Normalized: LIKE "${pat}" → .contains("${inner}")`,
            startLine, startCol, diagnostics,
          );
          result[cur.idx] = { kind: "OTHER", text: `${prefix}.contains("${inner}")`, offset: tok.offset };
          result[patTok.idx] = null;
          s += 1;
          continue;
        }
        // Complex LIKE — emit compile error via a special sentinel token
        // The expression parser will surface this as a proper error.
        result[cur.idx] = {
          kind: "OTHER",
          text: `__COMPLEX_LIKE_ERROR__(${patTok.tok.text})`,
          offset: tok.offset,
        };
        result[patTok.idx] = null;
        s += 1;
        continue;
      }
    }

    // -----------------------------------------------------------------------
    // AND  →  &&
    // -----------------------------------------------------------------------
    if (isKeyword(tok, "AND")) {
      // Don't replace AND inside BETWEEN...AND (already handled above)
      infoDiag(
        rawText, tok.offset, tok.text.length,
        "Normalized: 'AND' → '&&'",
        startLine, startCol, diagnostics,
      );
      result[cur.idx] = { kind: "OP", text: "&&", offset: tok.offset };
      continue;
    }

    // -----------------------------------------------------------------------
    // OR  →  ||
    // -----------------------------------------------------------------------
    if (isKeyword(tok, "OR")) {
      infoDiag(
        rawText, tok.offset, tok.text.length,
        "Normalized: 'OR' → '||'",
        startLine, startCol, diagnostics,
      );
      result[cur.idx] = { kind: "OP", text: "||", offset: tok.offset };
      continue;
    }

    // -----------------------------------------------------------------------
    // NOT (standalone boolean negation)  →  !
    // Only when followed by an identifier or '(' — not when part of NOT IN,
    // IS NOT NULL (already handled above).
    // -----------------------------------------------------------------------
    if (isKeyword(tok, "NOT")) {
      const next = sig[s + 1];
      if (next && next.tok.kind !== "WS") {
        infoDiag(
          rawText, tok.offset, tok.text.length,
          "Normalized: 'NOT' → '!'",
          startLine, startCol, diagnostics,
        );
        result[cur.idx] = { kind: "OP", text: "!", offset: tok.offset };
        continue;
      }
    }

    // -----------------------------------------------------------------------
    // Case normalization for built-in identifiers (silent — no diagnostic)
    // -----------------------------------------------------------------------
    if (tok.kind === "IDENT") {
      const canonical = CASE_NORMALIZE.get(tok.text.toLowerCase());
      if (canonical !== undefined && tok.text !== canonical) {
        result[cur.idx] = { kind: "IDENT", text: canonical, offset: tok.offset };
        continue;
      }
    }
  }

  return result.filter((t): t is SynToken => t !== null);
}

// ---------------------------------------------------------------------------
// Case normalization table
// ---------------------------------------------------------------------------

/**
 * Maps lowercase form → canonical camelCase form for built-in identifiers.
 * Applied silently (no info diagnostic).
 */
const CASE_NORMALIZE: ReadonlyMap<string, string> = new Map([
  // Aggregation functions
  ["count",   "count"],
  ["sum",     "sum"],
  ["avg",     "avg"],
  ["min",     "min"],
  ["max",     "max"],
  ["first",   "first"],
  ["last",    "last"],
  ["collect", "collect"],
  // Modifier
  ["distinct", "distinct"],
  // Sort keywords
  ["asc",   "asc"],
  ["desc",  "desc"],
  ["nulls", "nulls"],
  // Projection
  ["as", "as"],
  // Membership
  ["in", "in"],
  // Built-in free functions
  ["now",       "now"],
  ["year",      "year"],
  ["month",     "month"],
  ["day",       "day"],
  ["hour",      "hour"],
  ["datediff",  "dateDiff"],
  ["dateadd",   "dateAdd"],
  ["datetrunc", "dateTrunc"],
  ["abs",   "abs"],
  ["round", "round"],
  ["floor", "floor"],
  ["ceil",  "ceil"],
  ["pow",   "pow"],
  ["sqrt",  "sqrt"],
  ["int",   "int"],
  ["float", "float"],
  ["str",   "str"],
  ["bool",  "bool"],
  ["env",   "env"],
  ["len",   "len"],
  ["coalesce", "coalesce"],
  // Method names
  ["upper",       "upper"],
  ["lower",       "lower"],
  ["trim",        "trim"],
  ["startswith",  "startsWith"],
  ["endswith",    "endsWith"],
  ["contains",    "contains"],
  ["replace",     "replace"],
  ["substring",   "substring"],
  ["matches",     "matches"],
  ["includes",    "includes"],
  ["includesany", "includesAny"],
  ["includesall", "includesAll"],
  ["any",         "any"],
  ["all",         "all"],
  ["flatmap",     "flatMap"],
  ["filter",      "filter"],
  ["map",         "map"],
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isKeyword(tok: SynToken, keyword: string): boolean {
  return tok.kind === "IDENT" && tok.text.toUpperCase() === keyword.toUpperCase();
}

function isValueToken(tok: SynToken): boolean {
  return tok.kind === "NUMBER" || tok.kind === "STRING" || tok.kind === "IDENT";
}

/** Replace the closing `)` that matches the opening `(` at `openIdx` with `closeReplace`. */
function replaceMatchingParen(
  result: (SynToken | null)[],
  tokens: SynToken[],
  openIdx: number,
  closeReplace: string = "]",
): void {
  let depth = 1;
  for (let k = openIdx + 1; k < tokens.length; k++) {
    const t = tokens[k];
    if (!t) continue;
    if (t.text === "(") depth++;
    if (t.text === ")") {
      depth--;
      if (depth === 0) {
        result[k] = { kind: "PUNCT", text: closeReplace, offset: t.offset };
        return;
      }
    }
  }
}

interface ArgsCountResult {
  readonly argCount: number;
  /** Index in sig of the closing paren. */
  readonly closeSigIdx: number;
}

/** Count comma-separated top-level args inside parens starting at sigIdx. */
function extractParenArgs(sig: SigToken[], sigIdx: number): ArgsCountResult | null {
  const open = sig[sigIdx];
  if (!open || open.tok.text !== "(") return null;
  let depth = 1;
  let count = 1;
  for (let k = sigIdx + 1; k < sig.length; k++) {
    const t = sig[k]!.tok.text;
    if (t === "(") depth++;
    if (t === ")") { depth--; if (depth === 0) return { argCount: count, closeSigIdx: k }; }
    if (t === "," && depth === 1) count++;
  }
  return null;
}

/**
 * Find the last token index (in result/tokens array) that falls within
 * [offset, offset + length).
 */
function findEndIndex(
  _result: (SynToken | null)[],
  tokens: SynToken[],
  offset: number,
  length: number,
): number {
  let last = 0;
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (t && t.offset >= offset && t.offset < offset + length) last = k;
  }
  return last;
}

function reconstructText(tokens: SynToken[]): string {
  return tokens.map(t => t.text).join("");
}
