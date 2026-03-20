/**
 * Unit tests for @openstrux/validator
 */
import { describe, expect, it } from "vitest";
import { parse } from "@openstrux/parser";
import { validate } from "../validator.js";
import { SymbolTable } from "../symbol-table.js";
import { classifyPolicyTier } from "../policy-resolver.js";

// ---------------------------------------------------------------------------
// Valid input — zero diagnostics
// ---------------------------------------------------------------------------

describe("valid P0 domain model — zero semantic diagnostics", () => {
  it("emits no semantic errors for a well-formed panel", () => {
    const src = `
@type Proposal {
  id: string
  title: string
  status: ReviewStatus
}
@type ReviewStatus = enum { draft, submitted, approved }
@panel intake-proposals {
  @dp { controller: "NLnet Foundation", record: "GW-INTAKE-001" }
  @access { purpose: "grant_intake", operation: "write" }
  intake = receive { trigger: http { method: "POST", path: "/proposals" } }
  validate-schema = validate { schema: Proposal }
  store-proposal = write-data { target: db.sql.postgres { host: "localhost", port: 5432, db_name: "grants", tls: true } }
}`;
    const parseResult = parse(src);
    const result = validate(parseResult);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// V001 — unresolved type reference
// ---------------------------------------------------------------------------

describe("V001 — unresolved type reference", () => {
  it("emits V001 for a type not defined in the source", () => {
    const src = `
@panel p {
  @access { purpose: "test", operation: "read" }
  r = validate { schema: UnknownType }
}`;
    const parseResult = parse(src);
    const result = validate(parseResult);
    const v001 = result.diagnostics.find((d) => d.code === "V001");
    expect(v001).toBeDefined();
    expect(v001?.severity).toBe("error");
    expect(v001?.message).toContain("UnknownType");
  });

  it("does NOT emit V001 for a primitive type", () => {
    const src = `
@type Order {
  id: string
  count: number
}
@panel p {
  @access { purpose: "test", operation: "read" }
  r = validate { schema: Order }
}`;
    const parseResult = parse(src);
    const result = validate(parseResult);
    const v001 = result.diagnostics.find((d) => d.code === "V001");
    expect(v001).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// W002 — missing @access block
// ---------------------------------------------------------------------------

describe("W002 — missing @access block", () => {
  it("emits W002 when @panel has no @access block", () => {
    const src = `
@panel no-access {
  @dp { controller: "Acme" }
  r = receive { trigger: http { method: "GET" } }
}`;
    const parseResult = parse(src);
    const result = validate(parseResult);
    const w002 = result.diagnostics.find((d) => d.code === "W002");
    expect(w002).toBeDefined();
    expect(w002?.severity).toBe("warning");
  });

  it("does NOT emit W002 when @access is present", () => {
    const src = `
@panel with-access {
  @access { purpose: "test", operation: "read" }
  r = receive { trigger: http { method: "GET" } }
}`;
    const parseResult = parse(src);
    const result = validate(parseResult);
    const w002 = result.diagnostics.find((d) => d.code === "W002");
    expect(w002).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// W003 — non-PascalCase type name
// ---------------------------------------------------------------------------

describe("W003 — non-PascalCase type name", () => {
  it("emits W003 for a lowercase type name", () => {
    const src = `@type myType { id: string }`;
    const parseResult = parse(src);
    const result = validate(parseResult);
    const w003 = result.diagnostics.find((d) => d.code === "W003");
    expect(w003).toBeDefined();
    expect(w003?.severity).toBe("warning");
  });

  it("does NOT emit W003 for PascalCase type name", () => {
    const src = `@type MyType { id: string }`;
    const parseResult = parse(src);
    const result = validate(parseResult);
    const w003 = result.diagnostics.find((d) => d.code === "W003");
    expect(w003).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// W_POLICY_OPAQUE — guard with external policy
// ---------------------------------------------------------------------------

describe("W_POLICY_OPAQUE — guard with external policy", () => {
  it("emits W_POLICY_OPAQUE for a guard rod referencing an OPA policy", () => {
    const src = `
@panel secure-api {
  @access { purpose: "api_access", operation: "read" }
  r = receive { trigger: http { method: "GET" } }
  g = guard { policy: opa { policy_id: "my-policy" } }
  d = read-data { source: db.sql.postgres { host: "localhost", port: 5432 } }
}`;
    const parseResult = parse(src);
    const result = validate(parseResult);
    const wpo = result.diagnostics.find((d) => d.code === "W_POLICY_OPAQUE");
    expect(wpo).toBeDefined();
    expect(wpo?.severity).toBe("warning");
  });

  it("does NOT emit W_POLICY_OPAQUE for an inline policy", () => {
    const src = `
@panel secure-api {
  @access { purpose: "api_access", operation: "read" }
  r = receive { trigger: http { method: "GET" } }
  g = guard { policy: { rules: [] } }
  d = read-data { source: db.sql.postgres { host: "localhost", port: 5432 } }
}`;
    const parseResult = parse(src);
    const result = validate(parseResult);
    const wpo = result.diagnostics.find((d) => d.code === "W_POLICY_OPAQUE");
    expect(wpo).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// V002 — snap chain type mismatch
// ---------------------------------------------------------------------------

describe("V002 — snap chain mismatch", () => {
  it("does NOT emit V002 for aggregate → store (Single → Single)", () => {
    const src = `
@panel p {
  @access { purpose: "test", operation: "read" }
  r = read-data { source: db.sql.postgres { host: "h", port: 5432 } }
  a = aggregate { fn: "count" }
  s = store { backend: redis { host: "localhost", port: 6379 }, mode: put }
}`;
    const parseResult = parse(src);
    const result = validate(parseResult);
    // aggregate → store: Single → Single, should be OK
    const v002 = result.diagnostics.find((d) => d.code === "V002");
    expect(v002).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// SymbolTable
// ---------------------------------------------------------------------------

describe("SymbolTable", () => {
  it("populates from AST and resolves type names", () => {
    const src = `@type Proposal { id: string } @type Status = enum { draft, submitted }`;
    const { ast } = parse(src);
    const table = new SymbolTable();
    table.populate(ast);
    expect(table.has("Proposal")).toBe(true);
    expect(table.has("Status")).toBe(true);
    expect(table.has("Unknown")).toBe(false);
    expect(table.lookup("Proposal")?.kind).toBe("record");
    expect(table.lookup("Status")?.kind).toBe("enum");
  });
});

// ---------------------------------------------------------------------------
// classifyPolicyTier
// ---------------------------------------------------------------------------

describe("classifyPolicyTier", () => {
  it("classifies inline policy as inline", () => {
    expect(
      classifyPolicyTier({
        kind: "block",
        config: { rules: { kind: "raw-expr", text: "[]" } },
      }),
    ).toBe("inline");
  });

  it("classifies OPA as external", () => {
    expect(
      classifyPolicyTier({ kind: "path", segments: ["opa", "policy_id"] }),
    ).toBe("external");
  });

  it("classifies hub path as hub", () => {
    expect(
      classifyPolicyTier({
        kind: "path",
        segments: ["hub", "my-org", "auth-policy"],
      }),
    ).toBe("hub");
  });
});
