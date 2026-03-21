import { describe, expect, it } from "vitest";
import { tokenize, TokenType } from "../lexer.js";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function types(source: string): TokenType[] {
  return tokenize(source)
    .filter((t) => t.type !== TokenType.EOF)
    .map((t) => t.type);
}

function values(source: string): string[] {
  return tokenize(source)
    .filter((t) => t.type !== TokenType.EOF)
    .map((t) => t.value);
}

// ---------------------------------------------------------------------------
// Keywords
// ---------------------------------------------------------------------------

describe("@ keywords", () => {
  it("tokenises @type", () => {
    expect(types("@type")).toEqual([TokenType.AT_TYPE]);
    expect(values("@type")).toEqual(["@type"]);
  });

  it("tokenises @panel", () => {
    expect(types("@panel")).toEqual([TokenType.AT_PANEL]);
  });

  it("tokenises @context", () => {
    expect(types("@context")).toEqual([TokenType.AT_CONTEXT]);
  });

  it("tokenises @access", () => {
    expect(types("@access")).toEqual([TokenType.AT_ACCESS]);
  });

  it("tokenises @dp", () => {
    expect(types("@dp")).toEqual([TokenType.AT_DP]);
  });

  it("unknown @ keyword becomes AT_UNKNOWN", () => {
    expect(types("@strux")).toEqual([TokenType.AT_UNKNOWN]);
    expect(values("@strux")).toEqual(["@strux"]);
  });
});

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

describe("identifiers", () => {
  it("plain identifier", () => {
    expect(types("foo")).toEqual([TokenType.IDENT]);
    expect(values("foo")).toEqual(["foo"]);
  });

  it("PascalCase identifier", () => {
    expect(values("Proposal")).toEqual(["Proposal"]);
  });

  it("snake_case identifier", () => {
    expect(values("submitted_at")).toEqual(["submitted_at"]);
  });

  it("hyphenated identifier (rod type)", () => {
    expect(values("read-data")).toEqual(["read-data"]);
    expect(types("read-data")).toEqual([TokenType.IDENT]);
  });

  it("enum keyword is IDENT", () => {
    expect(types("enum")).toEqual([TokenType.IDENT]);
    expect(values("enum")).toEqual(["enum"]);
  });

  it("union keyword is IDENT", () => {
    expect(types("union")).toEqual([TokenType.IDENT]);
  });

  it("true and false are IDENT", () => {
    expect(types("true false")).toEqual([TokenType.IDENT, TokenType.IDENT]);
    expect(values("true false")).toEqual(["true", "false"]);
  });
});

// ---------------------------------------------------------------------------
// String literals
// ---------------------------------------------------------------------------

describe("strings", () => {
  it("simple string", () => {
    expect(types('"hello"')).toEqual([TokenType.STRING]);
    expect(values('"hello"')).toEqual(['"hello"']);
  });

  it("string with escaped quote", () => {
    const toks = tokenize('"say \\"hi\\""');
    expect(toks[0]?.type).toBe(TokenType.STRING);
    expect(toks[0]?.value).toBe('"say \\"hi\\""');
  });
});

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

describe("numbers", () => {
  it("integer", () => {
    expect(types("5432")).toEqual([TokenType.NUMBER]);
    expect(values("5432")).toEqual(["5432"]);
  });

  it("float", () => {
    expect(values("3.14")).toEqual(["3.14"]);
    expect(types("3.14")).toEqual([TokenType.NUMBER]);
  });
});

// ---------------------------------------------------------------------------
// Braces and operators
// ---------------------------------------------------------------------------

describe("punctuation", () => {
  it("braces", () => {
    expect(types("{}")).toEqual([TokenType.LBRACE, TokenType.RBRACE]);
  });

  it("angle brackets", () => {
    expect(types("<>")).toEqual([TokenType.LANGLE, TokenType.RANGLE]);
  });

  it("colon and comma", () => {
    expect(types(":,")).toEqual([TokenType.COLON, TokenType.COMMA]);
  });

  it("dot and equals", () => {
    expect(types(".=")).toEqual([TokenType.DOT, TokenType.EQUALS]);
  });
});

// ---------------------------------------------------------------------------
// NEWLINE significance
// ---------------------------------------------------------------------------

describe("NEWLINE inside panel blocks", () => {
  it("no NEWLINE outside panel blocks", () => {
    const src = "@type Foo {\n  id: string\n}";
    const toks = tokenize(src).filter((t) => t.type !== TokenType.EOF);
    expect(toks.some((t) => t.type === TokenType.NEWLINE)).toBe(false);
  });

  it("NEWLINE emitted at panel brace depth 1", () => {
    const src = `@panel p {
  a = receive { trigger: http { method: "GET" } }
  b = respond {}
}`;
    const newlines = tokenize(src).filter((t) => t.type === TokenType.NEWLINE);
    // Two rod lines should produce two NEWLINEs (one after each rod's closing })
    expect(newlines.length).toBeGreaterThanOrEqual(2);
  });

  it("no NEWLINE inside nested braces at depth > 1", () => {
    // Inside the rod's { }, we are at depth 2 — no NEWLINE emitted for inner newlines.
    // NEWLINEs ARE emitted at depth 1: after the panel's opening brace,
    // and after the rod's closing brace.
    const src = `@panel p {
  r = read-data {
    mode: "scan"
  }
}`;
    const toks = tokenize(src);
    const newlines = toks.filter((t) => t.type === TokenType.NEWLINE);
    // depth-1 newlines: after `@panel p {`, after `}` (rod close)
    expect(newlines.length).toBe(2);
    // Verify the newlines INSIDE the rod block (after "mode: "scan"" and after the
    // nested `}`) are NOT in the list (i.e. total is exactly 2, not more).
    expect(newlines.length).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Line / col / offset tracking
// ---------------------------------------------------------------------------

describe("location tracking", () => {
  it("first token on line 1 col 1", () => {
    const toks = tokenize("@type");
    const t = toks[0];
    expect(t?.line).toBe(1);
    expect(t?.col).toBe(1);
  });

  it("second line token has correct line number", () => {
    const toks = tokenize("a\nb");
    // 'b' should be on line 2
    const b = toks.find((t) => t.value === "b");
    expect(b?.line).toBe(2);
    expect(b?.col).toBe(1);
  });

  it("col advances correctly within a line", () => {
    const toks = tokenize("foo bar");
    const bar = toks.find((t) => t.value === "bar");
    expect(bar?.col).toBe(5);
  });

  it("UTF-8 source tokenises without error", () => {
    // Non-ASCII content inside a string should not break the lexer
    const src = `@type Élan { name: "héllo" }`;
    expect(() => tokenize(src)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Duration literals
// ---------------------------------------------------------------------------

describe("duration literals", () => {
  it("tokenises 5m as DURATION", () => {
    expect(types("5m")).toEqual([TokenType.DURATION]);
    expect(values("5m")).toEqual(["5m"]);
  });

  it("tokenises 30s as DURATION", () => {
    expect(types("30s")).toEqual([TokenType.DURATION]);
    expect(values("30s")).toEqual(["30s"]);
  });

  it("tokenises 24h as DURATION", () => {
    expect(types("24h")).toEqual([TokenType.DURATION]);
    expect(values("24h")).toEqual(["24h"]);
  });

  it("tokenises 7d as DURATION", () => {
    expect(types("7d")).toEqual([TokenType.DURATION]);
    expect(values("7d")).toEqual(["7d"]);
  });

  it("tokenises 0s as DURATION (zero value is valid)", () => {
    expect(types("0s")).toEqual([TokenType.DURATION]);
    expect(values("0s")).toEqual(["0s"]);
  });

  it("5 m (with space) produces NUMBER + IDENT — not DURATION", () => {
    expect(types("5 m")).toEqual([TokenType.NUMBER, TokenType.IDENT]);
    expect(values("5 m")).toEqual(["5", "m"]);
  });

  it("5x produces NUMBER + IDENT — x is not a duration unit", () => {
    expect(types("5x")).toEqual([TokenType.NUMBER, TokenType.IDENT]);
    expect(values("5x")).toEqual(["5", "x"]);
  });

  it("5ms produces NUMBER + IDENT — m is immediately followed by s (ident char)", () => {
    expect(types("5ms")).toEqual([TokenType.NUMBER, TokenType.IDENT]);
    expect(values("5ms")).toEqual(["5", "ms"]);
  });

  it("duration in colon context: timeout: 30s", () => {
    const toks = tokenize("timeout: 30s").filter((t) => t.type !== TokenType.EOF);
    expect(toks.map((t) => t.type)).toEqual([TokenType.IDENT, TokenType.COLON, TokenType.DURATION]);
    expect(toks[2]?.value).toBe("30s");
  });
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

describe("comments", () => {
  it("line comment is skipped", () => {
    expect(types("// this is a comment\n@type")).toEqual([TokenType.AT_TYPE]);
  });

  it("inline comment after token is skipped", () => {
    expect(values("foo // comment")).toEqual(["foo"]);
  });
});
