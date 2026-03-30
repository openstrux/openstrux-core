/**
 * @openstrux/generator — adapter-based code generation engine.
 *
 * Spec reference: openstrux-spec/specs/generator/generator.md
 *                 openstrux-spec/rfcs/RFC-0001-typescript-target-adapter.md
 */

export type {
  Adapter,
  GeneratedFile,
  GenerateOptions,
  Manifest,
  PackageOutput,
  ResolvedDep,
  ResolvedOptions,
  TopLevelNode,
} from "./types.js";
export { UnknownTargetError } from "./types.js";
export { registerAdapter, getAdapter, listTargets } from "./registry.js";
export { generate, build } from "./generate.js";
export { promote } from "./promote.js";
export { parseConfig, loadConfig, ConfigParseError } from "./config.js";
export { resolveOptions, AdapterResolutionError, BUNDLED_MANIFESTS, STRUX_VERSION } from "./resolve.js";

// Register built-in adapters
import { NextJsAdapter } from "./adapters/nextjs/index.js";
import { registerAdapter } from "./registry.js";
// Register under the npm package name ("next") — the config's framework.name
registerAdapter("next", NextJsAdapter);
