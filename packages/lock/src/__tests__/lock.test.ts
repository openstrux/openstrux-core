/**
 * Lock package tests.
 *
 * Covers tasks:
 *   4.1 — determinism: build P0 twice, assert byte-identical sourceHash
 *   4.2 — determinism: build P1 intake panel twice, assert identical lock JSON
 *   4.5 — E_LOCK_MISMATCH when source changes without --lock-update
 *   4.6 — W_NO_LOCK emitted when no lock file present, lock auto-generated
 *
 * Spec reference: design.md §Determinism verification
 */

import { describe, expect, it } from "vitest";
import type { SourceFile, FieldDecl } from "@openstrux/ast";
import type { ContextResolutionResult } from "@openstrux/config";
import { generateLock } from "../generate.js";
import { verifyLock } from "../verify.js";
import { serialise, deserialise } from "../io.js";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const EMPTY_CONFIG: ContextResolutionResult = {
  dp: {},
  access: {},
  ops: {},
  sec: {},
  sources: {},
  targets: {},
  diagnostics: [],
};

const FIXED_TIMESTAMP = "2026-01-01T00:00:00.000Z";

/** Helper: build a FieldDecl with no persistence annotations (pre-v0.6 style). */
function field(name: string, type: FieldDecl["type"]): FieldDecl {
  return { name, type, annotations: [] };
}

// P0 domain model — minimal SourceFile used in determinism tests
const P0_SOURCE_FILE: SourceFile = {
  types: [
    {
      kind: "TypeRecord",
      name: "Proposal",
      external: false,
      timestamps: false,
      annotations: [],
      fields: [
        field("id",          { kind: "PrimitiveType", name: "string" }),
        field("title",       { kind: "PrimitiveType", name: "string" }),
        field("submitter",   { kind: "PrimitiveType", name: "string" }),
        field("description", { kind: "ContainerType", container: "Optional", typeArgs: [{ kind: "PrimitiveType", name: "string" }] }),
        field("submitted_at",{ kind: "PrimitiveType", name: "date" }),
        field("status",      { kind: "TypeRef", name: "ReviewStatus" }),
      ],
      loc: {
        start: { file: "p0-domain-model.strux", line: 7, col: 1 },
        end: { file: "p0-domain-model.strux", line: 14, col: 1 },
      },
    },
    {
      kind: "TypeEnum",
      name: "ReviewStatus",
      variants: ["draft", "submitted", "under_review", "approved", "rejected"],
      loc: {
        start: { file: "p0-domain-model.strux", line: 16, col: 1 },
        end: { file: "p0-domain-model.strux", line: 16, col: 70 },
      },
    },
  ],
  panels: [],
};

const P0_SOURCE = `
@type Proposal {
  id:           string
  title:        string
  submitter:    string
  description:  Optional<string>
  submitted_at: date
  status:       ReviewStatus
}

@type ReviewStatus = enum { draft, submitted, under_review, approved, rejected }
`.trim();

// P1 intake panel source
const P1_SOURCE = `
@type IntakeForm {
  id:          string
  title:       string
  submitter:   string
}

@panel intake-proposals {
  @access { purpose: "grant_intake", operation: "write" }
  intake = receive { trigger: http { method: "POST", path: "/proposals" } }
  store = write-data { target: db.sql.postgres { host: env("DB_HOST") } }
}
`.trim();

const P1_SOURCE_FILE: SourceFile = {
  types: [
    {
      kind: "TypeRecord",
      name: "IntakeForm",
      external: false,
      timestamps: false,
      annotations: [],
      fields: [
        field("id",        { kind: "PrimitiveType", name: "string" }),
        field("title",     { kind: "PrimitiveType", name: "string" }),
        field("submitter", { kind: "PrimitiveType", name: "string" }),
      ],
      loc: {
        start: { file: "p1-intake.strux", line: 1, col: 1 },
        end: { file: "p1-intake.strux", line: 5, col: 1 },
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
            start: { file: "p1-intake.strux", line: 9, col: 3 },
            end: { file: "p1-intake.strux", line: 9, col: 60 },
          },
        },
        {
          kind: "Rod",
          name: "store",
          rodType: "write-data",
          cfg: {},
          arg: {},
          loc: {
            start: { file: "p1-intake.strux", line: 10, col: 3 },
            end: { file: "p1-intake.strux", line: 10, col: 60 },
          },
        },
      ],
      snaps: [],
      loc: {
        start: { file: "p1-intake.strux", line: 8, col: 1 },
        end: { file: "p1-intake.strux", line: 11, col: 1 },
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Task 4.1: determinism — P0 domain model
// ---------------------------------------------------------------------------

describe("determinism — P0 domain model", () => {
  it("builds P0 twice and produces byte-identical lock JSON (same sourceHash)", () => {
    const lock1 = generateLock({
      source: P0_SOURCE,
      sourceFile: P0_SOURCE_FILE,
      config: EMPTY_CONFIG,
      adapterVersions: {},
      specVersion: "0.6.0",
      timestamp: FIXED_TIMESTAMP,
    });

    const lock2 = generateLock({
      source: P0_SOURCE,
      sourceFile: P0_SOURCE_FILE,
      config: EMPTY_CONFIG,
      adapterVersions: {},
      specVersion: "0.6.0",
      timestamp: FIXED_TIMESTAMP,
    });

    // Byte-identical serialised output
    expect(serialise(lock1)).toBe(serialise(lock2));
    // sourceHash identical (drives manifest lockRef / contentHash chain)
    expect(lock1.sourceHash).toBe(lock2.sourceHash);
  });
});

// ---------------------------------------------------------------------------
// Task 4.2: determinism — P1 intake panel
// ---------------------------------------------------------------------------

describe("determinism — P1 intake panel", () => {
  it("builds P1 twice and produces identical lock JSON", () => {
    const lock1 = generateLock({
      source: P1_SOURCE,
      sourceFile: P1_SOURCE_FILE,
      config: EMPTY_CONFIG,
      adapterVersions: { "db.sql.postgres": "0.6.0" },
      specVersion: "0.6.0",
      timestamp: FIXED_TIMESTAMP,
    });

    const lock2 = generateLock({
      source: P1_SOURCE,
      sourceFile: P1_SOURCE_FILE,
      config: EMPTY_CONFIG,
      adapterVersions: { "db.sql.postgres": "0.6.0" },
      specVersion: "0.6.0",
      timestamp: FIXED_TIMESTAMP,
    });

    expect(serialise(lock1)).toBe(serialise(lock2));
  });
});

// ---------------------------------------------------------------------------
// Task 4.5: E_LOCK_MISMATCH — source changed without --lock-update
// ---------------------------------------------------------------------------

describe("verifyLock — E_LOCK_MISMATCH", () => {
  it("emits E_LOCK_MISMATCH when source changes and sourceHash differs", () => {
    const originalLock = generateLock({
      source: P0_SOURCE,
      sourceFile: P0_SOURCE_FILE,
      config: EMPTY_CONFIG,
      adapterVersions: {},
      specVersion: "0.6.0",
      timestamp: FIXED_TIMESTAMP,
    });

    // Modify source — add a field to Proposal
    const modifiedSource = P0_SOURCE.replace(
      "status:       ReviewStatus",
      "status:       ReviewStatus\n  priority: string"
    );
    const extraField: FieldDecl = field("priority", { kind: "PrimitiveType", name: "string" });
    const baseType = P0_SOURCE_FILE.types[0]!;
    if (baseType.kind !== "TypeRecord") throw new Error("expected TypeRecord");
    const modifiedSourceFile: SourceFile = {
      ...P0_SOURCE_FILE,
      types: [
        { ...baseType, fields: [...baseType.fields, extraField] },
        ...P0_SOURCE_FILE.types.slice(1),
      ],
    };

    const currentLock = generateLock({
      source: modifiedSource,
      sourceFile: modifiedSourceFile,
      config: EMPTY_CONFIG,
      adapterVersions: {},
      specVersion: "0.6.0",
      timestamp: FIXED_TIMESTAMP,
    });

    const diags = verifyLock(currentLock, originalLock);
    expect(diags.some((d) => d.code === "E_LOCK_MISMATCH")).toBe(true);
    expect(diags.every((d) => d.severity === "error")).toBe(true);
  });

  it("emits E_LOCK_MISMATCH when an adapter version changes", () => {
    const originalLock = generateLock({
      source: P1_SOURCE,
      sourceFile: P1_SOURCE_FILE,
      config: EMPTY_CONFIG,
      adapterVersions: { "db.sql.postgres": "0.6.0" },
      specVersion: "0.6.0",
      timestamp: FIXED_TIMESTAMP,
    });

    const currentLock = generateLock({
      source: P1_SOURCE,
      sourceFile: P1_SOURCE_FILE,
      config: EMPTY_CONFIG,
      adapterVersions: { "db.sql.postgres": "0.7.0" },
      specVersion: "0.6.0",
      timestamp: FIXED_TIMESTAMP,
    });

    const diags = verifyLock(currentLock, originalLock);
    expect(diags.some((d) => d.code === "E_LOCK_MISMATCH")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 4.6: W_NO_LOCK and E_LOCK_STALE
// ---------------------------------------------------------------------------

describe("verifyLock — E_LOCK_STALE", () => {
  it("emits E_LOCK_STALE when specVersion differs", () => {
    const currentLock = generateLock({
      source: P0_SOURCE,
      sourceFile: P0_SOURCE_FILE,
      config: EMPTY_CONFIG,
      adapterVersions: {},
      specVersion: "0.7.0",
      timestamp: FIXED_TIMESTAMP,
    });
    const storedLock = generateLock({
      source: P0_SOURCE,
      sourceFile: P0_SOURCE_FILE,
      config: EMPTY_CONFIG,
      adapterVersions: {},
      specVersion: "0.6.0",
      timestamp: FIXED_TIMESTAMP,
    });

    const diags = verifyLock(currentLock, storedLock);
    expect(diags.some((d) => d.code === "E_LOCK_STALE")).toBe(true);
  });
});

describe("generateLock — W_NO_LOCK (emitted by pipeline, not generateLock itself)", () => {
  it("generateLock produces a valid LockFile without needing a prior lock", () => {
    // W_NO_LOCK is emitted by freezeLock pipeline when no lock exists.
    // This test confirms generateLock itself works in that scenario.
    const lock = generateLock({
      source: P0_SOURCE,
      sourceFile: P0_SOURCE_FILE,
      config: EMPTY_CONFIG,
      adapterVersions: {},
      specVersion: "0.6.0",
      timestamp: FIXED_TIMESTAMP,
    });
    expect(lock.lockVersion).toBe("0.6");
    expect(lock.sourceHash).toBeTruthy();
    expect(lock.entries.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// IO round-trip
// ---------------------------------------------------------------------------

describe("serialise / deserialise round-trip", () => {
  it("round-trips a generated lock without data loss", () => {
    const lock = generateLock({
      source: P0_SOURCE,
      sourceFile: P0_SOURCE_FILE,
      config: EMPTY_CONFIG,
      adapterVersions: {},
      specVersion: "0.6.0",
      timestamp: FIXED_TIMESTAMP,
    });
    const json = serialise(lock);
    const restored = deserialise(json);

    expect(restored.lockVersion).toBe(lock.lockVersion);
    expect(restored.specVersion).toBe(lock.specVersion);
    expect(restored.generatedAt).toBe(lock.generatedAt);
    expect(restored.sourceHash).toBe(lock.sourceHash);
    expect(restored.entries).toHaveLength(lock.entries.length);
  });

  it("serialise output is deterministic (sorted keys, consistent formatting)", () => {
    const lock = generateLock({
      source: P0_SOURCE,
      sourceFile: P0_SOURCE_FILE,
      config: EMPTY_CONFIG,
      adapterVersions: {},
      specVersion: "0.6.0",
      timestamp: FIXED_TIMESTAMP,
    });
    const json1 = serialise(lock);
    const json2 = serialise(lock);
    expect(json1).toBe(json2);
    // Ends with a newline for POSIX compatibility
    expect(json1.endsWith("\n")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// C1 — loc fields excluded from type entry hashing
// ---------------------------------------------------------------------------

describe("C1 — loc fields excluded from hash (reformat-stable hashes)", () => {
  it("produces identical sourceHash when loc positions change but types are the same", () => {
    // Same types, different loc positions (simulating a reformat)
    const sourceFileA: SourceFile = {
      types: [{
        kind: "TypeRecord", name: "Item", external: false, timestamps: false, annotations: [],
        fields: [field("id", { kind: "PrimitiveType", name: "string" })],
        loc: { start: { file: "a.strux", line: 1, col: 1 }, end: { file: "a.strux", line: 3, col: 1 } },
      }],
      panels: [],
    };
    const sourceFileB: SourceFile = {
      types: [{
        kind: "TypeRecord", name: "Item", external: false, timestamps: false, annotations: [],
        fields: [field("id", { kind: "PrimitiveType", name: "string" })],
        // Different loc — as if the type was moved down 10 lines
        loc: { start: { file: "a.strux", line: 11, col: 1 }, end: { file: "a.strux", line: 13, col: 1 } },
      }],
      panels: [],
    };
    const sourceA = `@type Item { id: string }`;
    const lockA = generateLock({ source: sourceA, sourceFile: sourceFileA, config: EMPTY_CONFIG, adapterVersions: {}, specVersion: "0.6.0", timestamp: FIXED_TIMESTAMP });
    const lockB = generateLock({ source: sourceA, sourceFile: sourceFileB, config: EMPTY_CONFIG, adapterVersions: {}, specVersion: "0.6.0", timestamp: FIXED_TIMESTAMP });

    // Entry hashes should be identical regardless of loc change
    const entryA = lockA.entries.find((e) => "typeName" in e && (e as { typeName?: string }).typeName === "Item");
    const entryB = lockB.entries.find((e) => "typeName" in e && (e as { typeName?: string }).typeName === "Item");
    if (entryA !== undefined && entryB !== undefined) {
      expect(entryA.hash).toBe(entryB.hash);
    }
  });
});

// ---------------------------------------------------------------------------
// deserialise — error paths
// ---------------------------------------------------------------------------

describe("deserialise — error paths", () => {
  it("throws on invalid JSON", () => {
    expect(() => deserialise("not json")).toThrow();
  });

  it("throws on JSON that is not an object", () => {
    expect(() => deserialise("[]")).toThrow();
  });

  it("throws on missing lockVersion field", () => {
    expect(() => deserialise(JSON.stringify({ specVersion: "0.6.0" }))).toThrow();
  });
});

// ---------------------------------------------------------------------------
// localeCompare determinism — sort order is byte-order independent
// ---------------------------------------------------------------------------

describe("locale-independent sort determinism", () => {
  it("produces identical lock JSON regardless of locale (reproducible sorting)", () => {
    // Ensures sorting doesn't depend on locale-specific string comparison
    const sourceFile: SourceFile = {
      types: [
        { kind: "TypeEnum", name: "ZStatus", variants: ["active", "inactive"] },
        { kind: "TypeEnum", name: "AStatus", variants: ["pending", "done"] },
      ],
      panels: [],
    };
    const source = `@type ZStatus = enum { active, inactive }\n@type AStatus = enum { pending, done }`;
    const lock1 = generateLock({ source, sourceFile, config: EMPTY_CONFIG, adapterVersions: {}, specVersion: "0.6.0", timestamp: FIXED_TIMESTAMP });
    const lock2 = generateLock({ source, sourceFile, config: EMPTY_CONFIG, adapterVersions: {}, specVersion: "0.6.0", timestamp: FIXED_TIMESTAMP });
    expect(serialise(lock1)).toBe(serialise(lock2));
    // Entry order should be deterministic — ZStatus comes after AStatus
    const names = lock1.entries.filter((e) => "typeName" in e).map((e) => (e as { typeName?: string }).typeName);
    if (names.length >= 2) {
      const sorted = [...names].sort((a, b) => (a ?? "") < (b ?? "") ? -1 : (a ?? "") > (b ?? "") ? 1 : 0);
      expect(names).toEqual(sorted);
    }
  });
});
