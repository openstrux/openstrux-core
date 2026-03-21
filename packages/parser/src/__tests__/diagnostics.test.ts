/**
 * Diagnostic unit tests — verifies that each diagnostic code is emitted
 * at the correct location for the corresponding syntax error.
 */

import { describe, expect, it } from "vitest";
import { parse } from "../parser.js";

// ---------------------------------------------------------------------------
// E001 — unclosed brace
// ---------------------------------------------------------------------------

describe("E001 — unclosed brace", () => {
  it("emits E001 when @panel brace is not closed", () => {
    const result = parse(`@panel unclosed {
  intake = receive { trigger: http { method: "POST" } }
`);
    const e001 = result.diagnostics.find((d) => d.code === "E001");
    expect(e001).toBeDefined();
    expect(e001?.severity).toBe("error");
  });

  it("emits E001 when @type record brace is not closed", () => {
    const result = parse(`@type Foo {
  id: string
`);
    const e001 = result.diagnostics.find((d) => d.code === "E001");
    expect(e001).toBeDefined();
  });

  it("provides valid line/col on E001", () => {
    const result = parse("@panel p {\n  r = receive {}\n");
    const e001 = result.diagnostics.find((d) => d.code === "E001");
    if (e001 !== undefined) {
      expect(e001.line).toBeGreaterThanOrEqual(1);
      expect(e001.col).toBeGreaterThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// E002 — unknown rod type
// ---------------------------------------------------------------------------

describe("E002 — unknown rod type", () => {
  it("emits E002 for a completely unknown rod type", () => {
    const result = parse(`@panel p {
  @access { purpose: "test", operation: "read" }
  r = my-custom-rod { mode: "x" }
}`);
    const e002 = result.diagnostics.find((d) => d.code === "E002");
    expect(e002).toBeDefined();
    expect(e002?.severity).toBe("error");
  });

  it("provides the rod name in the message", () => {
    const result = parse(`@panel p {
  @access { purpose: "test", operation: "read" }
  r = foobar {}
}`);
    const e002 = result.diagnostics.find((d) => d.code === "E002");
    expect(e002?.message).toContain("foobar");
  });

  it("points to the rod type token", () => {
    const src = `@panel p {
  @access { purpose: "test", operation: "read" }
  r = unknown-rod {}
}`;
    const result = parse(src);
    const e002 = result.diagnostics.find((d) => d.code === "E002");
    expect(e002?.line).toBeGreaterThanOrEqual(3);
  });

  it("does NOT emit E002 for all 18 known rod types", () => {
    const rodTypes = [
      "read-data", "write-data",
      "receive", "respond", "call",
      "transform", "filter", "group", "aggregate", "merge", "join", "window",
      "guard", "store",
      "validate", "pseudonymize", "encrypt",
      "split",
    ];
    for (const rt of rodTypes) {
      const result = parse(`@panel p {
  @access { purpose: "test", operation: "read" }
  r = ${rt} {}
}`);
      const e002 = result.diagnostics.find((d) => d.code === "E002");
      expect(e002, `E002 should not appear for rod type '${rt}'`).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// E003 — malformed type path
// ---------------------------------------------------------------------------

describe("E003 — malformed type path", () => {
  it("emits E003 for trailing dot in type path", () => {
    const result = parse(`@panel p {
  @access { purpose: "test", operation: "read" }
  r = read-data { source: db. {} }
}`);
    const e003 = result.diagnostics.find((d) => d.code === "E003");
    expect(e003).toBeDefined();
    expect(e003?.severity).toBe("error");
  });

  it("provides a useful message for E003", () => {
    const result = parse(`@panel p {
  @access { purpose: "test", operation: "read" }
  r = read-data { source: db. {} }
}`);
    const e003 = result.diagnostics.find((d) => d.code === "E003");
    expect(e003?.message).toMatch(/malformed type path/i);
  });
});

// ---------------------------------------------------------------------------
// W001 — missing @access block
// ---------------------------------------------------------------------------

describe("W001 — missing @access block", () => {
  it("emits W001 when @panel has no @access block", () => {
    const result = parse(`@panel p {
  @dp { controller: "Acme", record: "X-001" }
  r = receive { trigger: http { method: "GET" } }
}`);
    const w001 = result.diagnostics.find((d) => d.code === "W001");
    expect(w001).toBeDefined();
    expect(w001?.severity).toBe("warning");
  });

  it("does NOT emit W001 when @access is present", () => {
    const result = parse(`@panel p {
  @dp { controller: "Acme", record: "X-001" }
  @access { purpose: "test", operation: "read" }
  r = receive { trigger: http { method: "GET" } }
}`);
    const w001 = result.diagnostics.find((d) => d.code === "W001");
    expect(w001).toBeUndefined();
  });

  it("includes the panel name in the W001 message", () => {
    const result = parse(`@panel my-panel {
  r = receive { trigger: http { method: "GET" } }
}`);
    const w001 = result.diagnostics.find((d) => d.code === "W001");
    expect(w001?.message).toContain("my-panel");
  });
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Duration literal in parser
// ---------------------------------------------------------------------------

describe("duration literal parsing", () => {
  it("parses duration in cfg position (cfg.size = 5m)", () => {
    const result = parse(`@panel p {
  @access { purpose: "test", operation: "read" }
  w = window { size: 5m }
}`);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    const panel = result.ast.find((n) => n.kind === "panel");
    const rod = (panel as { rods: { name: string; knots: Record<string, { kind: string; value?: number; unit?: string }> }[] } | undefined)?.rods.find((r) => r.name === "w");
    const sizeKnot = rod?.knots["size"];
    expect(sizeKnot?.kind).toBe("duration");
    expect(sizeKnot?.value).toBe(5);
    expect((sizeKnot as { unit?: string } | undefined)?.unit).toBe("m");
  });

  it("parses duration in @ops context (timeout: 30s) — rod-level @ops", () => {
    const result = parse(`@panel p {
  @access { purpose: "test", operation: "read" }
  r = read-data {
    @ops { timeout: 30s }
    source: db.sql.postgres {}
  }
}`);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    const panel = result.ast.find((n) => n.kind === "panel");
    const rod = (panel as { rods: { name: string; ops?: Record<string, { kind: string; value?: number; unit?: string }> }[] } | undefined)?.rods.find((r) => r.name === "r");
    const timeoutOps = rod?.ops?.["timeout"];
    expect(timeoutOps?.kind).toBe("duration");
    expect(timeoutOps?.value).toBe(30);
    expect((timeoutOps as { unit?: string } | undefined)?.unit).toBe("s");
  });
});

// ---------------------------------------------------------------------------
// Rod-level @ops
// ---------------------------------------------------------------------------

describe("rod-level @ops parsing", () => {
  it("parses rod with inline @ops only", () => {
    const result = parse(`@panel p {
  @access { purpose: "test", operation: "read" }
  r = call {
    @ops { retry: 3, timeout: 10s }
  }
}`);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    const panel = result.ast.find((n) => n.kind === "panel");
    const rod = (panel as { rods: { name: string; ops?: Record<string, { kind: string; value?: unknown }> }[] } | undefined)?.rods.find((r) => r.name === "r");
    expect(rod?.ops?.["retry"]?.kind).toBe("number");
    expect(rod?.ops?.["retry"]?.value).toBe(3);
  });

  it("parses rod with @ops and regular fields", () => {
    const result = parse(`@panel p {
  @access { purpose: "test", operation: "read" }
  r = read-data {
    @ops { retry: 2 }
    source: db.sql.postgres {}
  }
}`);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    const panel = result.ast.find((n) => n.kind === "panel");
    const rod = (panel as { rods: { name: string; knots: Record<string, unknown>; ops?: Record<string, { kind: string; value?: unknown }> }[] } | undefined)?.rods.find((r) => r.name === "r");
    expect(rod?.ops).toBeDefined();
    expect(rod?.ops?.["retry"]?.value).toBe(2);
    expect(rod?.knots["source"]).toBeDefined();
  });

  it("parses rod without @ops (ops field is undefined)", () => {
    const result = parse(`@panel p {
  @access { purpose: "test", operation: "read" }
  r = read-data { source: db.sql.postgres {} }
}`);
    const panel = result.ast.find((n) => n.kind === "panel");
    const rod = (panel as { rods: { name: string; ops?: unknown }[] } | undefined)?.rods.find((r) => r.name === "r");
    expect(rod?.ops).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// no-throw guarantee
// ---------------------------------------------------------------------------

describe("no-throw guarantee", () => {
  it("never throws on malformed input", () => {
    const cases = [
      "",
      "@panel",
      "@type { bad",
      "} } } { {",
      "@panel p { = = = }",
      "@type X = wut",
    ];
    for (const src of cases) {
      expect(() => parse(src)).not.toThrow();
    }
  });
});
