/**
 * Lock generation — produces a LockFile from a validated, config-resolved build state.
 *
 * Pipeline position: after validation, before manifest generation.
 *
 * generateLock collects four kinds of entries:
 *   "adapter"      — one per target, pinned to adapterVersions[targetKey]
 *   "config"       — one per named source/target endpoint, fingerprint of its config
 *   "type"         — one per @type declaration, fingerprint of its IR
 *   "hub-artifact" — absent for v0.6.0 (no hub)
 *
 * Spec reference: design.md §Lock entries are keyed by type path + dependency kind
 */

import { createHash } from "node:crypto";
import type { SourceFile, TypeDef } from "@openstrux/ast";
import type { ContextResolutionResult, RawNamedEndpoint } from "@openstrux/config";
import type { LockEntry, LockFile } from "./types.js";

import { canonicalise } from "./canonicalise.js";

// ---------------------------------------------------------------------------
// Internal: hashing utilities
// ---------------------------------------------------------------------------

/** Keys excluded from hash inputs — loc (source location) is unstable across reformats. */
const HASH_SKIP_KEYS: ReadonlySet<string> = new Set(["loc"]);

function sha256(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

/** Deterministic byte-order comparison (locale-independent). */
function byteCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Produce a deterministic stable JSON string from any value.
 * Object keys are sorted recursively; keys in HASH_SKIP_KEYS are excluded.
 */
function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return JSON.stringify(value);
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort().filter((k) => !HASH_SKIP_KEYS.has(k));
  const parts = sortedKeys.map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`);
  return `{${parts.join(",")}}`;
}

// ---------------------------------------------------------------------------
// Entry builders (tasks 2.2 – 2.4)
// ---------------------------------------------------------------------------

/** Task 2.4: Hash each @type TypeDef — uses its stable IR representation. */
function buildTypeEntries(types: readonly TypeDef[]): LockEntry[] {
  return types.map((td) => ({
    key: td.name,
    kind: "type",
    version: "0.6",
    hash: sha256(stableJson(td)),
  }));
}

/** Task 2.2: Fingerprint each named source/target config endpoint. */
function buildConfigEntries(
  endpoints: Record<string, RawNamedEndpoint>,
  prefix: "source" | "target"
): LockEntry[] {
  return Object.entries(endpoints)
    .sort(([a], [b]) => byteCompare(a, b))
    .map(([name, endpoint]) => ({
      key: `${prefix}:${name}`,
      kind: "config" as const,
      version: "0.6",
      hash: sha256(stableJson(endpoint.config)),
    }));
}

/** Task 2.3: Record the adapter version for each target key. */
function buildAdapterEntries(adapterVersions: Record<string, string>): LockEntry[] {
  return Object.entries(adapterVersions)
    .sort(([a], [b]) => byteCompare(a, b))
    .map(([key, version]) => ({
      key,
      kind: "adapter" as const,
      version,
      hash: sha256(`${key}@${version}`),
    }));
}

// ---------------------------------------------------------------------------
// Public API (task 2.1)
// ---------------------------------------------------------------------------

export interface GenerateLockInput {
  /**
   * Raw source text of the .strux file.
   * Used to compute sourceHash via the source canonicaliser (RFC-0001 Annex A).
   */
  readonly source: string;

  /** Validated IR. */
  readonly sourceFile: SourceFile;

  /** Resolved context (named sources, targets, etc.). */
  readonly config: ContextResolutionResult;

  /**
   * Adapter version map: target type path → version string.
   * For v0.6.0, this is typically `{ "db.sql.postgres": "0.6.0" }`.
   * Pass `{}` when no target adapters are resolved.
   */
  readonly adapterVersions: Record<string, string>;

  /**
   * OpenStrux spec version in effect (e.g. "0.6.0").
   * Written as LockFile.specVersion.
   */
  readonly specVersion: string;

  /**
   * ISO 8601 UTC timestamp for generatedAt.
   * If omitted, defaults to new Date().toISOString().
   * Pass a fixed value in tests to get deterministic output.
   */
  readonly timestamp?: string | undefined;
}

/**
 * Generate a LockFile from the resolved build state.
 *
 * Entries are collected and sorted by key for deterministic output.
 * Calling generateLock twice with identical inputs produces an identical LockFile
 * (given the same timestamp).
 *
 * Task 2.1 — collect all resolved dependencies into lock entries.
 * Task 2.5 — entries are produced in a deterministic, sorted order.
 */
export function generateLock(input: GenerateLockInput): LockFile {
  const sourceHash = sha256(canonicalise(input.source));

  const typeEntries = buildTypeEntries(input.sourceFile.types);
  const sourceConfigEntries = buildConfigEntries(input.config.sources, "source");
  const targetConfigEntries = buildConfigEntries(input.config.targets, "target");
  const adapterEntries = buildAdapterEntries(input.adapterVersions);

  // Sort all entries by (kind, key) for deterministic ordering
  const allEntries: LockEntry[] = [
    ...adapterEntries,
    ...sourceConfigEntries,
    ...targetConfigEntries,
    ...typeEntries,
  ].sort((a, b) => {
    const kindCmp = byteCompare(a.kind, b.kind);
    return kindCmp !== 0 ? kindCmp : byteCompare(a.key, b.key);
  });

  return {
    lockVersion: "0.6",
    specVersion: input.specVersion,
    generatedAt: input.timestamp ?? new Date().toISOString(),
    sourceHash,
    entries: allEntries,
  };
}
