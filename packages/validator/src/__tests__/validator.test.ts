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
    const populateDiags = table.populate(ast);
    expect(populateDiags).toEqual([]);
    expect(table.has("Proposal")).toBe(true);
    expect(table.has("Status")).toBe(true);
    expect(table.has("Unknown")).toBe(false);
    expect(table.lookup("Proposal")?.kind).toBe("record");
    expect(table.lookup("Status")?.kind).toBe("enum");
  });
});

// ---------------------------------------------------------------------------
// E_OPS_UNKNOWN_FIELD, E_OPS_TYPE_MISMATCH — rod-level @ops validation
// ---------------------------------------------------------------------------

describe("@ops field validation (rod-level)", () => {
  it("emits no errors for valid @ops fields", () => {
    const src = `@panel p {
  @access { purpose: "test", operation: "read" }
  r = call {
    @ops { retry: 3, timeout: 30s }
    endpoint: "https://api.example.com"
  }
}`;
    const result = validate(parse(src));
    const ops = result.diagnostics.filter(
      (d) => d.code === "E_OPS_UNKNOWN_FIELD" || d.code === "E_OPS_TYPE_MISMATCH",
    );
    expect(ops).toHaveLength(0);
  });

  it("emits E_OPS_UNKNOWN_FIELD for an unrecognized @ops field", () => {
    const src = `@panel p {
  @access { purpose: "test", operation: "read" }
  r = call {
    @ops { max_errors: 5 }
  }
}`;
    const result = validate(parse(src));
    const diag = result.diagnostics.find((d) => d.code === "E_OPS_UNKNOWN_FIELD");
    expect(diag).toBeDefined();
    expect(diag?.message).toContain("max_errors");
  });

  it("emits E_OPS_TYPE_MISMATCH when retry is a string", () => {
    const src = `@panel p {
  @access { purpose: "test", operation: "read" }
  r = call {
    @ops { retry: "five" }
  }
}`;
    const result = validate(parse(src));
    const diag = result.diagnostics.find((d) => d.code === "E_OPS_TYPE_MISMATCH");
    expect(diag).toBeDefined();
    expect(diag?.message).toContain("retry");
  });

  it("emits E_OPS_TYPE_MISMATCH when timeout is a number instead of duration", () => {
    const src = `@panel p {
  @access { purpose: "test", operation: "read" }
  r = call {
    @ops { timeout: 30 }
  }
}`;
    const result = validate(parse(src));
    const diag = result.diagnostics.find((d) => d.code === "E_OPS_TYPE_MISMATCH");
    expect(diag).toBeDefined();
    expect(diag?.message).toContain("timeout");
  });

  it("validates nested record fields (circuit_breaker.threshold)", () => {
    const src = `@panel p {
  @access { purpose: "test", operation: "read" }
  r = call {
    @ops { circuit_breaker: { threshold: 5, window: 1m } }
  }
}`;
    const result = validate(parse(src));
    const ops = result.diagnostics.filter(
      (d) => d.code === "E_OPS_UNKNOWN_FIELD" || d.code === "E_OPS_TYPE_MISMATCH",
    );
    expect(ops).toHaveLength(0);
  });

  it("emits E_OPS_TYPE_MISMATCH for wrong circuit_breaker subfield type", () => {
    const src = `@panel p {
  @access { purpose: "test", operation: "read" }
  r = call {
    @ops { circuit_breaker: { threshold: "high", window: 1m } }
  }
}`;
    const result = validate(parse(src));
    const diag = result.diagnostics.find((d) => d.code === "E_OPS_TYPE_MISMATCH");
    expect(diag).toBeDefined();
    expect(diag?.message).toContain("circuit_breaker.threshold");
  });
});

// ---------------------------------------------------------------------------
// E_SCHEMA_STRING, E_SCHEMA_UNRESOLVED — validate rod schema ref
// ---------------------------------------------------------------------------

describe("SchemaRef validation", () => {
  it("emits E_SCHEMA_STRING when schema is a string literal", () => {
    const src = `@panel p {
  @access { purpose: "test", operation: "read" }
  r = validate { schema: "UserPayload" }
}`;
    const result = validate(parse(src));
    const diag = result.diagnostics.find((d) => d.code === "E_SCHEMA_STRING");
    expect(diag).toBeDefined();
    expect(diag?.message).toContain("UserPayload");
  });

  it("emits E_SCHEMA_UNRESOLVED when schema identifier is not a declared @type", () => {
    const src = `@panel p {
  @access { purpose: "test", operation: "read" }
  r = validate { schema: NonExistentType }
}`;
    const result = validate(parse(src));
    const diag = result.diagnostics.find((d) => d.code === "E_SCHEMA_UNRESOLVED");
    expect(diag).toBeDefined();
    expect(diag?.message).toContain("NonExistentType");
  });

  it("emits no schema errors for valid @type SchemaRef", () => {
    const src = `
@type UserPayload { id: string, name: string }
@panel p {
  @access { purpose: "test", operation: "write" }
  r = validate { schema: UserPayload }
}`;
    const result = validate(parse(src));
    const schemaErrors = result.diagnostics.filter(
      (d) => d.code === "E_SCHEMA_STRING" || d.code === "E_SCHEMA_UNRESOLVED",
    );
    expect(schemaErrors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// E_STREAM_MISSING_FIELD — stream config validation
// ---------------------------------------------------------------------------

describe("stream config validation (write-data targets)", () => {
  it("emits no errors for valid kafka config", () => {
    const src = `@panel p {
  @access { purpose: "test", operation: "write" }
  w = write-data { target: stream.kafka { brokers: "b:9092", topic: "events" } }
}`;
    const result = validate(parse(src));
    const streamErrors = result.diagnostics.filter(
      (d) => d.code === "E_STREAM_MISSING_FIELD" || d.code === "E_STREAM_UNKNOWN_ADAPTER",
    );
    expect(streamErrors).toHaveLength(0);
  });

  it("emits E_STREAM_MISSING_FIELD when kafka is missing brokers", () => {
    const src = `@panel p {
  @access { purpose: "test", operation: "write" }
  w = write-data { target: stream.kafka { topic: "events" } }
}`;
    const result = validate(parse(src));
    const diag = result.diagnostics.find((d) => d.code === "E_STREAM_MISSING_FIELD");
    expect(diag).toBeDefined();
    expect(diag?.message).toContain("brokers");
  });

  it("emits E_STREAM_MISSING_FIELD when pubsub is missing required fields", () => {
    const src = `@panel p {
  @access { purpose: "test", operation: "write" }
  w = write-data { target: stream.pubsub { project: "my-proj" } }
}`;
    const result = validate(parse(src));
    const diag = result.diagnostics.find((d) => d.code === "E_STREAM_MISSING_FIELD");
    expect(diag).toBeDefined();
    expect(diag?.message).toContain("topic");
  });

  it("emits E_STREAM_MISSING_FIELD for kinesis missing region", () => {
    const src = `@panel p {
  @access { purpose: "test", operation: "write" }
  w = write-data { target: stream.kinesis { stream_name: "my-stream" } }
}`;
    const result = validate(parse(src));
    const diag = result.diagnostics.find((d) => d.code === "E_STREAM_MISSING_FIELD");
    expect(diag).toBeDefined();
    expect(diag?.message).toContain("region");
  });

  it("emits E_STREAM_UNKNOWN_ADAPTER for unknown stream adapter", () => {
    const src = `@panel p {
  @access { purpose: "test", operation: "write" }
  w = write-data { target: stream.rabbitmq { queue: "events" } }
}`;
    const result = validate(parse(src));
    const diag = result.diagnostics.find((d) => d.code === "E_STREAM_UNKNOWN_ADAPTER");
    expect(diag).toBeDefined();
    expect(diag?.message).toContain("rabbitmq");
  });

  it("does NOT emit stream errors for db targets (non-stream)", () => {
    const src = `@panel p {
  @access { purpose: "test", operation: "write" }
  w = write-data { target: db.sql.postgres { host: "h", port: 5432 } }
}`;
    const result = validate(parse(src));
    const streamErrors = result.diagnostics.filter(
      (d) => d.code === "E_STREAM_MISSING_FIELD" || d.code === "E_STREAM_UNKNOWN_ADAPTER",
    );
    expect(streamErrors).toHaveLength(0);
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

// ---------------------------------------------------------------------------
// V002 — snap chain mismatch (positive case)
// ---------------------------------------------------------------------------

describe("V002 — snap chain type mismatch", () => {
  it("emits V002 when filter (Stream output) is followed by respond (Single input)", () => {
    // filter outputs Stream, respond expects Single — incompatible (Stream→Single mismatch)
    const src = `@panel p {
  @access { purpose: "test", operation: "read" }
  fetch = read-data {}
  filtered = filter { where: x }
  resp = respond {}
}`;
    const result = validate(parse(src));
    const v002 = result.diagnostics.find((d) => d.code === "V002");
    expect(v002).toBeDefined();
    expect(v002?.severity).toBe("error");
  });
});

// ---------------------------------------------------------------------------
// E_DUPLICATE_TYPE (E1) — duplicate type declarations
// ---------------------------------------------------------------------------

describe("E_DUPLICATE_TYPE — duplicate type declarations", () => {
  it("emits E_DUPLICATE_TYPE when the same user-defined type is declared twice", () => {
    const src = `@type Proposal { id: string }
@type Proposal { title: string }
@panel p { @access { purpose: "test", operation: "read" } r = receive {} }`;
    const result = validate(parse(src));
    const dup = result.diagnostics.find((d) => d.code === "E_DUPLICATE_TYPE");
    expect(dup).toBeDefined();
    expect(dup?.severity).toBe("error");
    expect(dup?.message).toContain("Proposal");
  });

  it("emits W_SHADOW_BUILTIN when a user type shadows a built-in standard type", () => {
    const src = `@type PersonName { given_name: string }
@panel p { @access { purpose: "test", operation: "read" } r = receive {} }`;
    const result = validate(parse(src));
    const shadow = result.diagnostics.find((d) => d.code === "W_SHADOW_BUILTIN");
    expect(shadow).toBeDefined();
    expect(shadow?.severity).toBe("warning");
    expect(shadow?.message).toContain("PersonName");
  });
});

// ---------------------------------------------------------------------------
// W_UNKNOWN_ROD (E2) — unknown rod type in snap chain
// ---------------------------------------------------------------------------

describe("W_UNKNOWN_ROD — unknown rod type", () => {
  it("emits W_UNKNOWN_ROD for a rod with an unrecognized type in snap chain", () => {
    const src = `@panel p {
  @access { purpose: "test", operation: "read" }
  r = receive {}
  x = futuristic-rod {}
  s = respond {}
}`;
    const result = validate(parse(src));
    const warn = result.diagnostics.find((d) => d.code === "W_UNKNOWN_ROD");
    expect(warn).toBeDefined();
    expect(warn?.severity).toBe("warning");
  });
});

// ---------------------------------------------------------------------------
// E_OPS_MISSING_FIELD (E3) — required subfields for @ops record blocks
// ---------------------------------------------------------------------------

describe("E_OPS_MISSING_FIELD — required @ops subfields", () => {
  it("emits E_OPS_MISSING_FIELD when circuit_breaker is missing threshold", () => {
    const src = `@panel p {
  @access { purpose: "test", operation: "read" }
  r = call {
    @ops { circuit_breaker: { window: 1m } }
  }
}`;
    const result = validate(parse(src));
    const diag = result.diagnostics.find((d) => d.code === "E_OPS_MISSING_FIELD");
    expect(diag).toBeDefined();
    expect(diag?.message).toContain("threshold");
  });

  it("emits E_OPS_MISSING_FIELD when rate_limit is missing max", () => {
    const src = `@panel p {
  @access { purpose: "test", operation: "read" }
  r = call {
    @ops { rate_limit: { window: 1m } }
  }
}`;
    const result = validate(parse(src));
    const diag = result.diagnostics.find((d) => d.code === "E_OPS_MISSING_FIELD");
    expect(diag).toBeDefined();
    expect(diag?.message).toContain("max");
  });

  it("emits no E_OPS_MISSING_FIELD when all required subfields are present", () => {
    const src = `@panel p {
  @access { purpose: "test", operation: "read" }
  r = call {
    @ops { circuit_breaker: { threshold: 5, window: 1m } }
  }
}`;
    const result = validate(parse(src));
    const missing = result.diagnostics.filter((d) => d.code === "E_OPS_MISSING_FIELD");
    expect(missing).toHaveLength(0);
  });
});
