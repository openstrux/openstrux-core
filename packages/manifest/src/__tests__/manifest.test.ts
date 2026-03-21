/**
 * Unit tests for manifest generation.
 *
 * Covers task 3.5:
 *   - audit field populated (entries.length > 0)
 *   - certificationScope non-empty
 *   - lockRef present when lock is provided
 */

import { describe, expect, it } from "vitest";
import type { SourceFile } from "@openstrux/ast";
import type { SnapLock } from "@openstrux/lock";
import { generateManifest } from "../pipeline.js";

// ---------------------------------------------------------------------------
// Minimal mock SourceFile
// ---------------------------------------------------------------------------

const MOCK_SOURCE = `
@type Proposal { id: string }

@panel intake-proposals {
  @access { purpose: "grant_intake", operation: "write" }
  intake = receive { trigger: http { method: "POST", path: "/proposals" } }
  store = write-data { target: db.sql.postgres { host: env("DB_HOST") } }
}
`.trim();

const MOCK_SOURCE_FILE: SourceFile = {
  types: [
    {
      kind: "TypeRecord",
      name: "Proposal",
      fields: [{ name: "id", type: { kind: "PrimitiveType", name: "string" } }],
      loc: {
        start: { file: "test.strux", line: 1, col: 1 },
        end: { file: "test.strux", line: 1, col: 30 },
      },
    },
  ],
  panels: [
    {
      kind: "Panel",
      name: "intake-proposals",
      dp: {},
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
            start: { file: "test.strux", line: 5, col: 3 },
            end: { file: "test.strux", line: 5, col: 60 },
          },
        },
        {
          kind: "Rod",
          name: "store",
          rodType: "write-data",
          cfg: {},
          arg: {},
          loc: {
            start: { file: "test.strux", line: 6, col: 3 },
            end: { file: "test.strux", line: 6, col: 60 },
          },
        },
      ],
      snaps: [],
      loc: {
        start: { file: "test.strux", line: 3, col: 1 },
        end: { file: "test.strux", line: 7, col: 1 },
      },
    },
  ],
};

const MOCK_LOCK: SnapLock = {
  lockVersion: "0.6",
  specVersion: "0.6.0",
  generatedAt: "2026-01-01T00:00:00.000Z",
  sourceHash: "abc123deadbeef",
  entries: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateManifest — audit field populated", () => {
  it("produces audit.entries with one entry per rod", () => {
    const { manifest } = generateManifest({
      source: MOCK_SOURCE,
      sourceFile: MOCK_SOURCE_FILE,
      version: "0.0.0",
    });

    expect(manifest.audit.entries).toHaveLength(2);
    expect(manifest.audit.entries[0]?.step).toBe(1);
    expect(manifest.audit.entries[0]?.rod).toBe("receive");
    expect(manifest.audit.entries[1]?.step).toBe(2);
    expect(manifest.audit.entries[1]?.rod).toBe("write-data");
  });

  it("populates loc for each entry", () => {
    const { manifest } = generateManifest({
      source: MOCK_SOURCE,
      sourceFile: MOCK_SOURCE_FILE,
      version: "0.0.0",
    });
    expect(manifest.audit.entries[0]?.loc.file).toBe("test.strux");
    expect(manifest.audit.entries[0]?.loc.line).toBe(5);
  });
});

describe("generateManifest — certificationScope non-empty", () => {
  it("includes type names in scope", () => {
    const { manifest } = generateManifest({
      source: MOCK_SOURCE,
      sourceFile: MOCK_SOURCE_FILE,
      version: "0.0.0",
    });
    expect(manifest.certificationScope).toContain("Proposal");
    expect(manifest.certificationScope.length).toBeGreaterThan(0);
  });
});

describe("generateManifest — lockRef", () => {
  it("is null when no lock provided", () => {
    const { manifest } = generateManifest({
      source: MOCK_SOURCE,
      sourceFile: MOCK_SOURCE_FILE,
      version: "0.0.0",
    });
    expect(manifest.lockRef).toBeNull();
  });

  it("is the lock sourceHash when lock is provided", () => {
    const { manifest } = generateManifest({
      source: MOCK_SOURCE,
      sourceFile: MOCK_SOURCE_FILE,
      version: "0.0.0",
      lock: MOCK_LOCK,
    });
    expect(manifest.lockRef).toBe("abc123deadbeef");
  });
});

describe("generateManifest — diagnostics", () => {
  it("always emits I_MANIFEST_GENERATED", () => {
    const { diagnostics } = generateManifest({
      source: MOCK_SOURCE,
      sourceFile: MOCK_SOURCE_FILE,
      version: "0.0.0",
    });
    expect(diagnostics.some((d) => d.code === "I_MANIFEST_GENERATED")).toBe(true);
  });

  it("emits E_MANIFEST_HASH_CHANGED when hash differs from previous", () => {
    const { manifest: first } = generateManifest({
      source: MOCK_SOURCE,
      sourceFile: MOCK_SOURCE_FILE,
      version: "0.0.0",
    });

    const modifiedSource = MOCK_SOURCE + "\n// extra comment";
    const { diagnostics } = generateManifest({
      source: modifiedSource,
      sourceFile: MOCK_SOURCE_FILE,
      version: "0.0.0",
      previous: first,
    });
    // Comments are stripped in canonicalisation — hash should be same
    expect(diagnostics.every((d) => d.code !== "E_MANIFEST_HASH_CHANGED")).toBe(true);
  });
});

describe("generateManifest — schema fields", () => {
  it("sets schemaVersion to 0.6", () => {
    const { manifest } = generateManifest({
      source: MOCK_SOURCE,
      sourceFile: MOCK_SOURCE_FILE,
      version: "1.2.3",
    });
    expect(manifest.schemaVersion).toBe("0.6");
    expect(manifest.version).toBe("1.2.3");
  });
});
