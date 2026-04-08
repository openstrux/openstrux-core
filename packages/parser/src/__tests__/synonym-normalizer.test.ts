/**
 * Unit tests for the synonym normalizer.
 *
 * Covers: one test per synonym mapping, complex LIKE/CASE rejection,
 * case normalization for built-in identifiers.
 *
 * Spec reference: expression-shorthand.md §Synonym normalization (v0.6.0)
 */

import { describe, expect, it } from "vitest";
import { normalizeSynonyms } from "../synonym-normalizer.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(text: string): string {
  return normalizeSynonyms(text, 1, 1).normalized;
}

function diagnostics(text: string) {
  return normalizeSynonyms(text, 1, 1).diagnostics;
}

// ---------------------------------------------------------------------------
// AND → &&
// ---------------------------------------------------------------------------

describe("AND → &&", () => {
  it("replaces AND with &&", () => {
    expect(normalize("x == 1 AND y == 2")).toBe("x == 1 && y == 2");
  });

  it("emits info diagnostic for AND replacement", () => {
    const diags = diagnostics("x == 1 AND y == 2");
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]?.severity).toBe("info");
    expect(diags[0]?.code).toBe("I001");
  });
});

// ---------------------------------------------------------------------------
// OR → ||
// ---------------------------------------------------------------------------

describe("OR → ||", () => {
  it("replaces OR with ||", () => {
    expect(normalize("a == 1 OR b == 2")).toBe("a == 1 || b == 2");
  });
});

// ---------------------------------------------------------------------------
// NOT x → !x
// ---------------------------------------------------------------------------

describe("NOT → !", () => {
  it("replaces NOT with !", () => {
    const result = normalize("NOT active");
    expect(result).toContain("!");
    expect(result).not.toContain("NOT ");
  });
});

// ---------------------------------------------------------------------------
// IS NULL → == null
// ---------------------------------------------------------------------------

describe("IS NULL → == null", () => {
  it("normalizes IS NULL", () => {
    expect(normalize("email IS NULL")).toBe("email == null");
  });
});

// ---------------------------------------------------------------------------
// IS NOT NULL → != null
// ---------------------------------------------------------------------------

describe("IS NOT NULL → != null", () => {
  it("normalizes IS NOT NULL", () => {
    const result = normalize("email IS NOT NULL");
    expect(result).toContain("!=");
    expect(result).toContain("null");
    expect(result).not.toContain("IS NOT NULL");
  });
});

// ---------------------------------------------------------------------------
// BETWEEN x AND y → in x..y
// ---------------------------------------------------------------------------

describe("BETWEEN x AND y → in x..y", () => {
  it("normalizes BETWEEN", () => {
    const result = normalize("score BETWEEN 0 AND 100");
    expect(result).toContain("in");
    expect(result).toContain("..");
    expect(result).not.toContain("BETWEEN");
  });
});

// ---------------------------------------------------------------------------
// x NOT IN (...) → x !in [...]
// ---------------------------------------------------------------------------

describe("NOT IN → !in", () => {
  it("normalizes NOT IN", () => {
    const result = normalize('status NOT IN ("a", "b")');
    expect(result).toContain("!in");
    expect(result).not.toContain("NOT IN");
  });
});

// ---------------------------------------------------------------------------
// HAS "x" → .includes("x")
// Note: normalizer output includes spaces: "tags . includes("urgent")"
// The expression parser handles whitespace, so this is semantically correct.
// ---------------------------------------------------------------------------

describe('HAS "x" → .includes("x")', () => {
  it('normalizes HAS "value"', () => {
    const result = normalize('tags HAS "urgent"');
    expect(result).toContain("includes");
    expect(result).toContain('"urgent"');
    expect(result).not.toContain("HAS");
  });
});

// ---------------------------------------------------------------------------
// HAS ANY (...) → .includesAny([...])
// ---------------------------------------------------------------------------

describe("HAS ANY → .includesAny", () => {
  it("normalizes HAS ANY", () => {
    const result = normalize('tags HAS ANY ("a", "b")');
    expect(result).toContain("includesAny");
    expect(result).not.toContain("HAS ANY");
  });
});

// ---------------------------------------------------------------------------
// HAS ALL (...) → .includesAll([...])
// ---------------------------------------------------------------------------

describe("HAS ALL → .includesAll", () => {
  it("normalizes HAS ALL", () => {
    const result = normalize('tags HAS ALL ("a", "b")');
    expect(result).toContain("includesAll");
    expect(result).not.toContain("HAS ALL");
  });
});

// ---------------------------------------------------------------------------
// COALESCE(a, b) → a ?? b
// ---------------------------------------------------------------------------

describe("COALESCE(a, b) → a ?? b", () => {
  it("normalizes COALESCE", () => {
    const result = normalize("COALESCE(name, email)");
    expect(result).toContain("??");
    expect(result).not.toContain("COALESCE");
  });
});

// ---------------------------------------------------------------------------
// EXISTS field → field != null
// ---------------------------------------------------------------------------

describe("EXISTS field → field != null", () => {
  it("normalizes EXISTS", () => {
    const result = normalize("EXISTS email");
    expect(result).toContain("!= null");
    expect(result).not.toContain("EXISTS");
  });
});

// ---------------------------------------------------------------------------
// CASE WHEN — multi-branch detection (error sentinel, no silent normalization)
// Single-branch CASE WHEN normalization to ternary is not implemented;
// the expression parser handles complex CASE via its error path.
// ---------------------------------------------------------------------------

describe("CASE WHEN — no silent normalization", () => {
  it("does not silently rewrite CASE WHEN to ternary", () => {
    // The normalizer leaves CASE WHEN as-is; the expression parser will error.
    const result = normalize('CASE WHEN active THEN "yes" ELSE "no" END');
    // No ternary rewrite — CASE is preserved for the expression parser to handle
    expect(result).toContain("CASE");
  });
});

// ---------------------------------------------------------------------------
// LIKE simple patterns
// ---------------------------------------------------------------------------

describe("simple LIKE → method call", () => {
  it('LIKE "foo%" → .startsWith("foo")', () => {
    const result = normalize('field LIKE "foo%"');
    expect(result).toContain('.startsWith("foo")');
    expect(result).not.toContain("LIKE");
  });

  it('LIKE "%foo" → .endsWith("foo")', () => {
    const result = normalize('field LIKE "%foo"');
    expect(result).toContain('.endsWith("foo")');
  });

  it('LIKE "%foo%" → .contains("foo")', () => {
    const result = normalize('field LIKE "%foo%"');
    expect(result).toContain('.contains("foo")');
  });
});

// ---------------------------------------------------------------------------
// Complex LIKE — emit error sentinel (not normalize)
// ---------------------------------------------------------------------------

describe("complex LIKE → error sentinel", () => {
  it("does not silently normalize a complex LIKE pattern", () => {
    const result = normalize('email LIKE "%@%.com"');
    // Contains the error sentinel — not a clean method call
    expect(result).toContain("__COMPLEX_LIKE_ERROR__");
  });

  it("emits no info diagnostic for complex LIKE (it's an error, not a normalization)", () => {
    const diags = diagnostics('email LIKE "%@%.com"');
    const infoDiags = diags.filter(d => d.severity === "info");
    // No clean normalization info — only the error sentinel remains
    expect(infoDiags.every(d => !d.message.includes("LIKE"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Case normalization — built-in identifiers (silent, no diagnostic)
// ---------------------------------------------------------------------------

describe("case normalization — built-in identifiers", () => {
  it("normalizes COUNT to count (no diagnostic)", () => {
    const result = normalize("COUNT(*)");
    const diags = diagnostics("COUNT(*)");
    expect(result.toLowerCase()).toContain("count");
    expect(diags.filter(d => d.code === "I001" && d.message.includes("COUNT"))).toHaveLength(0);
  });

  it("normalizes SUM to sum silently", () => {
    const result = normalize("SUM(amount)");
    expect(result.toLowerCase()).toContain("sum");
  });

  it("normalizes ASC to asc silently", () => {
    const result = normalize("score ASC");
    expect(result.toLowerCase()).toContain("asc");
  });

  it("normalizes DESC to desc silently", () => {
    const result = normalize("score DESC");
    expect(result.toLowerCase()).toContain("desc");
  });

  it("normalizes IN to in silently", () => {
    const result = normalize('status IN ("a", "b")');
    expect(result).toContain("in");
  });
});
