/**
 * snap.lock JSON serialisation and deserialisation.
 *
 * Deterministic serialisation: keys are sorted recursively and the
 * output uses 2-space indentation so diffs are human-readable and
 * byte-identical across platforms.
 */

import type { LockFile } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively sort object keys to produce deterministic JSON. */
function sortedReplacer(
  _key: string,
  value: unknown
): unknown {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function validateLockFile(parsed: unknown): LockFile {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("snap.lock: root must be a JSON object");
  }
  const obj = parsed as Record<string, unknown>;

  const requiredStrings = ["lockVersion", "specVersion", "generatedAt", "sourceHash"] as const;
  for (const field of requiredStrings) {
    if (!isString(obj[field])) {
      throw new Error(`snap.lock: "${field}" must be a string`);
    }
  }

  if (!Array.isArray(obj["entries"])) {
    throw new Error('snap.lock: "entries" must be an array');
  }

  const validKinds = new Set(["adapter", "config", "type", "hub-artifact"]);

  const entries = (obj["entries"] as unknown[]).map((entry, idx) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`snap.lock: entries[${idx}] must be an object`);
    }
    const e = entry as Record<string, unknown>;
    for (const field of ["key", "kind", "version", "hash"] as const) {
      if (!isString(e[field])) {
        throw new Error(`snap.lock: entries[${idx}].${field} must be a string`);
      }
    }
    if (!validKinds.has(e["kind"] as string)) {
      throw new Error(
        `snap.lock: entries[${idx}].kind must be one of adapter|config|type|hub-artifact`
      );
    }
    return {
      key: e["key"] as string,
      kind: e["kind"] as "adapter" | "config" | "type" | "hub-artifact",
      version: e["version"] as string,
      hash: e["hash"] as string,
    };
  });

  return {
    lockVersion: obj["lockVersion"] as string,
    specVersion: obj["specVersion"] as string,
    generatedAt: obj["generatedAt"] as string,
    sourceHash: obj["sourceHash"] as string,
    entries,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Serialise a LockFile to a deterministic JSON string.
 *
 * Keys within each object are sorted alphabetically. The output is
 * byte-identical across platforms for the same logical lock state.
 */
export function serialise(lock: LockFile): string {
  return JSON.stringify(lock, sortedReplacer, 2) + "\n";
}

/**
 * Deserialise and validate a snap.lock JSON string.
 *
 * Throws if the JSON is malformed or the schema is invalid.
 */
export function deserialise(json: string): LockFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error(`snap.lock: invalid JSON — ${String(err)}`);
  }
  return validateLockFile(parsed);
}
