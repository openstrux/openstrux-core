/**
 * Lock consumption — read and verify an existing snap.lock.
 *
 * Pipeline position: after lock generation (or read), before manifest generation.
 *
 * readLock:   parse and validate snap.lock from disk
 * verifyLock: compare a freshly-generated lock against the stored lock,
 *             emitting E_LOCK_MISMATCH or E_LOCK_STALE diagnostics on any difference
 *
 * Spec reference: design.md §Locked-build verification
 */

import { readFileSync } from "node:fs";
import { deserialise } from "./io.js";
import {
  type LockDiagnostic,
  type LockFile,
  LOCK_DIAGNOSTIC_MESSAGES,
} from "./types.js";

// ---------------------------------------------------------------------------
// Task 3.1: readLock
// ---------------------------------------------------------------------------

/**
 * Parse and validate an existing snap.lock file from disk.
 *
 * Throws if the file cannot be read or the schema is invalid.
 * Callers should catch and emit an appropriate diagnostic.
 */
export function readLock(lockPath: string): LockFile {
  const json = readFileSync(lockPath, "utf8");
  return deserialise(json);
}

// ---------------------------------------------------------------------------
// Task 3.2: verifyLock
// Task 3.3: E_LOCK_STALE
// ---------------------------------------------------------------------------

/**
 * Compare the freshly-resolved lock state against an existing stored lock.
 *
 * Returns an empty array when the two locks are equivalent.
 *
 * Emits:
 *   E_LOCK_STALE    — when stored lock's specVersion differs from current
 *   E_LOCK_MISMATCH — when any entry (key, kind, version, hash) differs,
 *                     or when the sourceHash differs
 */
export function verifyLock(
  current: LockFile,
  stored: LockFile
): LockDiagnostic[] {
  const diagnostics: LockDiagnostic[] = [];

  // Task 3.3: spec version mismatch → E_LOCK_STALE
  if (current.specVersion !== stored.specVersion) {
    diagnostics.push({
      code: "E_LOCK_STALE",
      message: `${LOCK_DIAGNOSTIC_MESSAGES.E_LOCK_STALE} (stored=${stored.specVersion}, current=${current.specVersion})`,
      severity: "error",
    });
    // Return early — the entire lock is stale; further entry comparison is noise
    return diagnostics;
  }

  // sourceHash mismatch — source has changed since the lock was written
  if (current.sourceHash !== stored.sourceHash) {
    diagnostics.push({
      code: "E_LOCK_MISMATCH",
      message: `${LOCK_DIAGNOSTIC_MESSAGES.E_LOCK_MISMATCH} (sourceHash differs)`,
      severity: "error",
    });
  }

  // Task 3.2: entry-by-entry comparison
  const storedByKey = new Map(stored.entries.map((e) => [`${e.kind}:${e.key}`, e]));
  const currentByKey = new Map(current.entries.map((e) => [`${e.kind}:${e.key}`, e]));

  // Entries present in current but missing or different in stored
  for (const [compositeKey, ce] of currentByKey) {
    const se = storedByKey.get(compositeKey);
    if (!se) {
      diagnostics.push({
        code: "E_LOCK_MISMATCH",
        message: `${LOCK_DIAGNOSTIC_MESSAGES.E_LOCK_MISMATCH} (entry added: ${compositeKey})`,
        severity: "error",
      });
    } else if (ce.version !== se.version || ce.hash !== se.hash) {
      diagnostics.push({
        code: "E_LOCK_MISMATCH",
        message: `${LOCK_DIAGNOSTIC_MESSAGES.E_LOCK_MISMATCH} (entry changed: ${compositeKey})`,
        severity: "error",
      });
    }
  }

  // Entries present in stored but removed in current
  for (const compositeKey of storedByKey.keys()) {
    if (!currentByKey.has(compositeKey)) {
      diagnostics.push({
        code: "E_LOCK_MISMATCH",
        message: `${LOCK_DIAGNOSTIC_MESSAGES.E_LOCK_MISMATCH} (entry removed: ${compositeKey})`,
        severity: "error",
      });
    }
  }

  return diagnostics;
}
