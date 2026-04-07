/**
 * @openstrux/lock — snap.lock semantics and determinism.
 *
 * Public API:
 *   LockFile      — top-level lock file shape (also exported as SnapLock for
 *                   backward compatibility with @openstrux/manifest)
 *   LockEntry     — single pinned dependency entry
 *   LockDiagnostic — diagnostic emitted during lock operations
 *   generateLock  — produce a LockFile from a resolved build state
 *   readLock      — parse and validate snap.lock from disk
 *   verifyLock    — compare current state against a stored lock
 *   freezeLock    — pipeline entry point (generate or verify, read/write disk)
 *   serialise     — deterministic JSON serialisation
 *   deserialise   — JSON deserialisation + schema validation
 */

export type {
  LockFile,
  LockEntry,
  LockDiagnostic,
  LockDiagnosticCode,
  SnapLock,
} from "./types.js";

export { LOCK_DIAGNOSTIC_MESSAGES } from "./types.js";

export { serialise, deserialise } from "./io.js";

export { canonicalise, computeContentHash } from "./canonicalise.js";

export type { GenerateLockInput } from "./generate.js";
export { generateLock } from "./generate.js";

export { readLock, verifyLock } from "./verify.js";

export type { FreezeLockInput, FreezeLockResult } from "./pipeline.js";
export { freezeLock } from "./pipeline.js";
