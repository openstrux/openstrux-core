/**
 * package() tests (task 6.4).
 *
 * Verifies that NextJsAdapter.package() produces:
 * - barrel exports (index.ts, schemas/index.ts, handlers/index.ts)
 * - package.json with @openstrux/build name and correct exports map
 * - tsconfig.json with NodeNext module settings
 */

import { describe, it, expect } from "vitest";
import { build } from "../index.js";
import type { TopLevelNode } from "../types.js";
import type { Panel, Rod } from "@openstrux/ast";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMinimalAst(): TopLevelNode[] {
  const receiveRod: Rod = {
    kind: "Rod", name: "receive", rodType: "receive",
    cfg: {
      trigger: {
        kind: "ObjectValue",
        fields: { method: { kind: "LitString", value: "GET" } },
      } as unknown as Rod["cfg"][string],
    },
    arg: {},
  };
  const panel: Panel = {
    kind: "Panel", name: "health", dp: {},
    access: { kind: "AccessContext" },
    rods: [receiveRod], snaps: [],
  };
  return [panel];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NextJsAdapter.package(): output structure", () => {
  const ast = makeMinimalAst();
  const { pkg } = build(ast, {}, { framework: "next" });

  it("outputDir is .openstrux/build", () => {
    expect(pkg.outputDir).toBe(".openstrux/build");
  });

  it("metadata contains package.json and tsconfig.json", () => {
    const names = pkg.metadata.map(f => f.path);
    expect(names).toContain("package.json");
    expect(names).toContain("tsconfig.json");
  });

  it("entrypoints contains index.ts, schemas/index.ts, handlers/index.ts", () => {
    const names = pkg.entrypoints.map(f => f.path);
    expect(names).toContain("index.ts");
    expect(names).toContain("schemas/index.ts");
    expect(names).toContain("handlers/index.ts");
  });

  it("package.json has name @openstrux/build", () => {
    const pkgJson = pkg.metadata.find(f => f.path === "package.json");
    const parsed = JSON.parse(pkgJson?.content ?? "{}") as { name: string };
    expect(parsed.name).toBe("@openstrux/build");
  });

  it("package.json exports map includes '.', './schemas', './handlers'", () => {
    const pkgJson = pkg.metadata.find(f => f.path === "package.json");
    const parsed = JSON.parse(pkgJson?.content ?? "{}") as { exports: Record<string, unknown> };
    expect(parsed.exports["."]).toBeDefined();
    expect(parsed.exports["./schemas"]).toBeDefined();
    expect(parsed.exports["./handlers"]).toBeDefined();
  });

  it("tsconfig.json has NodeNext moduleResolution", () => {
    const tsconfig = pkg.metadata.find(f => f.path === "tsconfig.json");
    const parsed = JSON.parse(tsconfig?.content ?? "{}") as { compilerOptions: Record<string, unknown> };
    expect(parsed.compilerOptions["moduleResolution"]).toBe("NodeNext");
  });

  it("handlers/index.ts exports the health handler", () => {
    const handlersIdx = pkg.entrypoints.find(f => f.path === "handlers/index.ts");
    expect(handlersIdx?.content).toContain("health");
  });
});

describe("NextJsAdapter.package(): schema barrel exports", () => {
  it("schemas/index.ts exports schema and Input type when schemas present", () => {
    // Use the build result from generate to get schema files
    const receiveRod: Rod = {
      kind: "Rod", name: "receive", rodType: "receive",
      cfg: {
        trigger: {
          kind: "ObjectValue",
          fields: { method: { kind: "LitString", value: "POST" } },
        } as unknown as Rod["cfg"][string],
      },
      arg: {},
    };
    const validateRod: Rod = {
      kind: "Rod", name: "val", rodType: "validate",
      cfg: { schema: { kind: "TypeRef", name: "Proposal" } as unknown as Rod["cfg"][string] },
      arg: {},
    };
    const proposal = {
      kind: "TypeRecord" as const,
      name: "Proposal",
      fields: [{ name: "title", type: { kind: "LitString", value: "string" }, optional: false }],
    };
    const panel: Panel = {
      kind: "Panel", name: "intake", dp: {},
      access: { kind: "AccessContext" },
      rods: [receiveRod, validateRod], snaps: [],
    };
    const ast: TopLevelNode[] = [proposal as unknown as TopLevelNode, panel];
    const { pkg } = build(ast, {}, { framework: "next" });
    const schemasIdx = pkg.entrypoints.find(f => f.path === "schemas/index.ts");
    expect(schemasIdx?.content).toContain("ProposalSchema");
    expect(schemasIdx?.content).toContain("ProposalInput");
  });
});
