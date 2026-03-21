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

const __filename = fileURLToPath(import.meta.url);
const __dirnameLocal = dirname(__filename);
const coreRoot = resolve(__dirnameLocal, "../../../../");
const goldenRodsDir = join(coreRoot, "tests/fixtures/golden/target-ts/rods");

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
  const files = generate(ast, {}, { target: "typescript" });
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
// Task 6.3 — all 18 rod types: no crash, valid output
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

  it("produces a route.ts file", () => {
    files = runGenerate(panel);
    expect(files.has("app/api/all-rods/route.ts")).toBe(true);
  });

  it("route.ts is a non-empty string", () => {
    files = runGenerate(panel);
    const content = files.get("app/api/all-rods/route.ts") ?? "";
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
// Tier 2 stubs — STRUX-STUB present in output
// ---------------------------------------------------------------------------

describe("Tier 2 stubs: STRUX-STUB in output", () => {
  const tier2Types = ["group", "aggregate", "merge", "join", "window"] as const;

  for (const rodType of tier2Types) {
    it(`${rodType} rod emits STRUX-STUB`, () => {
      const rod: Rod = { kind: "Rod", name: `${rodType}-op`, rodType, cfg: {}, arg: {} };
      const panel = makePanel(`stub-${rodType}`, [makeReceiveRod(), rod]);
      const files = runGenerate(panel);
      const route = files.get(`app/api/stub-${rodType}/route.ts`) ?? "";
      expect(route).toContain("STRUX-STUB");
    });
  }
});

// ---------------------------------------------------------------------------
// Task 6.4 — generator summary flags panels with Tier 2 stubs
// ---------------------------------------------------------------------------

describe("generator summary: Tier 2 stub panels flagged", () => {
  it("console.log called with stub panel name when Tier 2 rod present", () => {
    const logSpy = vi.spyOn(console, "log");
    const rod: Rod = { kind: "Rod", name: "group-op", rodType: "group", cfg: {}, arg: {} };
    const panel = makePanel("stub-panel", [makeReceiveRod(), rod]);
    runGenerate(panel);
    const calls = logSpy.mock.calls.map(c => c.join(" "));
    expect(calls.some(c => c.includes("stub-panel") && c.toLowerCase().includes("non-demo-capable"))).toBe(true);
    logSpy.mockRestore();
  });

  it("console.log NOT called with non-demo-capable when no Tier 2 rod present", () => {
    const logSpy = vi.spyOn(console, "log");
    const panel = makePanel("clean-panel", [makeReceiveRod()]);
    runGenerate(panel);
    const calls = logSpy.mock.calls.map(c => c.join(" "));
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
    const route = files.get("app/api/test-transform/route.ts") ?? "";
    expect(route).toContain("function transform(input: Proposal): EligibilityRecord {");
  });

  it("transform: falls back to unknown for unresolved types", () => {
    const rod: Rod = { kind: "Rod", name: "eval", rodType: "transform", cfg: {}, arg: {} };
    const panel = makePanel("test-transform-unk", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const route = files.get("app/api/test-transform-unk/route.ts") ?? "";
    expect(route).toContain("function transform(input: unknown): unknown {");
  });

  it("filter: output contains input.filter inline expression", () => {
    const rod: Rod = { kind: "Rod", name: "my-filter", rodType: "filter", cfg: {}, arg: {} };
    const panel = makePanel("test-filter", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const route = files.get("app/api/test-filter/route.ts") ?? "";
    expect(route).toContain("input.filter((item) =>");
  });

  it("write-data: output contains prisma create stub", () => {
    const rod: Rod = { kind: "Rod", name: "store-op", rodType: "write-data", cfg: {}, arg: {} };
    const panel = makePanel("test-write", [makeReceiveRod("POST"), rod]);
    const files = runGenerate(panel);
    const route = files.get("app/api/test-write/route.ts") ?? "";
    expect(route).toContain("prisma.<model>.create({ data: input })");
  });

  it("call: output contains fetch() stub with endpoint and method", () => {
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
    const route = files.get("app/api/test-call/route.ts") ?? "";
    expect(route).toContain('fetch("https://api.example.com/data", { method: "POST" })');
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
    const route = files.get("app/api/test-split/route.ts") ?? "";
    expect(route).toContain('case "eligible":');
    expect(route).toContain('case "ineligible":');
  });

  it("pseudonymize: JSDoc cites scope fieldMask fields", () => {
    const rod: Rod = { kind: "Rod", name: "anon-op", rodType: "pseudonymize", cfg: {}, arg: {} };
    const panel = makePanel("test-pseudo", [makeReceiveRod(), rod], ["email", "name"]);
    const files = runGenerate(panel);
    const route = files.get("app/api/test-pseudo/route.ts") ?? "";
    expect(route).toContain("@access scope.fieldMask: email, name");
  });

  it("encrypt: JSDoc cites scope fieldMask fields", () => {
    const rod: Rod = { kind: "Rod", name: "enc-op", rodType: "encrypt", cfg: {}, arg: {} };
    const panel = makePanel("test-encrypt", [makeReceiveRod(), rod], ["ssn", "dob"]);
    const files = runGenerate(panel);
    const route = files.get("app/api/test-encrypt/route.ts") ?? "";
    expect(route).toContain("@access scope.fieldMask: ssn, dob");
  });
});

// ---------------------------------------------------------------------------
// Golden fixture conformance — Tier 1 emitters
// ---------------------------------------------------------------------------

describe("rod golden fixtures", () => {
  if (!existsSync(goldenRodsDir)) return;
  const goldenFiles = readdirSync(goldenRodsDir)
    .filter(f => f.endsWith(".ts"))
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
    const actual = files.get("app/api/test-transform/route.ts") ?? "";
    expect(normalise(actual)).toEqual(normalise(goldenContent));
  });

  it("filter golden: matches expected output", () => {
    const goldenFile = goldenFiles.find(f => f.startsWith("rod-filter--"));
    if (goldenFile === undefined) return;
    const goldenContent = readFileSync(join(goldenRodsDir, goldenFile), "utf-8");
    const rod: Rod = { kind: "Rod", name: "my-filter", rodType: "filter", cfg: {}, arg: {} };
    const panel = makePanel("test-filter", [makeReceiveRod(), rod]);
    const files = runGenerate(panel);
    const actual = files.get("app/api/test-filter/route.ts") ?? "";
    expect(normalise(actual)).toEqual(normalise(goldenContent));
  });

  it("write-data golden: matches expected output", () => {
    const goldenFile = goldenFiles.find(f => f.startsWith("rod-write-data--"));
    if (goldenFile === undefined) return;
    const goldenContent = readFileSync(join(goldenRodsDir, goldenFile), "utf-8");
    const rod: Rod = { kind: "Rod", name: "store-op", rodType: "write-data", cfg: {}, arg: {} };
    const panel = makePanel("test-write-data", [makeReceiveRod("POST"), rod]);
    const files = runGenerate(panel);
    const actual = files.get("app/api/test-write-data/route.ts") ?? "";
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
    const actual = files.get("app/api/test-call/route.ts") ?? "";
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
    const actual = files.get("app/api/test-split/route.ts") ?? "";
    expect(normalise(actual)).toEqual(normalise(goldenContent));
  });

  it("pseudonymize golden: matches expected output", () => {
    const goldenFile = goldenFiles.find(f => f.startsWith("rod-pseudonymize--"));
    if (goldenFile === undefined) return;
    const goldenContent = readFileSync(join(goldenRodsDir, goldenFile), "utf-8");
    const rod: Rod = { kind: "Rod", name: "anon-op", rodType: "pseudonymize", cfg: {}, arg: {} };
    const panel = makePanel("test-pseudo", [makeReceiveRod(), rod], ["email", "name"]);
    const files = runGenerate(panel);
    const actual = files.get("app/api/test-pseudo/route.ts") ?? "";
    expect(normalise(actual)).toEqual(normalise(goldenContent));
  });

  it("encrypt golden: matches expected output", () => {
    const goldenFile = goldenFiles.find(f => f.startsWith("rod-encrypt--"));
    if (goldenFile === undefined) return;
    const goldenContent = readFileSync(join(goldenRodsDir, goldenFile), "utf-8");
    const rod: Rod = { kind: "Rod", name: "enc-op", rodType: "encrypt", cfg: {}, arg: {} };
    const panel = makePanel("test-encrypt", [makeReceiveRod(), rod], ["ssn", "dob"]);
    const files = runGenerate(panel);
    const actual = files.get("app/api/test-encrypt/route.ts") ?? "";
    expect(normalise(actual)).toEqual(normalise(goldenContent));
  });
});
