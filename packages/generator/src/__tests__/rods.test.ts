/**
 * Rod emitter conformance tests.
 *
 * Tests cover:
 * - All 18 rod types: generate() returns valid output without throwing
 * - Tier 1 emitters: output matches golden fixtures
 * - Tier 2 stubs: output contains STRUX-STUB
 * - Generator summary: panels with Tier 2 stubs are flagged
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi } from "vitest";
import { generate } from "../index.js";
import type { TopLevelNode } from "../types.js";
import type { Panel, Rod } from "@openstrux/ast";
import type { SplitRoutesExpr } from "@openstrux/ast";
import { emitReceive } from "../adapters/nextjs/rods/receive.js";
import { emitRespond } from "../adapters/nextjs/rods/respond.js";

const __filename = fileURLToPath(import.meta.url);
const __dirnameLocal = dirname(__filename);
const coreRoot = resolve(__dirnameLocal, "../../../../");
// Rod golden fixtures live directly in target-nextjs/ (no rods/ subdir)
const goldenRodsDir = join(coreRoot, "tests/fixtures/golden/target-nextjs");

// ---------------------------------------------------------------------------
// AST helpers — build minimal synthetic panels
// ---------------------------------------------------------------------------

function makeReceiveRod(method = "GET"): Rod {
  return {
    kind: "Rod",
    name: "receive",
    rodType: "receive",
    cfg: {
      trigger: {
        kind: "ObjectValue",
        fields: { method: { kind: "LitString", value: method } },
      } as unknown as Rod["cfg"][string],
    },
    arg: {},
  };
}

function makePanel(name: string, rods: Rod[], fieldMask?: string[]): Panel {
  return {
    kind: "Panel",
    name,
    dp: {},
    access: {
      kind: "AccessContext",
      scope: fieldMask !== undefined ? { resources: [], fieldMask } : undefined,
    },
    rods,
    snaps: [],
  };
}

function runGenerate(panel: Panel): Map<string, string> {
  const ast: TopLevelNode[] = [panel];
  const files = generate(ast, {}, { framework: "next" });
  return new Map(files.map(f => [f.path, f.content]));
}

// ---------------------------------------------------------------------------
// Normalisation (same as conformance.test.ts)
// ---------------------------------------------------------------------------

function normalise(content: string): string {
  let s = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = s.split("\n").map((l: string) => l.trimEnd());
  const collapsed: string[] = [];
  let prevBlank = false;
  for (const line of lines) {
    const blank = line === "";
    if (blank && prevBlank) continue;
    collapsed.push(line);
    prevBlank = blank;
  }
  s = collapsed.join("\n");
  const normalized: string[] = [];
  let importBlock: string[] = [];
  for (const line of s.split("\n")) {
    if (line.startsWith("import ")) {
      importBlock.push(line);
    } else {
      if (importBlock.length > 0) {
        importBlock.sort();
        normalized.push(...importBlock);
        importBlock = [];
      }
      normalized.push(line);
    }
  }
  if (importBlock.length > 0) {
    importBlock.sort();
    normalized.push(...importBlock);
  }
  return normalized.join("\n").trimEnd() + "\n";
}

// ---------------------------------------------------------------------------
// All 18 rod types: no crash, valid output
// ---------------------------------------------------------------------------

const ALL_18_RODS: Rod[] = [
  makeReceiveRod("GET"),
  { kind: "Rod", name: "resp", rodType: "respond", cfg: {}, arg: {} },
  { kind: "Rod", name: "store-op", rodType: "store", cfg: {}, arg: {} },
  { kind: "Rod", name: "write-op", rodType: "write-data", cfg: {}, arg: {} },
  { kind: "Rod", name: "read-op", rodType: "read-data", cfg: {}, arg: {} },
  { kind: "Rod", name: "guard-op", rodType: "guard", cfg: {}, arg: {} },
  { kind: "Rod", name: "val-op", rodType: "validate", cfg: {}, arg: {} },
  { kind: "Rod", name: "call-op", rodType: "call", cfg: {}, arg: {} },
  { kind: "Rod", name: "split-op", rodType: "split", cfg: {}, arg: {} },
  { kind: "Rod", name: "transform-op", rodType: "transform", cfg: {}, arg: {} },
  { kind: "Rod", name: "filter-op", rodType: "filter", cfg: {}, arg: {} },
  { kind: "Rod", name: "group-op", rodType: "group", cfg: {}, arg: {} },
  { kind: "Rod", name: "aggregate-op", rodType: "aggregate", cfg: {}, arg: {} },
  { kind: "Rod", name: "merge-op", rodType: "merge", cfg: {}, arg: {} },
  { kind: "Rod", name: "join-op", rodType: "join", cfg: {}, arg: {} },
  { kind: "Rod", name: "window-op", rodType: "window", cfg: {}, arg: {} },
  { kind: "Rod", name: "pseudonymize-op", rodType: "pseudonymize", cfg: {}, arg: {} },
  { kind: "Rod", name: "encrypt-op", rodType: "encrypt", cfg: {}, arg: {} },
];

describe("all 18 rod types: no crash", () => {
  const panel = makePanel("all-rods", ALL_18_RODS, ["email", "name"]);
  let files: Map<string, string>;

  it("generate() completes without throwing", () => {
    expect(() => {
      files = runGenerate(panel);
    }).not.toThrow();
  });

  it("produces a handlers/all-rods.ts file", () => {
    files = runGenerate(panel);
    expect(files.has("handlers/all-rods.ts")).toBe(true);
  });

  it("handlers/all-rods.ts is a non-empty string", () => {
    files = runGenerate(panel);
    const content = files.get("handlers/all-rods.ts") ?? "";
    expect(content.length).toBeGreaterThan(0);
  });

  for (const rod of ALL_18_RODS) {
    const rodType = rod.rodType;
    it(`rod type "${rodType}" does not crash`, () => {
      const panel = makePanel(`single-${rodType}`, [makeReceiveRod(), rod]);
      expect(() => runGenerate(panel)).not.toThrow();
    });
  }
});

// ---------------------------------------------------------------------------
// Tier 2 emitters — now fully implemented
// ---------------------------------------------------------------------------

describe("Tier 2 emitters: functional output", () => {
  it("group: output contains reduce-based grouping", () => {
    const rod: Rod = { kind: "Rod", name: "group-op", rodType: "group", cfg: {}, arg: {} };
    const panel = makePanel("test-group", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const handler = files.get("handlers/test-group.ts") ?? "";
    expect(handler).toContain("grouped");
    expect(handler).toContain(".reduce");
    expect(handler).not.toContain("STRUX-STUB");
  });

  it("group: uses configured key field", () => {
    const rod: Rod = {
      kind: "Rod", name: "group-op", rodType: "group",
      cfg: { key: { kind: "LitString", value: "category" } as unknown as Rod["cfg"][string] },
      arg: {},
    };
    const panel = makePanel("test-group-key", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const handler = files.get("handlers/test-group-key.ts") ?? "";
    expect(handler).toContain('"category"');
  });

  it("aggregate: count function", () => {
    const rod: Rod = {
      kind: "Rod", name: "agg-op", rodType: "aggregate",
      cfg: { fn: { kind: "LitString", value: "count" } as unknown as Rod["cfg"][string] },
      arg: {},
    };
    const panel = makePanel("test-agg-count", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const handler = files.get("handlers/test-agg-count.ts") ?? "";
    expect(handler).toContain(".length");
    expect(handler).not.toContain("STRUX-STUB");
  });

  it("aggregate: sum function with field", () => {
    const rod: Rod = {
      kind: "Rod", name: "agg-op", rodType: "aggregate",
      cfg: {
        fn: { kind: "LitString", value: "sum" } as unknown as Rod["cfg"][string],
        field: { kind: "LitString", value: "amount" } as unknown as Rod["cfg"][string],
      },
      arg: {},
    };
    const panel = makePanel("test-agg-sum", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const handler = files.get("handlers/test-agg-sum.ts") ?? "";
    expect(handler).toContain(".reduce");
    expect(handler).toContain('"amount"');
  });

  it("merge: output contains spread concat", () => {
    const rod: Rod = { kind: "Rod", name: "merge-op", rodType: "merge", cfg: {}, arg: {} };
    const panel = makePanel("test-merge", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const handler = files.get("handlers/test-merge.ts") ?? "";
    expect(handler).toContain("merged");
    expect(handler).toContain("Array.isArray");
    expect(handler).not.toContain("STRUX-STUB");
  });

  it("join: output contains join helper function", () => {
    const rod: Rod = { kind: "Rod", name: "join-op", rodType: "join", cfg: {}, arg: {} };
    const panel = makePanel("test-join", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const handler = files.get("handlers/test-join.ts") ?? "";
    expect(handler).toContain("joinJoinOp");
    expect(handler).toContain("rightIndex");
    expect(handler).not.toContain("STRUX-STUB");
  });

  it("join: respects configured mode", () => {
    const rod: Rod = {
      kind: "Rod", name: "join-op", rodType: "join",
      cfg: { mode: { kind: "LitString", value: "left" } as unknown as Rod["cfg"][string] },
      arg: {},
    };
    const panel = makePanel("test-join-left", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const handler = files.get("handlers/test-join-left.ts") ?? "";
    expect(handler).toContain("??");
  });

  it("window: output contains bucket-based windowing", () => {
    const rod: Rod = { kind: "Rod", name: "win-op", rodType: "window", cfg: {}, arg: {} };
    const panel = makePanel("test-window", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const handler = files.get("handlers/test-window.ts") ?? "";
    expect(handler).toContain("windowed");
    expect(handler).toContain("Math.floor");
    expect(handler).not.toContain("STRUX-STUB");
  });

  it("window: parses duration size", () => {
    const rod: Rod = {
      kind: "Rod", name: "win-op", rodType: "window",
      cfg: { size: { kind: "LitString", value: "30m" } as unknown as Rod["cfg"][string] },
      arg: {},
    };
    const panel = makePanel("test-window-30m", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const handler = files.get("handlers/test-window-30m.ts") ?? "";
    expect(handler).toContain("1800000"); // 30 * 60_000
  });

  it("store: output contains stateStore call", () => {
    const rod: Rod = { kind: "Rod", name: "cache", rodType: "store", cfg: {}, arg: {} };
    const panel = makePanel("test-store", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const handler = files.get("handlers/test-store.ts") ?? "";
    expect(handler).toContain("stateStore.get");
    expect(handler).not.toContain("STRUX-STUB");
  });

  it("store: put mode with namespace", () => {
    const rod: Rod = {
      kind: "Rod", name: "session-store", rodType: "store",
      cfg: {
        mode: { kind: "LitString", value: "put" } as unknown as Rod["cfg"][string],
        backend: { kind: "LitString", value: "redis" } as unknown as Rod["cfg"][string],
        namespace: { kind: "LitString", value: "sessions" } as unknown as Rod["cfg"][string],
      },
      arg: {},
    };
    const panel = makePanel("test-store-put", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const handler = files.get("handlers/test-store-put.ts") ?? "";
    expect(handler).toContain("stateStore.put");
    expect(handler).toContain("sessions");
    expect(handler).toContain("redis");
  });
});

// ---------------------------------------------------------------------------
// Generator summary: Tier 2 stub panels flagged
// ---------------------------------------------------------------------------

describe("generator summary: Tier 2 panels", () => {
  it("Tier 2 rods generate without non-demo-capable warning", () => {
    const logSpy = vi.spyOn(console, "log");
    const rod: Rod = { kind: "Rod", name: "group-op", rodType: "group", cfg: {}, arg: {} };
    const panel = makePanel("tier2-panel", [makeReceiveRod(), rod]);
    runGenerate(panel);
    const calls = logSpy.mock.calls.map(c => c.join(" "));
    // Tier 2 rods are now fully implemented — no stub warnings expected
    expect(calls.some(c => c.toLowerCase().includes("non-demo-capable"))).toBe(false);
    logSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Tier 1 emitters — spec scenario requirements
// ---------------------------------------------------------------------------

describe("Tier 1 emitters: spec scenario requirements", () => {
  it("transform: function signature contains resolved types", () => {
    const rod: Rod = {
      kind: "Rod", name: "eval", rodType: "transform",
      cfg: {
        "in": { kind: "TypeRef", name: "Proposal" } as unknown as Rod["cfg"][string],
        "out": { kind: "TypeRef", name: "EligibilityRecord" } as unknown as Rod["cfg"][string],
      },
      arg: {},
    };
    const panel = makePanel("test-transform", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const handler = files.get("handlers/test-transform.ts") ?? "";
    expect(handler).toContain("function transformEval(input: Proposal): EligibilityRecord {");
  });

  it("transform: falls back to unknown for unresolved types", () => {
    const rod: Rod = { kind: "Rod", name: "eval", rodType: "transform", cfg: {}, arg: {} };
    const panel = makePanel("test-transform-unk", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const handler = files.get("handlers/test-transform-unk.ts") ?? "";
    expect(handler).toContain("function transformEval(input: unknown): unknown {");
  });

  it("filter: with PortableFilter predicate emits .filter arrow", () => {
    const predicate: import("@openstrux/ast").CompareExpr = {
      kind: "CompareExpr",
      field: { segments: ["status"] },
      op: "eq",
      value: { kind: "string", value: "active" },
    };
    const rod: Rod = {
      kind: "Rod", name: "my-filter", rodType: "filter", cfg: {},
      arg: { predicate: predicate as unknown as Rod["arg"][string] },
    };
    const panel = makePanel("test-filter-pred", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const handler = files.get("handlers/test-filter-pred.ts") ?? "";
    expect(handler).toContain(".filter((item) =>");
  });

  it("filter: without predicate emits pass-through cast", () => {
    const rod: Rod = { kind: "Rod", name: "my-filter", rodType: "filter", cfg: {}, arg: {} };
    const panel = makePanel("test-filter", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const handler = files.get("handlers/test-filter.ts") ?? "";
    expect(handler).toContain("as unknown[]");
  });

  it("write-data: output contains prisma create call", () => {
    const rod: Rod = { kind: "Rod", name: "store-op", rodType: "write-data", cfg: {}, arg: {} };
    const panel = makePanel("test-write", [makeReceiveRod("POST"), rod]);
    const files = runGenerate(panel);
    const handler = files.get("handlers/test-write.ts") ?? "";
    expect(handler).toContain("prisma.");
    // receive → write-data: inputVar is "body" (no validate step to rename it)
    expect(handler).toContain(".create({ data: body })");
  });

  it("call: output contains fetch() call with endpoint and method", () => {
    const rod: Rod = {
      kind: "Rod", name: "ext-call", rodType: "call",
      cfg: {
        endpoint: { kind: "LitString", value: "https://api.example.com/data" } as unknown as Rod["cfg"][string],
        method: { kind: "LitString", value: "POST" } as unknown as Rod["cfg"][string],
      },
      arg: {},
    };
    const panel = makePanel("test-call", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const handler = files.get("handlers/test-call.ts") ?? "";
    expect(handler).toContain('fetch("https://api.example.com/data", { method: "POST" })');
  });

  it("split: switch block contains one case per named route", () => {
    const routesExpr: SplitRoutesExpr = {
      kind: "SplitRoutesExpr",
      routes: [
        { name: "eligible", predicate: null },
        { name: "ineligible", predicate: null },
      ],
    };
    const rod: Rod = {
      kind: "Rod", name: "route-split", rodType: "split",
      cfg: {},
      arg: { routes: routesExpr as unknown as Rod["arg"][string] },
    };
    const panel = makePanel("test-split", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const handler = files.get("handlers/test-split.ts") ?? "";
    expect(handler).toContain('case "eligible":');
    expect(handler).toContain('case "ineligible":');
  });

  it("pseudonymize: JSDoc cites scope fieldMask fields", () => {
    const rod: Rod = { kind: "Rod", name: "anon-op", rodType: "pseudonymize", cfg: {}, arg: {} };
    const panel = makePanel("test-pseudo", [makeReceiveRod(), rod], ["email", "name"]);
    const files = runGenerate(panel);
    const handler = files.get("handlers/test-pseudo.ts") ?? "";
    expect(handler).toContain("@access scope.fieldMask: email, name");
  });

  it("encrypt: JSDoc cites scope fieldMask fields", () => {
    const rod: Rod = { kind: "Rod", name: "enc-op", rodType: "encrypt", cfg: {}, arg: {} };
    const panel = makePanel("test-encrypt", [makeReceiveRod(), rod], ["ssn", "dob"]);
    const files = runGenerate(panel);
    const handler = files.get("handlers/test-encrypt.ts") ?? "";
    expect(handler).toContain("@access scope.fieldMask: ssn, dob");
  });
});

// ---------------------------------------------------------------------------
// Golden fixture conformance — Tier 1 emitters
// Golden files for rods are named: rod-<type>--handlers--<panel>.ts
// They map to: handlers/<panel>.ts in generated output
// ---------------------------------------------------------------------------

describe("rod golden fixtures", () => {
  if (!existsSync(goldenRodsDir)) return;
  const goldenFiles = readdirSync(goldenRodsDir)
    .filter(f => f.startsWith("rod-") && f.endsWith(".ts"))
    .sort();

  if (goldenFiles.length === 0) return;

  it("transform golden: matches expected output", () => {
    const goldenFile = goldenFiles.find(f => f.startsWith("rod-transform--"));
    if (goldenFile === undefined) return;
    const goldenContent = readFileSync(join(goldenRodsDir, goldenFile), "utf-8");
    const rod: Rod = {
      kind: "Rod", name: "eval", rodType: "transform",
      cfg: {
        "in": { kind: "TypeRef", name: "Proposal" } as unknown as Rod["cfg"][string],
        "out": { kind: "TypeRef", name: "EligibilityRecord" } as unknown as Rod["cfg"][string],
      },
      arg: {},
    };
    const panel = makePanel("test-transform", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const actual = files.get("handlers/test-transform.ts") ?? "";
    expect(normalise(actual)).toEqual(normalise(goldenContent));
  });

  it("filter golden: matches expected output", () => {
    const goldenFile = goldenFiles.find(f => f.startsWith("rod-filter--"));
    if (goldenFile === undefined) return;
    const goldenContent = readFileSync(join(goldenRodsDir, goldenFile), "utf-8");
    const rod: Rod = { kind: "Rod", name: "my-filter", rodType: "filter", cfg: {}, arg: {} };
    const panel = makePanel("test-filter", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const actual = files.get("handlers/test-filter.ts") ?? "";
    expect(normalise(actual)).toEqual(normalise(goldenContent));
  });

  it("write-data golden: matches expected output", () => {
    const goldenFile = goldenFiles.find(f => f.startsWith("rod-write-data--"));
    if (goldenFile === undefined) return;
    const goldenContent = readFileSync(join(goldenRodsDir, goldenFile), "utf-8");
    const rod: Rod = { kind: "Rod", name: "store-op", rodType: "write-data", cfg: {}, arg: {} };
    const panel = makePanel("test-write-data", [makeReceiveRod("POST"), rod]);
    const files = runGenerate(panel);
    const actual = files.get("handlers/test-write-data.ts") ?? "";
    expect(normalise(actual)).toEqual(normalise(goldenContent));
  });

  it("call golden: matches expected output", () => {
    const goldenFile = goldenFiles.find(f => f.startsWith("rod-call--"));
    if (goldenFile === undefined) return;
    const goldenContent = readFileSync(join(goldenRodsDir, goldenFile), "utf-8");
    const rod: Rod = {
      kind: "Rod", name: "ext-call", rodType: "call",
      cfg: {
        endpoint: { kind: "LitString", value: "https://api.example.com/data" } as unknown as Rod["cfg"][string],
        method: { kind: "LitString", value: "POST" } as unknown as Rod["cfg"][string],
      },
      arg: {},
    };
    const panel = makePanel("test-call", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const actual = files.get("handlers/test-call.ts") ?? "";
    expect(normalise(actual)).toEqual(normalise(goldenContent));
  });

  it("split golden: matches expected output", () => {
    const goldenFile = goldenFiles.find(f => f.startsWith("rod-split--"));
    if (goldenFile === undefined) return;
    const goldenContent = readFileSync(join(goldenRodsDir, goldenFile), "utf-8");
    const routesExpr: SplitRoutesExpr = {
      kind: "SplitRoutesExpr",
      routes: [
        { name: "eligible", predicate: null },
        { name: "ineligible", predicate: null },
      ],
    };
    const rod: Rod = {
      kind: "Rod", name: "route-split", rodType: "split",
      cfg: {},
      arg: { routes: routesExpr as unknown as Rod["arg"][string] },
    };
    const panel = makePanel("test-split", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const actual = files.get("handlers/test-split.ts") ?? "";
    expect(normalise(actual)).toEqual(normalise(goldenContent));
  });

  it("pseudonymize golden: matches expected output", () => {
    const goldenFile = goldenFiles.find(f => f.startsWith("rod-pseudonymize--"));
    if (goldenFile === undefined) return;
    const goldenContent = readFileSync(join(goldenRodsDir, goldenFile), "utf-8");
    const rod: Rod = { kind: "Rod", name: "anon-op", rodType: "pseudonymize", cfg: {}, arg: {} };
    const panel = makePanel("test-pseudo", [makeReceiveRod(), rod], ["email", "name"]);
    const files = runGenerate(panel);
    const actual = files.get("handlers/test-pseudo.ts") ?? "";
    expect(normalise(actual)).toEqual(normalise(goldenContent));
  });

  it("encrypt golden: matches expected output", () => {
    const goldenFile = goldenFiles.find(f => f.startsWith("rod-encrypt--"));
    if (goldenFile === undefined) return;
    const goldenContent = readFileSync(join(goldenRodsDir, goldenFile), "utf-8");
    const rod: Rod = { kind: "Rod", name: "enc-op", rodType: "encrypt", cfg: {}, arg: {} };
    const panel = makePanel("test-encrypt", [makeReceiveRod(), rod], ["ssn", "dob"]);
    const files = runGenerate(panel);
    const actual = files.get("handlers/test-encrypt.ts") ?? "";
    expect(normalise(actual)).toEqual(normalise(goldenContent));
  });
});

// ---------------------------------------------------------------------------
// D2 — receive emitter: GET/DELETE operations emit const body = {}
// ---------------------------------------------------------------------------

describe("D2 — method-aware receive emitter", () => {
  function makePanelWithOp(operation: string): Panel {
    return {
      kind: "Panel",
      name: "test-panel",
      dp: {},
      access: {
        kind: "AccessContext",
        intent: { purpose: "test", basis: "", operation: operation as "read" | "write" | "delete" | "transform" | "export" | "audit", urgency: "routine" },
      },
      rods: [],
      snaps: [],
    };
  }

  it("emits 'const body = {}' for read operation (no req.json())", () => {
    const ctx = { panel: makePanelWithOp("read"), previousSteps: [], inputVar: "req", inputType: "NextRequest" };
    const rod: Rod = { kind: "Rod", name: "r", rodType: "receive", cfg: {}, arg: {} };
    const step = emitReceive(rod, ctx);
    expect(step.statement).toBe("const body = {};");
    expect(step.statement).not.toContain("req.json");
  });

  it("emits 'const body = {}' for delete operation", async () => {
    const ctx = { panel: makePanelWithOp("delete"), previousSteps: [], inputVar: "req", inputType: "NextRequest" };
    const rod: Rod = { kind: "Rod", name: "r", rodType: "receive", cfg: {}, arg: {} };
    const step = emitReceive(rod, ctx);
    expect(step.statement).toBe("const body = {};");
  });

  it("emits 'await req.json()' for write operation", async () => {
    const ctx = { panel: makePanelWithOp("write"), previousSteps: [], inputVar: "req", inputType: "NextRequest" };
    const rod: Rod = { kind: "Rod", name: "r", rodType: "receive", cfg: {}, arg: {} };
    const step = emitReceive(rod, ctx);
    expect(step.statement).toContain("req.json");
  });
});

// ---------------------------------------------------------------------------
// D3 — respond emitter: operation-based status codes
// ---------------------------------------------------------------------------

describe("D3 — method-aware respond emitter", () => {
  function makePanelWithOp(operation: string): Panel {
    return {
      kind: "Panel",
      name: "test-panel",
      dp: {},
      access: {
        kind: "AccessContext",
        intent: { purpose: "test", basis: "", operation: operation as "read" | "write" | "delete" | "transform" | "export" | "audit", urgency: "routine" },
      },
      rods: [],
      snaps: [],
    };
  }

  it("emits status 200 for read operation", async () => {
    const ctx = { panel: makePanelWithOp("read"), previousSteps: [], inputVar: "result", inputType: "unknown" };
    const rod: Rod = { kind: "Rod", name: "resp", rodType: "respond", cfg: {}, arg: {} };
    const step = emitRespond(rod, ctx);
    expect(step.statement).toContain("status: 200");
  });

  it("emits status 201 for write operation", async () => {
    const ctx = { panel: makePanelWithOp("write"), previousSteps: [], inputVar: "result", inputType: "unknown" };
    const rod: Rod = { kind: "Rod", name: "resp", rodType: "respond", cfg: {}, arg: {} };
    const step = emitRespond(rod, ctx);
    expect(step.statement).toContain("status: 201");
  });

  it("emits status 204 for delete operation", async () => {
    const ctx = { panel: makePanelWithOp("delete"), previousSteps: [], inputVar: "result", inputType: "unknown" };
    const rod: Rod = { kind: "Rod", name: "resp", rodType: "respond", cfg: {}, arg: {} };
    const step = emitRespond(rod, ctx);
    expect(step.statement).toContain("status: 204");
  });

  it("defaults to status 200 for unknown operation", async () => {
    const ctx = { panel: makePanelWithOp("audit"), previousSteps: [], inputVar: "result", inputType: "unknown" };
    const rod: Rod = { kind: "Rod", name: "resp", rodType: "respond", cfg: {}, arg: {} };
    const step = emitRespond(rod, ctx);
    expect(step.statement).toContain("status: 200");
  });
});
