/**
 * @openstrux/config — public API
 *
 * Resolves strux.context cascade for a given panel path.
 * Spec reference: openstrux-spec/specs/core/config-inheritance.md
 */

export type {
  ConfigDiagnostic,
  RawContextFile,
  RawNamedEndpoint,
  ContextResolutionResult,
} from "./types.js";
export { parseContextFile } from "./context-parser.js";
export { collectContextFiles } from "./collector.js";
export {
  mergeDp,
  mergeOps,
  mergeSec,
  mergeAccess,
  mergeEndpoints,
} from "./merge.js";
export { resolveContext, resolveNamedEndpoint } from "./resolver.js";
