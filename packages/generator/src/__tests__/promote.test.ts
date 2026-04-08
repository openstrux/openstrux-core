/**
 * Tests for the promote() step — StruxNode[] → TopLevelNode[].
 *
 * Covers:
 *   D1 — arg/cfg split per rod type (filter.where → arg, not cfg)
 *   Basic promotion of @type record, enum, union
 *   Access context promotion from @access block
 */

import { describe, it, expect } from "vitest";
import { parse } from "@openstrux/parser";
import { promote } from "../promote.js";
import type { Panel, Rod } from "@openstrux/ast";

// ---------------------------------------------------------------------------
// Basic @type promotion
// ---------------------------------------------------------------------------

describe("promote — @type record", () => {
  it("promotes a record to TypeRecord with correct fields", () => {
    const { ast } = parse(`@type Proposal { id: string  title: string }`);
    const nodes = promote(ast);
    const rec = nodes.find((n) => n.kind === "TypeRecord");
    expect(rec).toBeDefined();
    expect(rec?.kind).toBe("TypeRecord");
    if (rec?.kind === "TypeRecord") {
      expect(rec.name).toBe("Proposal");
      expect(rec.fields.map((f) => f.name)).toContain("id");
      expect(rec.fields.map((f) => f.name)).toContain("title");
    }
  });
});

describe("promote — @type enum", () => {
  it("promotes an enum to TypeEnum with variants", () => {
    const { ast } = parse(`@type Status = enum { draft, submitted }`);
    const nodes = promote(ast);
    const en = nodes.find((n) => n.kind === "TypeEnum");
    expect(en?.kind).toBe("TypeEnum");
    if (en?.kind === "TypeEnum") {
      expect(en.name).toBe("Status");
      expect(en.variants).toContain("draft");
      expect(en.variants).toContain("submitted");
    }
  });
});

// ---------------------------------------------------------------------------
// D1 — arg/cfg split
// ---------------------------------------------------------------------------

describe("D1 — arg/cfg split per rod type", () => {
  it("puts filter.predicate into arg, not cfg", () => {
    const { ast } = parse(`@panel p {
  @access { purpose: "test", operation: "read" }
  f = filter { predicate: status == "active" }
}`);
    const nodes = promote(ast);
    const panel = nodes.find((n): n is Panel => n.kind === "Panel");
    const rod = panel?.rods.find((r: Rod) => r.name === "f");
    expect(rod).toBeDefined();
    expect(rod?.arg["predicate"]).toBeDefined();
    expect(rod?.cfg["predicate"]).toBeUndefined();
  });

  it("puts transform.map into arg, not cfg", () => {
    const { ast } = parse(`@panel p {
  @access { purpose: "test", operation: "transform" }
  t = transform { map: x => x.name }
}`);
    const nodes = promote(ast);
    const panel = nodes.find((n): n is Panel => n.kind === "Panel");
    const rod = panel?.rods.find((r: Rod) => r.name === "t");
    expect(rod).toBeDefined();
    expect(rod?.arg["map"]).toBeDefined();
    expect(rod?.cfg["map"]).toBeUndefined();
  });

  it("keeps non-arg knots in cfg", () => {
    const { ast } = parse(`@panel p {
  @access { purpose: "test", operation: "write" }
  w = write-data { target: db.sql.postgres {} }
}`);
    const nodes = promote(ast);
    const panel = nodes.find((n): n is Panel => n.kind === "Panel");
    const rod = panel?.rods.find((r: Rod) => r.name === "w");
    expect(rod).toBeDefined();
    expect(rod?.cfg["target"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Access context promotion
// ---------------------------------------------------------------------------

describe("promote — access context", () => {
  it("promotes @access block to AccessContext with intent fields", () => {
    const { ast } = parse(`@panel p {
  @access { purpose: "grant_intake", operation: "write" }
  r = receive {}
}`);
    const nodes = promote(ast);
    const panel = nodes.find((n): n is Panel => n.kind === "Panel");
    expect(panel).toBeDefined();
    const intent = panel?.access?.intent;
    expect(intent?.purpose).toBe("grant_intake");
    expect(intent?.operation).toBe("write");
  });

  it("produces AccessContext with undefined intent when no @access block", () => {
    const { ast } = parse(`@panel p { r = receive {} }`);
    const nodes = promote(ast);
    const panel = nodes.find((n): n is Panel => n.kind === "Panel");
    expect(panel).toBeDefined();
    expect(panel?.access?.intent).toBeUndefined();
  });
});
