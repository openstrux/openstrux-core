/**
 * @openstrux/parser — lexer
 *
 * Converts a .strux source string to a flat Token[]. Key behaviours:
 * - `//` line comments are skipped
 * - NEWLINE tokens are emitted only inside @panel blocks at brace depth 1
 *   (directly at the panel body level, not nested deeper)
 * - Identifiers include hyphens: `read-data`, `grant-workflow`, etc.
 * - `@type`, `@panel`, `@context`, `@access`, `@dp` are tokenised as
 *   combined AT_* tokens
 */

// ---------------------------------------------------------------------------
// TokenType
// ---------------------------------------------------------------------------

export enum TokenType {
  // @ keywords
  AT_TYPE = "AT_TYPE",
  AT_PANEL = "AT_PANEL",
  AT_CONTEXT = "AT_CONTEXT",
  AT_ACCESS = "AT_ACCESS",
  AT_DP = "AT_DP",
  AT_UNKNOWN = "AT_UNKNOWN",

  // Structural brackets
  LBRACE = "LBRACE",
  RBRACE = "RBRACE",
  LANGLE = "LANGLE",
  RANGLE = "RANGLE",
  LPAREN = "LPAREN",
  RPAREN = "RPAREN",
  LBRACKET = "LBRACKET",
  RBRACKET = "RBRACKET",

  // Punctuation
  COLON = "COLON",
  COMMA = "COMMA",
  DOT = "DOT",
  EQUALS = "EQUALS",
  STAR = "STAR",

  // Literals
  STRING = "STRING",
  NUMBER = "NUMBER",

  // Identifiers (includes language keywords like `enum`, `union`, `true`, `false`)
  IDENT = "IDENT",

  // Significant whitespace — only inside @panel blocks at brace depth 1
  NEWLINE = "NEWLINE",

  // Catch-all for unrecognised characters (used in raw-expr reconstruction)
  UNKNOWN = "UNKNOWN",

  EOF = "EOF",
}

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

export interface Token {
  readonly type: TokenType;
  /** Exact source text of this token. */
  readonly value: string;
  /** 1-based line number. */
  readonly line: number;
  /** 1-based column. */
  readonly col: number;
  /** Byte length of value. */
  readonly length: number;
  /** Byte offset from start of source string. */
  readonly offset: number;
}

// ---------------------------------------------------------------------------
// Lexer state
// ---------------------------------------------------------------------------

interface LexerState {
  pos: number;
  line: number;
  col: number;
  inPanel: boolean;
  waitingForPanelBrace: boolean;
  panelBraceDepth: number;
}

function charAt(source: string, pos: number): string {
  return source[pos] ?? "";
}

function isIdentChar(ch: string): boolean {
  return /[a-zA-Z0-9_-]/.test(ch);
}

function isIdentStart(ch: string): boolean {
  return /[a-zA-Z_]/.test(ch);
}

function advanceState(s: LexerState, source: string): string {
  const ch = charAt(source, s.pos);
  if (ch === "") return "";
  s.pos++;
  if (ch === "\n") {
    s.line++;
    s.col = 1;
  } else {
    s.col++;
  }
  return ch;
}

// ---------------------------------------------------------------------------
// tokenize
// ---------------------------------------------------------------------------

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const s: LexerState = { pos: 0, line: 1, col: 1, inPanel: false, waitingForPanelBrace: false, panelBraceDepth: 0 };

  function emit(type: TokenType, value: string, tLine: number, tCol: number, tOffset: number): void {
    tokens.push({ type, value, line: tLine, col: tCol, length: value.length, offset: tOffset });
  }

  while (s.pos < source.length) {
    const startLine = s.line;
    const startCol = s.col;
    const startPos = s.pos;
    const ch = charAt(source, s.pos);

    // ---- Comments ----
    if (ch === "/" && charAt(source, s.pos + 1) === "/") {
      while (s.pos < source.length && charAt(source, s.pos) !== "\n") {
        s.pos++;
        s.col++;
      }
      continue;
    }

    // ---- Newline ----
    if (ch === "\n") {
      if (s.inPanel && s.panelBraceDepth === 1) {
        emit(TokenType.NEWLINE, "\n", startLine, startCol, startPos);
      }
      advanceState(s, source);
      continue;
    }

    // ---- Whitespace ----
    if (ch === " " || ch === "\t" || ch === "\r") {
      advanceState(s, source);
      continue;
    }

    // ---- @ keywords ----
    if (ch === "@") {
      advanceState(s, source); // consume @
      let ident = "";
      while (s.pos < source.length && isIdentChar(charAt(source, s.pos))) {
        ident += charAt(source, s.pos);
        s.pos++;
        s.col++;
      }
      const fullValue = "@" + ident;
      let type: TokenType;
      switch (ident) {
        case "type":    type = TokenType.AT_TYPE;    break;
        case "panel":
          type = TokenType.AT_PANEL;
          s.waitingForPanelBrace = true;
          break;
        case "context": type = TokenType.AT_CONTEXT; break;
        case "access":  type = TokenType.AT_ACCESS;  break;
        case "dp":      type = TokenType.AT_DP;      break;
        default:        type = TokenType.AT_UNKNOWN; break;
      }
      emit(type, fullValue, startLine, startCol, startPos);
      continue;
    }

    // ---- String literals ----
    if (ch === '"') {
      advanceState(s, source); // consume opening "
      let str = '"';
      while (s.pos < source.length) {
        const sc = charAt(source, s.pos);
        if (sc === "\\") {
          str += sc;
          advanceState(s, source);
          const esc = charAt(source, s.pos);
          str += esc;
          advanceState(s, source);
        } else if (sc === '"') {
          str += sc;
          advanceState(s, source);
          break;
        } else if (sc === "\n") {
          break; // unterminated string
        } else {
          str += sc;
          advanceState(s, source);
        }
      }
      emit(TokenType.STRING, str, startLine, startCol, startPos);
      continue;
    }

    // ---- Number literals (no negative — handled as UNKNOWN '-' + NUMBER) ----
    if (/[0-9]/.test(ch)) {
      let num = "";
      while (s.pos < source.length && /[0-9]/.test(charAt(source, s.pos))) {
        num += charAt(source, s.pos);
        s.pos++;
        s.col++;
      }
      if (s.pos < source.length && charAt(source, s.pos) === ".") {
        num += ".";
        s.pos++;
        s.col++;
        while (s.pos < source.length && /[0-9]/.test(charAt(source, s.pos))) {
          num += charAt(source, s.pos);
          s.pos++;
          s.col++;
        }
      }
      emit(TokenType.NUMBER, num, startLine, startCol, startPos);
      continue;
    }

    // ---- Identifiers ----
    if (isIdentStart(ch)) {
      let ident = "";
      while (s.pos < source.length && isIdentChar(charAt(source, s.pos))) {
        ident += charAt(source, s.pos);
        s.pos++;
        s.col++;
      }
      emit(TokenType.IDENT, ident, startLine, startCol, startPos);
      continue;
    }

    // ---- Punctuation and brackets ----
    advanceState(s, source); // consume the char

    switch (ch) {
      case "{":
        if (s.waitingForPanelBrace) {
          s.inPanel = true;
          s.panelBraceDepth = 1;
          s.waitingForPanelBrace = false;
        } else if (s.inPanel) {
          s.panelBraceDepth++;
        }
        emit(TokenType.LBRACE, ch, startLine, startCol, startPos);
        break;
      case "}":
        if (s.inPanel) {
          s.panelBraceDepth--;
          if (s.panelBraceDepth === 0) {
            s.inPanel = false;
          }
        }
        emit(TokenType.RBRACE, ch, startLine, startCol, startPos);
        break;
      case "<": emit(TokenType.LANGLE,   ch, startLine, startCol, startPos); break;
      case ">": emit(TokenType.RANGLE,   ch, startLine, startCol, startPos); break;
      case "(": emit(TokenType.LPAREN,   ch, startLine, startCol, startPos); break;
      case ")": emit(TokenType.RPAREN,   ch, startLine, startCol, startPos); break;
      case "[": emit(TokenType.LBRACKET, ch, startLine, startCol, startPos); break;
      case "]": emit(TokenType.RBRACKET, ch, startLine, startCol, startPos); break;
      case ":": emit(TokenType.COLON,    ch, startLine, startCol, startPos); break;
      case ",": emit(TokenType.COMMA,    ch, startLine, startCol, startPos); break;
      case ".": emit(TokenType.DOT,      ch, startLine, startCol, startPos); break;
      case "=": emit(TokenType.EQUALS,   ch, startLine, startCol, startPos); break;
      case "*": emit(TokenType.STAR,     ch, startLine, startCol, startPos); break;
      default:  emit(TokenType.UNKNOWN,  ch, startLine, startCol, startPos); break;
    }
  }

  emit(TokenType.EOF, "", s.line, s.col, s.pos);
  return tokens;
}
