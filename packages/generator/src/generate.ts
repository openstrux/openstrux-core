/**
 * Top-level `generate()` function — wires registry + adapter dispatch.
 *
 * Spec reference: openstrux-spec/specs/generator/generator.md §4
 */

import type {
  GeneratedFile,
  GenerateOptions,
  Manifest,
  PackageOutput,
  ResolvedOptions,
  TopLevelNode,
} from "./types.js";
import { getAdapter } from "./registry.js";

// ---------------------------------------------------------------------------
// Stub ResolvedOptions for convenience in tests / simple callers
// ---------------------------------------------------------------------------

function stubResolved(framework: string): ResolvedOptions {
  const stub = (name: string) => ({ name, version: "0.0.0", adapter: "stub" });
  return {
    framework: stub(framework),
    orm:        stub("prisma"),
    validation: stub("zod"),
    runtime:    stub("node"),
  };
}

// ---------------------------------------------------------------------------
// generate() — emit source files (does NOT write to disk)
// ---------------------------------------------------------------------------

/**
 * Emit generated source files from a validated AST and manifest.
 * Accepts either `ResolvedOptions` (preferred) or the legacy `GenerateOptions`
 * (which uses `framework` to look up a registered adapter).
 *
 * @returns Array of generated files with package-relative paths.
 */
export function generate(
  ast: TopLevelNode[],
  manifest: Manifest,
  options: ResolvedOptions | GenerateOptions
): GeneratedFile[] {
  const resolved = resolveOptions(options);
  const adapter = getAdapter(resolved.framework.name);
  return adapter.emit(ast, manifest, resolved);
}

// ---------------------------------------------------------------------------
// build() — full pipeline: emit + package
// ---------------------------------------------------------------------------

/**
 * Run the full build pipeline: emit source files then package them.
 * Returns both the emitted files and the package output.
 */
export function build(
  ast: TopLevelNode[],
  manifest: Manifest,
  options: ResolvedOptions | GenerateOptions
): { files: GeneratedFile[]; pkg: PackageOutput } {
  const resolved = resolveOptions(options);
  const adapter = getAdapter(resolved.framework.name);
  const files = adapter.emit(ast, manifest, resolved);
  const pkg = adapter.package(files);
  return { files, pkg };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveOptions(options: ResolvedOptions | GenerateOptions): ResolvedOptions {
  // Already a ResolvedOptions (has framework.name as an object)
  if (typeof (options as ResolvedOptions).framework === "object" &&
      (options as ResolvedOptions).framework !== null &&
      "name" in (options as ResolvedOptions).framework) {
    return options as ResolvedOptions;
  }
  // Legacy GenerateOptions with a `framework` string
  const legacy = options as GenerateOptions;
  if (legacy.resolved !== undefined) return legacy.resolved;
  const frameworkName = typeof legacy.framework === "string" ? legacy.framework : "next";
  return stubResolved(frameworkName);
}
