/**
 * Merge semantics for strux.context cascade.
 * - @dp: field-level merge, nearest (panel) wins on conflict (CI-002)
 * - @access: scope narrowing only — child scope <= parent scope (CI-003)
 * - @ops / @sec: nearest-wins per field (CI-004)
 */
import type { KnotValue } from "@openstrux/parser";
import type { ConfigDiagnostic } from "./types.js";

/**
 * Merge @dp blocks. Later entries win on field conflict (nearest wins).
 * @param layers - from root (index 0) to nearest (last index)
 */
export function mergeDp(
  layers: ReadonlyArray<Record<string, KnotValue>>,
): Record<string, KnotValue> {
  const result: Record<string, KnotValue> = {};
  for (const layer of layers) {
    Object.assign(result, layer);
  }
  return result;
}

/**
 * Merge @ops blocks. Nearest wins per field (CI-004).
 */
export function mergeOps(
  layers: ReadonlyArray<Record<string, KnotValue>>,
): Record<string, KnotValue> {
  return mergeDp(layers); // same semantics
}

/**
 * Merge @sec blocks. Nearest wins per field (CI-004).
 */
export function mergeSec(
  layers: ReadonlyArray<Record<string, KnotValue>>,
): Record<string, KnotValue> {
  return mergeDp(layers); // same semantics
}

/**
 * Merge @access blocks with scope narrowing enforcement (CI-003).
 * Child scope must be a subset of parent scope.
 * Emits compile error on widening attempt.
 *
 * For v0.6.0, scope narrowing is checked on the `scope` field if it contains
 * a field list (fieldMask semantics).
 */
export function mergeAccess(
  layers: ReadonlyArray<{
    access: Record<string, KnotValue>;
    filePath: string;
  }>,
): { merged: Record<string, KnotValue>; diagnostics: ConfigDiagnostic[] } {
  const diagnostics: ConfigDiagnostic[] = [];
  let merged: Record<string, KnotValue> = {};

  for (const layer of layers) {
    const child = layer.access;

    // Check scope narrowing: if parent has scope.fields, child must not add fields
    if (
      Object.keys(merged).length > 0 &&
      Object.keys(child).length > 0
    ) {
      const parentFields = extractScopeFields(merged);
      const childFields = extractScopeFields(child);

      if (parentFields !== null && childFields !== null) {
        const addedFields = childFields.filter(
          (f) => !parentFields.includes(f),
        );
        if (addedFields.length > 0) {
          diagnostics.push({
            code: "E_ACCESS_WIDENING",
            message: `@access scope widening detected in '${layer.filePath}': fields [${addedFields.join(", ")}] exceed parent scope`,
            severity: "error",
            file: layer.filePath,
          });
        }
      }
    }

    // Merge: child fields override parent fields
    merged = { ...merged, ...child };
  }

  return { merged, diagnostics };
}

/**
 * Extract field list from an @access block's scope fields.
 * Returns null if scope.fields is not present/parseable.
 */
function extractScopeFields(
  access: Record<string, KnotValue>,
): string[] | null {
  const scopeVal = access["scope"];
  if (scopeVal === undefined) return null;
  if (scopeVal.kind === "block") {
    const fieldsVal = scopeVal.config["fields"];
    if (fieldsVal === undefined) return null;
    if (fieldsVal.kind === "raw-expr") {
      // Parse comma-separated field list from raw expr like "[name, email]"
      const text = fieldsVal.text.replace(/[\[\]]/g, "").trim();
      if (text === "") return [];
      return text
        .split(",")
        .map((f) => f.trim())
        .filter((f) => f.length > 0);
    }
  }
  return null;
}

/**
 * Merge named source/target maps. Nearest wins.
 */
export function mergeEndpoints<T>(
  layers: ReadonlyArray<Record<string, T>>,
): Record<string, T> {
  const result: Record<string, T> = {};
  for (const layer of layers) {
    Object.assign(result, layer);
  }
  return result;
}
