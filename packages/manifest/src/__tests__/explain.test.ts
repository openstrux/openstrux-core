/**
 * Unit tests for explain() output generation.
 *
 * Covers:
 *   - Task 4.4: P0 domain model explain output matches expected snapshot
 *   - Task 4.5: --explain text and manifest.audit are generated from same data
 */

import { describe, expect, it } from "vitest";
import type { SourceFile } from "@openstrux/ast";
import { generateManifest } from "../pipeline.js";
import { explain, formatExplain } from "../explain.js";

// ---------------------------------------------------------------------------
// P0 domain model mock (intake-proposals panel with 3 rods)
// ---------------------------------------------------------------------------

const P0_SOURCE = `
@type Proposal { id: string, title: string, status: ReviewStatus }
@type ReviewStatus = enum { draft, submitted, approved, rejected }

@panel intake-proposals {
  @dp { controller: "NLnet Foundation", record: "GW-INTAKE-001" }
  @access { purpose: "grant_intake", operation: "write" }
  intake = receive {
    trigger: http { method: "POST", path: "/proposals" }
  }
  validate-schema = validate {
    schema: Proposal
  }
  store-proposal = write-data {
    target: db.sql.postgres { host: env("DB_HOST"), port: 5432, db_name: "grants", tls: true }
  }
}
`.trim();

const P0_SOURCE_FILE: SourceFile = {
  types: [
    {
      kind: "TypeRecord",
      name: "Proposal",
      fields: [
        { name: "id", type: { kind: "PrimitiveType", name: "string" } },
        { name: "title", type: { kind: "PrimitiveType", name: "string" } },
        { name: "status", type: { kind: "TypeRef", name: "ReviewStatus" } },
      ],
      loc: {
        start: { file: "p0-domain-model.strux", line: 7, col: 1 },
        end: { file: "p0-domain-model.strux", line: 14, col: 1 },
      },
    },
    {
      kind: "TypeEnum",
      name: "ReviewStatus",
      variants: ["draft", "submitted", "approved", "rejected"],
      loc: {
        start: { file: "p0-domain-model.strux", line: 16, col: 1 },
        end: { file: "p0-domain-model.strux", line: 16, col: 60 },
      },
    },
  ],
  panels: [
    {
      kind: "Panel",
      name: "intake-proposals",
      dp: { controller: "NLnet Foundation", record: "GW-INTAKE-001" },
      access: {
        kind: "AccessContext",
        intent: {
          purpose: "grant_intake",
          basis: "contract",
          operation: "write",
          urgency: "routine",
        },
      },
      rods: [
        {
          kind: "Rod",
          name: "intake",
          rodType: "receive",
          cfg: {},
          arg: {},
          loc: {
            start: { file: "p0-domain-model.strux", line: 38, col: 3 },
            end: { file: "p0-domain-model.strux", line: 40, col: 3 },
          },
        },
        {
          kind: "Rod",
          name: "validate-schema",
          rodType: "validate",
          cfg: {},
          arg: {},
          loc: {
            start: { file: "p0-domain-model.strux", line: 41, col: 3 },
            end: { file: "p0-domain-model.strux", line: 43, col: 3 },
          },
        },
        {
          kind: "Rod",
          name: "store-proposal",
          rodType: "write-data",
          cfg: {},
          arg: {},
          loc: {
            start: { file: "p0-domain-model.strux", line: 44, col: 3 },
            end: { file: "p0-domain-model.strux", line: 48, col: 3 },
          },
        },
      ],
      snaps: [],
      loc: {
        start: { file: "p0-domain-model.strux", line: 35, col: 1 },
        end: { file: "p0-domain-model.strux", line: 49, col: 1 },
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Task 4.4: explain output structure
// ---------------------------------------------------------------------------

describe("explain — P0 domain model", () => {
  it("contains 3 numbered steps with rod types and source locations (EX-002)", () => {
    const { manifest } = generateManifest({
      source: P0_SOURCE,
      sourceFile: P0_SOURCE_FILE,
      version: "0.0.0",
    });

    const text = explain(manifest, { panelName: "intake-proposals" });

    expect(text).toContain("Step 1");
    expect(text).toContain("Step 2");
    expect(text).toContain("Step 3");

    expect(text).toContain("[receive]");
    expect(text).toContain("[validate]");
    expect(text).toContain("[write-data]");

    expect(text).toContain("p0-domain-model.strux:38");
    expect(text).toContain("p0-domain-model.strux:41");
    expect(text).toContain("p0-domain-model.strux:44");
  });

  it("contains access context summary for grant_intake intent (EX-003)", () => {
    const { manifest } = generateManifest({
      source: P0_SOURCE,
      sourceFile: P0_SOURCE_FILE,
      version: "0.0.0",
    });
    const text = explain(manifest, { panelName: "intake-proposals" });
    expect(text).toContain("grant_intake");
  });

  it("contains pushdown count in summary (EX-004)", () => {
    const { manifest } = generateManifest({
      source: P0_SOURCE,
      sourceFile: P0_SOURCE_FILE,
      version: "0.0.0",
    });
    const text = explain(manifest, { panelName: "intake-proposals" });
    expect(text).toContain("Pushdown annotations:");
  });

  it("contains policy verification summary (EX-005)", () => {
    const { manifest } = generateManifest({
      source: P0_SOURCE,
      sourceFile: P0_SOURCE_FILE,
      version: "0.0.0",
    });
    const text = explain(manifest, { panelName: "intake-proposals" });
    expect(text).toContain("Policy verification:");
  });

  it("contains rod count in summary", () => {
    const { manifest } = generateManifest({
      source: P0_SOURCE,
      sourceFile: P0_SOURCE_FILE,
      version: "0.0.0",
    });
    const text = explain(manifest, { panelName: "intake-proposals" });
    expect(text).toContain("Rods: 3");
  });

  it("matches snapshot", () => {
    const { manifest } = generateManifest({
      source: P0_SOURCE,
      sourceFile: P0_SOURCE_FILE,
      version: "0.0.0",
    });
    const text = explain(manifest, { panelName: "intake-proposals" });
    expect(text).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// Task 4.5: explain text and manifest.audit use the same data (EX-006)
// ---------------------------------------------------------------------------

describe("explain — same data as manifest.audit (EX-006)", () => {
  it("formatExplain produces identical text when called with manifest.audit directly", () => {
    const { manifest } = generateManifest({
      source: P0_SOURCE,
      sourceFile: P0_SOURCE_FILE,
      version: "0.0.0",
    });

    // explain() is a thin wrapper over formatExplain(manifest.audit)
    const viaExplain = explain(manifest, { panelName: "intake-proposals" });
    const viaAudit = formatExplain(manifest.audit, { panelName: "intake-proposals" });

    expect(viaExplain).toBe(viaAudit);
  });

  it("audit.entries rod types match the steps in explain text", () => {
    const { manifest } = generateManifest({
      source: P0_SOURCE,
      sourceFile: P0_SOURCE_FILE,
      version: "0.0.0",
    });

    const text = explain(manifest, { panelName: "intake-proposals" });
    for (const entry of manifest.audit.entries) {
      expect(text).toContain(`[${entry.rod}]`);
    }
  });
});
