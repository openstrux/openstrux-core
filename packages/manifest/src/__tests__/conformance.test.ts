/**
 * Conformance test — manifest golden fixture.
 *
 * Generates manifest from the p0-domain-model IR and diffs against the
 * golden fixture at tests/fixtures/golden/p0-domain-model.mf.strux.json.
 *
 * Masked fields: `timestamp` (non-deterministic) and `lockRef` (no lock in test).
 * Both are replaced with their placeholder values before comparison.
 *
 * Task 5.4 — spec reference: specs/manifest/spec.md §MF-007
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SourceFile } from "@openstrux/ast";
import type { Manifest } from "../types.js";
import { generateManifest } from "../pipeline.js";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirnameLocal = dirname(__filename);
const coreRoot = resolve(__dirnameLocal, "../../../../");

const fixtureSourcePath = join(coreRoot, "tests/fixtures/valid/p0-domain-model.strux");
const goldenPath = join(coreRoot, "tests/fixtures/golden/p0-domain-model.mf.strux.json");

// ---------------------------------------------------------------------------
// P0 domain model IR
// ---------------------------------------------------------------------------

const P0_SOURCE_FILE: SourceFile = {
  types: [
    {
      kind: "TypeRecord",
      name: "Proposal",
      fields: [
        { name: "id", type: { kind: "PrimitiveType", name: "string" } },
        { name: "title", type: { kind: "PrimitiveType", name: "string" } },
        { name: "submitter", type: { kind: "PrimitiveType", name: "string" } },
        {
          name: "description",
          type: {
            kind: "ContainerType",
            container: "Optional",
            typeArgs: [{ kind: "PrimitiveType", name: "string" }],
          },
        },
        { name: "submitted_at", type: { kind: "PrimitiveType", name: "date" } },
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
      variants: ["draft", "submitted", "under_review", "approved", "rejected"],
      loc: {
        start: { file: "p0-domain-model.strux", line: 16, col: 1 },
        end: { file: "p0-domain-model.strux", line: 16, col: 70 },
      },
    },
    {
      kind: "TypeRecord",
      name: "PostgresConfig",
      fields: [
        { name: "host", type: { kind: "PrimitiveType", name: "string" } },
        { name: "port", type: { kind: "PrimitiveType", name: "number" } },
        { name: "db_name", type: { kind: "PrimitiveType", name: "string" } },
        { name: "tls", type: { kind: "PrimitiveType", name: "bool" } },
      ],
      loc: {
        start: { file: "p0-domain-model.strux", line: 18, col: 1 },
        end: { file: "p0-domain-model.strux", line: 23, col: 1 },
      },
    },
    {
      kind: "TypeUnion",
      name: "SqlSource",
      variants: [{ tag: "postgres", type: { kind: "TypeRef", name: "PostgresConfig" } }],
      loc: {
        start: { file: "p0-domain-model.strux", line: 25, col: 1 },
        end: { file: "p0-domain-model.strux", line: 27, col: 1 },
      },
    },
    {
      kind: "TypeUnion",
      name: "DataSource",
      variants: [{ tag: "db", type: { kind: "TypeRef", name: "SqlSource" } }],
      loc: {
        start: { file: "p0-domain-model.strux", line: 29, col: 1 },
        end: { file: "p0-domain-model.strux", line: 31, col: 1 },
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
          cfg: {
            trigger: {
              rootType: "TriggerConfig",
              path: { segments: ["http"] },
              resolvedType: "HttpTrigger",
              value: {
                method: { kind: "LitString", value: "POST" },
                path: { kind: "LitString", value: "/proposals" },
              },
            },
          },
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
          cfg: {
            target: {
              rootType: "DataSource",
              path: { segments: ["db", "sql", "postgres"] },
              resolvedType: "PostgresConfig",
              value: {
                host: { kind: "EnvRef", varName: "DB_HOST" },
                port: { kind: "LitNumber", value: 5432 },
                db_name: { kind: "LitString", value: "grants" },
                tls: { kind: "LitBool", value: true },
              },
            },
          },
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
// Masking helpers
// ---------------------------------------------------------------------------

/** Replace non-deterministic fields with their placeholder values. */
function maskManifest(manifest: Manifest): object {
  return {
    ...manifest,
    timestamp: "__TIMESTAMP__",
    lockRef: "__LOCK_REF__",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("conformance — p0-domain-model.mf.strux.json", () => {
  it("matches the golden fixture", () => {
    const source = readFileSync(fixtureSourcePath, "utf8");
    const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as object;

    const { manifest } = generateManifest({
      source,
      sourceFile: P0_SOURCE_FILE,
      version: "0.6.0",
    });

    const masked = maskManifest(manifest);
    expect(masked).toEqual(golden);
  });

  it("golden fixture has audit field", () => {
    const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as { audit?: unknown };
    expect(golden.audit).toBeDefined();
  });

  it("contentHash is stable (deterministic)", () => {
    const source = readFileSync(fixtureSourcePath, "utf8");

    const { manifest: first } = generateManifest({
      source,
      sourceFile: P0_SOURCE_FILE,
      version: "0.6.0",
    });
    const { manifest: second } = generateManifest({
      source,
      sourceFile: P0_SOURCE_FILE,
      version: "0.6.0",
    });

    expect(first.contentHash).toBe(second.contentHash);
  });
});
