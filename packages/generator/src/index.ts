/**
 * @openstrux/generator — adapter-based code generation engine.
 *
 * Spec reference: openstrux-spec/rfcs/RFC-0001-typescript-target-adapter.md
 */

export type {
  Adapter,
  GeneratedFile,
  GenerateOptions,
  Manifest,
  TopLevelNode,
} from "./types.js";
export { UnknownTargetError } from "./types.js";
export { registerAdapter, getAdapter, listTargets } from "./registry.js";
export { generate } from "./generate.js";
export { promote } from "./promote.js";

// Register built-in adapters
import { TypeScriptAdapter } from "./adapters/typescript/index.js";
import { registerAdapter } from "./registry.js";
registerAdapter("typescript", TypeScriptAdapter);
