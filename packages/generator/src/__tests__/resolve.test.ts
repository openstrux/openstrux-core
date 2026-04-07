/**
 * Tests for semver resolution — satisfies() and resolveOptions().
 *
 * Covers:
 *   D4 — ^0.0.x pin (must match exact patch, not range)
 *   satisfies() edge cases: ~, >=, <, =, bare version
 */

import { describe, it, expect } from "vitest";
import { satisfies } from "../resolve.js";

// ---------------------------------------------------------------------------
// D4 — ^0.0.x (pre-release: exact patch match)
// ---------------------------------------------------------------------------

describe("D4 — ^0.0.x semver (exact patch)", () => {
  it("^0.0.3 matches 0.0.3 only", () => {
    expect(satisfies("0.0.3", "^0.0.3")).toBe(true);
  });

  it("^0.0.3 does not match 0.0.4", () => {
    expect(satisfies("0.0.4", "^0.0.3")).toBe(false);
  });

  it("^0.0.3 does not match 0.0.2", () => {
    expect(satisfies("0.0.2", "^0.0.3")).toBe(false);
  });

  it("^0.0.3 does not match 0.1.0", () => {
    expect(satisfies("0.1.0", "^0.0.3")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ^ (caret) — normal semver: same major, >= base
// ---------------------------------------------------------------------------

describe("satisfies — ^ caret range", () => {
  it("^1.2.0 matches 1.3.0", () => {
    expect(satisfies("1.3.0", "^1.2.0")).toBe(true);
  });

  it("^1.2.0 does not match 2.0.0", () => {
    expect(satisfies("2.0.0", "^1.2.0")).toBe(false);
  });

  it("^0.6.0 matches 0.6.1 (minor-pinned pre-release)", () => {
    expect(satisfies("0.6.1", "^0.6.0")).toBe(true);
  });

  it("^0.6.0 does not match 0.7.0", () => {
    expect(satisfies("0.7.0", "^0.6.0")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ~ (tilde) — patch-level range
// ---------------------------------------------------------------------------

describe("satisfies — ~ tilde range", () => {
  it("~1.2.0 matches 1.2.5", () => {
    expect(satisfies("1.2.5", "~1.2.0")).toBe(true);
  });

  it("~1.2.0 does not match 1.3.0", () => {
    expect(satisfies("1.3.0", "~1.2.0")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// >= and < ranges
// ---------------------------------------------------------------------------

describe("satisfies — >= and < ranges", () => {
  it(">=13.0 <17.0 matches 14.0", () => {
    expect(satisfies("14.0", ">=13.0 <17.0")).toBe(true);
  });

  it(">=13.0 <17.0 does not match 17.0", () => {
    expect(satisfies("17.0", ">=13.0 <17.0")).toBe(false);
  });

  it(">=13.0 <17.0 does not match 12.9", () => {
    expect(satisfies("12.9", ">=13.0 <17.0")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Bare version and = exact match
// ---------------------------------------------------------------------------

describe("satisfies — exact version", () => {
  it("bare 1.2.3 matches 1.2.3", () => {
    expect(satisfies("1.2.3", "1.2.3")).toBe(true);
  });

  it("bare 1.2.3 does not match 1.2.4", () => {
    expect(satisfies("1.2.4", "1.2.3")).toBe(false);
  });

  it("=5.0.0 matches 5.0.0", () => {
    expect(satisfies("5.0.0", "=5.0.0")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Invalid input
// ---------------------------------------------------------------------------

describe("satisfies — invalid input", () => {
  it("returns false for non-semver version string", () => {
    expect(satisfies("latest", "^1.0.0")).toBe(false);
  });
});
