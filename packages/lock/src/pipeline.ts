/**
 * Build pipeline integration — lock freeze.
 *
 * Pipeline position (task 5.1):
 *   parse → resolve-config → validate → [freezeLock] → generate-manifest → generate-targets
 *
 * freezeLock is the single entry point for lock handling in the build pipeline:
 *
 *   --lock-update (or no lock file):
 *     Generate a new LockFile, write snap.lock to disk, emit I_LOCK_CREATED.
 *
 *   default (snap.lock exists and --lock-update not passed):
 *     Read existing snap.lock, verify against freshly-generated lock.
 *     Emit E_LOCK_MISMATCH / E_LOCK_STALE on differences and fail.
 *
 *   no snap.lock and not --lock-update:
 *     Emit W_NO_LOCK, auto-generate and write the lock (v0.6.0 behaviour).
 *
 * Spec reference: design.md §Lock generation is a side effect of build,
 *                            §Lock is consumed before manifest generation
 */

import { existsSync, writeFileSync } from "node:fs";
import type { SourceFile } from "@openstrux/ast";
import type { ContextResolutionResult } from "@openstrux/config";
import { generateLock, type GenerateLockInput } from "./generate.js";
import { readLock } from "./verify.js";
import { verifyLock } from "./verify.js";
import { serialise } from "./io.js";
import {
  type LockDiagnostic,
  type LockFile,
  LOCK_DIAGNOSTIC_MESSAGES,
} from "./types.js";

// ---------------------------------------------------------------------------
// Input / Output
// ---------------------------------------------------------------------------

export interface FreezeLockInput {
  /** Raw source text — used to compute sourceHash. */
  readonly source: string;
  /** Validated IR. */
  readonly sourceFile: SourceFile;
  /** Resolved context. */
  readonly config: ContextResolutionResult;
  /** Adapter version map (target type path → version). */
  readonly adapterVersions: Record<string, string>;
  /** OpenStrux spec version, e.g. "0.6.0". */
  readonly specVersion: string;
  /**
   * Absolute path to snap.lock on disk.
   * The file is read (if it exists) and/or written here.
   */
  readonly lockPath: string;
  /**
   * When true, generate a fresh lock and write it regardless of whether
   * an existing lock exists (equivalent to `npm install` vs `npm ci`).
   * When false (default), read existing lock and fail if it differs.
   */
  readonly lockUpdate: boolean;
  /**
   * Fixed timestamp for generatedAt — useful in tests for determinism.
   * Defaults to current time.
   */
  readonly timestamp?: string | undefined;
}

export interface FreezeLockResult {
  /** The frozen LockFile (newly generated or read from disk). */
  readonly lock: LockFile;
  /**
   * Diagnostics emitted during freeze:
   *   I_LOCK_CREATED  — lock was written (new or updated)
   *   W_NO_LOCK       — no lock existed and auto-generated (v0.6.0)
   *   E_LOCK_MISMATCH — entries differ and --lock-update was not passed
   *   E_LOCK_STALE    — spec version changed
   */
  readonly diagnostics: readonly LockDiagnostic[];
  /**
   * True when the pipeline should halt (error-severity diagnostic was emitted
   * and --lock-update was not passed).
   */
  readonly shouldFail: boolean;
}

// ---------------------------------------------------------------------------
// Public API (tasks 2.6, 3.4)
// ---------------------------------------------------------------------------

/**
 * Freeze the dependency lock for the current build.
 *
 * See module-level doc for the three operational modes.
 */
export function freezeLock(input: FreezeLockInput): FreezeLockResult {
  const generateInput: GenerateLockInput = {
    source: input.source,
    sourceFile: input.sourceFile,
    config: input.config,
    adapterVersions: input.adapterVersions,
    specVersion: input.specVersion,
    timestamp: input.timestamp,
  };

  const lockExists = existsSync(input.lockPath);

  // -----------------------------------------------------------------------
  // Mode 1: --lock-update or no lock file
  // -----------------------------------------------------------------------
  if (input.lockUpdate || !lockExists) {
    const lock = generateLock(generateInput);
    writeFileSync(input.lockPath, serialise(lock), "utf8");

    const diagnostics: LockDiagnostic[] = [];

    if (!lockExists && !input.lockUpdate) {
      // Auto-generated on first build
      diagnostics.push({
        code: "W_NO_LOCK",
        message: LOCK_DIAGNOSTIC_MESSAGES.W_NO_LOCK,
        severity: "warning",
      });
    }

    diagnostics.push({
      code: "I_LOCK_CREATED",
      message: LOCK_DIAGNOSTIC_MESSAGES.I_LOCK_CREATED,
      severity: "info",
    });

    return { lock, diagnostics, shouldFail: false };
  }

  // -----------------------------------------------------------------------
  // Mode 2: lock file exists, verify it
  // -----------------------------------------------------------------------
  const currentLock = generateLock(generateInput);
  const storedLock = readLock(input.lockPath);
  const verifyDiags = verifyLock(currentLock, storedLock);

  const hasError = verifyDiags.some((d) => d.severity === "error");

  // Use the stored lock so downstream sees the pinned state
  return {
    lock: storedLock,
    diagnostics: verifyDiags,
    shouldFail: hasError,
  };
}
