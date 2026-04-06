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

// ---------------------------------------------------------------------------
// Internal: source canonicalisation (RFC-0001 Annex A)
//
// Identical algorithm to @openstrux/manifest canonicalise.ts.
// Duplicated here to avoid a circular dependency (manifest imports lock).
// ---------------------------------------------------------------------------

function stripLineComments(source: string): string {
  return source
    .split("\n")
    .map((line) => {
      let inString = false;
      for (let i = 0; i < line.length - 1; i++) {
        const ch = line[i];
        if (ch === '"') inString = !inString;
        if (!inString && ch === "/" && line[i + 1] === "/") {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join("\n");
}

function stripCertBlocks(source: string): string {
  let result = "";
  let i = 0;
  while (i < source.length) {
    if (source[i] === "@" && source.slice(i, i + 5) === "@cert") {
      i += 5;
      while (i < source.length && source[i] !== "{") i++;
      if (i < source.length && source[i] === "{") {
        let depth = 0;
        while (i < source.length) {
          if (source[i] === "{") depth++;
          else if (source[i] === "}") {
            depth--;
            if (depth === 0) { i++; break; }
          }
          i++;
        }
      }
    } else {
      result += source[i];
      i++;
    }
  }
  return result;
}

function splitDeclarations(source: string): string[] {
  const lines = source.split("\n");
  const decls: string[] = [];
  let current: string[] = [];
  let depth = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (depth === 0 && (trimmed.startsWith("@type") || trimmed.startsWith("@panel"))) {
      if (current.length > 0) {
        const text = current.join("\n").trim();
        if (text.length > 0) decls.push(text);
      }
      current = [line];
    } else {
      current.push(line);
    }
    for (const ch of line) {
      if (ch === "{") depth++;
      else if (ch === "}") depth = Math.max(0, depth - 1);
    }
  }
  if (current.length > 0) {
    const text = current.join("\n").trim();
    if (text.length > 0) decls.push(text);
  }
  return decls;
}

function getDeclName(decl: string): string {
  const m = decl.match(/@(?:type|panel)\s+(\S+)/);
  return m?.[1] ?? decl;
}

function normaliseWhitespace(decl: string): string {
  return decl.replace(/\s+/g, " ").trim();
}

/** @internal Exported for sync-check testing against @openstrux/manifest. */
export function canonicalise(source: string): string {
  const noComments = stripLineComments(source);
  const noCert = stripCertBlocks(noComments);
  const decls = splitDeclarations(noCert);
  const normalised = decls.map(normaliseWhitespace);
  const sorted = [...normalised].sort((a, b) => getDeclName(a).localeCompare(getDeclName(b)));
  return sorted.join("\n");
}

// ---------------------------------------------------------------------------
// Internal: hashing utilities
// ---------------------------------------------------------------------------

function sha256(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

/**
 * Produce a deterministic stable JSON string from any value.
 * Object keys are sorted recursively.
 */
function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return JSON.stringify(value);
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
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
    .sort(([a], [b]) => a.localeCompare(b))
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
    .sort(([a], [b]) => a.localeCompare(b))
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
    const kindCmp = a.kind.localeCompare(b.kind);
    return kindCmp !== 0 ? kindCmp : a.key.localeCompare(b.key);
  });

  return {
    lockVersion: "0.6",
    specVersion: input.specVersion,
    generatedAt: input.timestamp ?? new Date().toISOString(),
    sourceHash,
    entries: allEntries,
  };
}
