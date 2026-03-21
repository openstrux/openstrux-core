/**
 * Context resolver — orchestrates collection, merge, and named endpoint resolution.
 * CI-007: produces a fully flattened ContextResolutionResult.
 */
import type { KnotValue } from "@openstrux/parser";
import type {
  ConfigDiagnostic,
  ContextResolutionResult,
  RawNamedEndpoint,
} from "./types.js";
import { collectContextFiles } from "./collector.js";
import {
  mergeDp,
  mergeOps,
  mergeSec,
  mergeAccess,
  mergeEndpoints,
} from "./merge.js";

/**
 * Resolve all strux.context files for a panel at `panelPath`.
 *
 * @param panelPath - Absolute path to the .strux panel file
 * @param panelDp - @dp block from the panel itself (wins on conflict)
 * @param panelAccess - @access block from the panel itself
 * @param panelOps - @ops block from the panel (optional)
 * @param panelSec - @sec block from the panel (optional)
 * @param projectRoot - Optional project root override
 */
export function resolveContext(
  panelPath: string,
  panelDp: Record<string, KnotValue> = {},
  panelAccess: Record<string, KnotValue> = {},
  panelOps: Record<string, KnotValue> = {},
  panelSec: Record<string, KnotValue> = {},
  projectRoot?: string | undefined,
): ContextResolutionResult {
  const allDiagnostics: ConfigDiagnostic[] = [];

  // Collect all context files from root → panel dir
  const { files, diagnostics: collectDiagnostics } = collectContextFiles(
    panelPath,
    projectRoot,
  );
  allDiagnostics.push(...collectDiagnostics);

  // CI-009: Reject @cert in any context file (already emitted in parseContextFile)
  // (diagnostics already added)

  // Build layers for each field type (root → panel dir → panel itself)
  const dpLayers = [...files.map((f) => f.dp), panelDp];
  const opsLayers = [...files.map((f) => f.ops), panelOps];
  const secLayers = [...files.map((f) => f.sec), panelSec];

  // Access layers with file paths for error reporting
  const accessLayers = [
    ...files.map((f) => ({ access: f.access, filePath: f.path })),
    { access: panelAccess, filePath: panelPath },
  ];

  const dp = mergeDp(dpLayers);
  const ops = mergeOps(opsLayers);
  const sec = mergeSec(secLayers);
  const { merged: access, diagnostics: accessDiagnostics } =
    mergeAccess(accessLayers);
  allDiagnostics.push(...accessDiagnostics);

  // Named sources/targets: nearest wins
  const sourceLayers = files.map((f) => f.sources);
  const targetLayers = files.map((f) => f.targets);
  const sources = mergeEndpoints<RawNamedEndpoint>(sourceLayers);
  const targets = mergeEndpoints<RawNamedEndpoint>(targetLayers);

  return {
    dp,
    access,
    ops,
    sec,
    sources,
    targets,
    diagnostics: allDiagnostics,
  };
}

/**
 * Resolve @ops for a specific rod, merging the context→panel→rod cascade.
 * Rod-level @ops wins over panel @ops wins over context @ops (nearest wins).
 * CI-rod-ops: rod-level @ops merge.
 */
export function resolveRodOps(
  contextOps: Record<string, KnotValue>,
  panelOps: Record<string, KnotValue>,
  rodOps: Record<string, KnotValue>,
): Record<string, KnotValue> {
  return mergeOps([contextOps, panelOps, rodOps]);
}

/**
 * Resolve a named source/target reference like `@production`.
 * If the name is not found, returns null and the caller emits a compile error.
 * CI-005
 */
export function resolveNamedEndpoint(
  refName: string,
  endpoints: Record<string, RawNamedEndpoint>,
  inlineOverrides: Record<string, KnotValue> = {},
): { config: Record<string, KnotValue> } | null {
  const endpoint = endpoints[refName];
  if (endpoint === undefined) return null;
  // Apply inline overrides as spread (CI-005)
  return { config: { ...endpoint.config, ...inlineOverrides } };
}
