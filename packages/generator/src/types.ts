/**
 * Core types for the OpenStrux generator engine.
 *
 * Spec reference: openstrux-spec/specs/generator/generator.md
 *                 openstrux-spec/rfcs/RFC-0001-typescript-target-adapter.md (ADR-019)
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
 * `path` is relative to the package output directory (not the project root),
 * unless `projectRoot` is true — in which case it is relative to the project root.
 */
export interface GeneratedFile {
  /** Relative path from the package output directory (or project root when projectRoot=true). */
  path: string;
  /** File content as a string. */
  content: string;
  /** Language identifier (e.g., "typescript", "prisma", "json"). */
  lang: string;
  /**
   * When true, the file is written relative to the project root rather than
   * the adapter output directory. Used for `prisma/schema.prisma` (v0.6).
   */
  projectRoot?: boolean;
}

// ---------------------------------------------------------------------------
// ResolvedDep / ResolvedOptions — config-resolved adapter set
// ---------------------------------------------------------------------------

export interface ResolvedDep {
  /** Package name (e.g. "next", "prisma"). */
  name: string;
  /** Pinned version string (e.g. "15.1.2"). */
  version: string;
  /** Adapter identifier that resolved this dep (e.g. "adapter/nextjs@1.2.0"). */
  adapter: string;
}

export interface ResolvedOptions {
  framework: ResolvedDep;
  orm: ResolvedDep;
  validation: ResolvedDep;
  runtime: ResolvedDep;
}

// ---------------------------------------------------------------------------
// PackageOutput — the result of adapter.package()
// ---------------------------------------------------------------------------

export interface PackageOutput {
  /** Output directory relative to the project root. Default: ".openstrux/build". */
  outputDir: string;
  /** Ecosystem metadata files: package.json, tsconfig.json, etc. */
  metadata: GeneratedFile[];
  /** Barrel export files: index.ts, schemas/index.ts, handlers/index.ts. */
  entrypoints: GeneratedFile[];
}

// ---------------------------------------------------------------------------
// Adapter — the interface every target adapter must implement
// ---------------------------------------------------------------------------

export interface Adapter {
  /** Adapter name, matching the registry key (e.g. "nextjs"). */
  name: string;

  /**
   * Emit source files from a validated AST and manifest.
   * All GeneratedFile.path values are relative to the package output directory.
   */
  emit(
    ast: TopLevelNode[],
    manifest: Manifest,
    options: ResolvedOptions
  ): GeneratedFile[];

  /**
   * Wrap emitted source files in an ecosystem-native package.
   */
  package(files: GeneratedFile[]): PackageOutput;
}

// ---------------------------------------------------------------------------
// UnknownTargetError
// ---------------------------------------------------------------------------

export class UnknownTargetError extends Error {
  constructor(framework: string) {
    super(`No adapter registered for target: "${framework}"`);
    this.name = "UnknownTargetError";
  }
}

// ---------------------------------------------------------------------------
// GenerateOptions — kept for backward-compat shim in generate.ts
// ---------------------------------------------------------------------------

/**
 * Legacy options interface. Prefer ResolvedOptions for new code.
 * The top-level generate() still accepts this for convenience in tests.
 */
export interface GenerateOptions {
  /** Framework name — must match a registered adapter key (e.g. "nextjs"). */
  framework: string;
  /** Optional pre-resolved options; if omitted, a stub ResolvedOptions is constructed. */
  resolved?: ResolvedOptions;
  [key: string]: unknown;
}
