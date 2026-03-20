/**
 * Unit tests for @openstrux/config
 */
import { describe, expect, it } from "vitest";
import { parseContextFile } from "../context-parser.js";
import { mergeDp, mergeAccess, mergeOps } from "../merge.js";

// ---------------------------------------------------------------------------
// parseContextFile tests
// ---------------------------------------------------------------------------

describe("parseContextFile — @dp block", () => {
  it("parses @dp block", () => {
    const src = `@dp { controller: "Legal", dpo: "dpo@company.com" }`;
    const { raw, diagnostics } = parseContextFile(src, "test.context");
    expect(diagnostics).toHaveLength(0);
    expect(raw.dp["controller"]).toEqual({ kind: "string", value: "Legal" });
    expect(raw.dp["dpo"]).toEqual({
      kind: "string",
      value: "dpo@company.com",
    });
  });

  it("parses @access block", () => {
    const src = `@access { purpose: "grant_review", operation: "read" }`;
    const { raw, diagnostics } = parseContextFile(src, "test.context");
    expect(diagnostics).toHaveLength(0);
    expect(raw.access["purpose"]).toEqual({
      kind: "string",
      value: "grant_review",
    });
  });

  it("parses @ops block", () => {
    const src = `@ops { retry: 3, timeout: "30s" }`;
    const { raw, diagnostics } = parseContextFile(src, "test.context");
    expect(diagnostics).toHaveLength(0);
    expect(raw.ops["retry"]).toEqual({ kind: "number", value: 3 });
    expect(raw.ops["timeout"]).toEqual({ kind: "string", value: "30s" });
  });

  it("parses @source block", () => {
    const src = `@source production { type: db.sql.postgres, host: "prod.db" }`;
    const { raw, diagnostics } = parseContextFile(src, "test.context");
    expect(diagnostics).toHaveLength(0);
    expect(raw.sources["production"]).toBeDefined();
    expect(raw.sources["production"]?.config["host"]).toEqual({
      kind: "string",
      value: "prod.db",
    });
  });

  it("parses @target block", () => {
    const src = `@target warehouse { type: db.sql.postgres, host: "wh.db" }`;
    const { raw, diagnostics } = parseContextFile(src, "test.context");
    expect(diagnostics).toHaveLength(0);
    expect(raw.targets["warehouse"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// @cert-in-context rejection (ADR-011 / CI-006)
// ---------------------------------------------------------------------------

describe("parseContextFile — @cert rejection", () => {
  it("emits E_CERT_IN_CONTEXT when @cert block found in context file", () => {
    const src = `@dp { controller: "Legal" }\n@cert { level: "L1", hash: "abc123" }`;
    const { raw, diagnostics } = parseContextFile(src, "strux.context");
    expect(raw.hasCert).toBe(true);
    const certDiag = diagnostics.find((d) => d.code === "E_CERT_IN_CONTEXT");
    expect(certDiag).toBeDefined();
    expect(certDiag?.severity).toBe("error");
  });

  it("does NOT emit E_CERT_IN_CONTEXT when no @cert block", () => {
    const src = `@dp { controller: "Legal" }`;
    const { raw, diagnostics } = parseContextFile(src, "strux.context");
    expect(raw.hasCert).toBe(false);
    expect(
      diagnostics.find((d) => d.code === "E_CERT_IN_CONTEXT"),
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Merge semantics
// ---------------------------------------------------------------------------

describe("mergeDp — field-level merge (CI-002)", () => {
  it("merges dp blocks, nearest wins", () => {
    const root = {
      controller: { kind: "string" as const, value: "Legal" },
      record: { kind: "string" as const, value: "R-001" },
    };
    const folder = {
      processor: { kind: "string" as const, value: "TechPartner" },
    };
    const result = mergeDp([root, folder]);
    expect(result["controller"]).toEqual({ kind: "string", value: "Legal" });
    expect(result["processor"]).toEqual({
      kind: "string",
      value: "TechPartner",
    });
  });

  it("panel wins on conflict", () => {
    const root = {
      controller: { kind: "string" as const, value: "Root Corp" },
    };
    const panel = {
      controller: { kind: "string" as const, value: "Panel Corp" },
    };
    const result = mergeDp([root, panel]);
    expect(result["controller"]).toEqual({
      kind: "string",
      value: "Panel Corp",
    });
  });
});

describe("mergeAccess — scope narrowing enforcement (CI-003)", () => {
  it("allows child with same fields as parent (no widening)", () => {
    const parent = {
      scope: {
        kind: "block" as const,
        config: {
          fields: { kind: "raw-expr" as const, text: "[name, email]" },
        },
      },
    };
    const child = {
      scope: {
        kind: "block" as const,
        config: {
          fields: { kind: "raw-expr" as const, text: "[name]" },
        },
      },
    };
    const { merged, diagnostics } = mergeAccess([
      { access: parent, filePath: "root/strux.context" },
      { access: child, filePath: "panel/strux.context" },
    ]);
    expect(diagnostics).toHaveLength(0);
    expect(merged["scope"]).toBeDefined();
  });

  it("emits E_ACCESS_WIDENING when child adds fields beyond parent scope", () => {
    const parent = {
      scope: {
        kind: "block" as const,
        config: {
          fields: { kind: "raw-expr" as const, text: "[name, email]" },
        },
      },
    };
    const child = {
      scope: {
        kind: "block" as const,
        config: {
          fields: { kind: "raw-expr" as const, text: "[name, email, ssn]" },
        },
      },
    };
    const { diagnostics } = mergeAccess([
      { access: parent, filePath: "root/strux.context" },
      { access: child, filePath: "panel/strux.context" },
    ]);
    const widening = diagnostics.find((d) => d.code === "E_ACCESS_WIDENING");
    expect(widening).toBeDefined();
    expect(widening?.severity).toBe("error");
  });
});

describe("mergeOps — nearest wins (CI-004)", () => {
  it("nearest layer wins per field", () => {
    const root = {
      retry: { kind: "number" as const, value: 3 },
      timeout: { kind: "string" as const, value: "30s" },
    };
    const folder = { retry: { kind: "number" as const, value: 5 } };
    const result = mergeOps([root, folder]);
    expect(result["retry"]).toEqual({ kind: "number", value: 5 });
    expect(result["timeout"]).toEqual({ kind: "string", value: "30s" });
  });
});
