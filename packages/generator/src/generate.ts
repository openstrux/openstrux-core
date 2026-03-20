/**
 * Top-level `generate()` function — wires registry + adapter dispatch.
 *
 * Spec reference: openstrux-spec/rfcs/RFC-0001-typescript-target-adapter.md
 */

import type { GeneratedFile, GenerateOptions, Manifest, TopLevelNode } from "./types.js";
import { getAdapter } from "./registry.js";

/**
 * Generate output files from a validated AST and manifest.
 *
 * @param ast      - Validated OpenStrux AST (array of top-level nodes)
 * @param manifest - Parsed mf.strux.json manifest object
 * @param options  - Generator options (target, nextVersion, etc.)
 * @returns Array of generated files. Order within the array is not normative.
 */
export function generate(
  ast: TopLevelNode[],
  manifest: Manifest,
  options: GenerateOptions
): GeneratedFile[] {
  const adapter = getAdapter(options.target);
  return adapter.generate(ast, manifest, options);
}
