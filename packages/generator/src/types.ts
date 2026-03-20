/**
 * Core types for the OpenStrux generator engine.
 *
 * Spec reference: openstrux-spec/rfcs/RFC-0001-typescript-target-adapter.md
 */

import type { TypeRecord, TypeEnum, TypeUnion } from "@openstrux/ast";
import type { Panel } from "@openstrux/ast";

// ---------------------------------------------------------------------------
// Top-level AST node union — inputs to the generator
// ---------------------------------------------------------------------------

export type TopLevelNode = TypeRecord | TypeEnum | TypeUnion | Panel;

// ---------------------------------------------------------------------------
// Manifest — opaque parsed mf.strux.json
// ---------------------------------------------------------------------------

export type Manifest = Record<string, unknown>;

// ---------------------------------------------------------------------------
// GeneratedFile — a single output artifact
// ---------------------------------------------------------------------------

/**
 * A single generated output file.
 * `path` is relative to the generator output root.
 */
export interface GeneratedFile {
  /** Relative path from the generator output root. */
  path: string;
  /** File content as a string. */
  content: string;
  /** Language identifier (e.g., "typescript", "prisma"). */
  lang: string;
}

// ---------------------------------------------------------------------------
// GenerateOptions — caller-provided options
// ---------------------------------------------------------------------------

export interface GenerateOptions {
  /** Target identifier. Must match a registered adapter key. */
  target: string;
  /** Next.js version string. Defaults to "14". */
  nextVersion?: string | undefined;
  /** Additional target-specific options. */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Adapter — the interface every target adapter must implement
// ---------------------------------------------------------------------------

export interface Adapter {
  generate(
    ast: TopLevelNode[],
    manifest: Manifest,
    options: GenerateOptions
  ): GeneratedFile[];
}

// ---------------------------------------------------------------------------
// UnknownTargetError
// ---------------------------------------------------------------------------

export class UnknownTargetError extends Error {
  constructor(target: string) {
    super(`No adapter registered for target: "${target}"`);
    this.name = "UnknownTargetError";
  }
}
