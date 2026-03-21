/**
 * @ops field schema and validator.
 *
 * Defines the allowed fields and value types for @ops decorator blocks.
 * Emits E_OPS_UNKNOWN_FIELD and E_OPS_TYPE_MISMATCH diagnostics.
 *
 * Schema (per spec syntax-reference.md):
 *   retry:           number
 *   timeout:         duration
 *   fallback:        string (rod name or @name reference)
 *   circuit_breaker: { threshold: number, window: duration }
 *   rate_limit:      { max: number, window: duration }
 */

import type { KnotValue, PanelNode, RodNode } from "@openstrux/parser";
import type { ValidationDiagnostic } from "./diagnostics.js";

/** Expected field types for @ops top-level fields. */
type OpsFieldKind = "number" | "duration" | "string" | "record";

interface OpsFieldSpec {
  readonly kind: OpsFieldKind;
  /** For record fields, the expected subfield specs. */
  readonly subfields?: Readonly<Record<string, OpsFieldKind>>;
}

const OPS_SCHEMA: Readonly<Record<string, OpsFieldSpec>> = {
  retry: { kind: "number" },
  timeout: { kind: "duration" },
  fallback: { kind: "string" },
  circuit_breaker: {
    kind: "record",
    subfields: { threshold: "number", window: "duration" },
  },
  rate_limit: {
    kind: "record",
    subfields: { max: "number", window: "duration" },
  },
};

export function validateOpsBlocks(panels: readonly PanelNode[]): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];

  for (const panel of panels) {
    // Panel-level @ops is stored in the panel's dp block context; it comes via
    // the config resolver, not in the parse AST. Validate rod-level @ops from AST.
    for (const rod of panel.rods) {
      if (rod.ops !== undefined) {
        diagnostics.push(...validateOpsBlock(rod.ops, panel.name, rod));
      }
    }
  }

  return diagnostics;
}

function validateOpsBlock(
  ops: Record<string, KnotValue>,
  panelName: string,
  rod: RodNode,
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];

  for (const [field, value] of Object.entries(ops)) {
    const spec = OPS_SCHEMA[field];

    if (spec === undefined) {
      diagnostics.push({
        code: "E_OPS_UNKNOWN_FIELD",
        message: `Unknown @ops field '${field}' in rod '${rod.name}' of panel '${panelName}'. Allowed: ${Object.keys(OPS_SCHEMA).join(", ")}`,
        severity: "error",
        line: rod.loc?.line,
        col: rod.loc?.col,
        panel: panelName,
        rod: rod.name,
      });
      continue;
    }

    if (spec.kind === "record") {
      // Value should be a block
      if (value.kind !== "block") {
        diagnostics.push({
          code: "E_OPS_TYPE_MISMATCH",
          message: `@ops field '${field}' expects a record block { ... } in rod '${rod.name}' of panel '${panelName}'`,
          severity: "error",
          line: rod.loc?.line,
          col: rod.loc?.col,
          panel: panelName,
          rod: rod.name,
        });
        continue;
      }
      // Validate subfields
      const subfields = spec.subfields ?? {};
      for (const [sub, subValue] of Object.entries(value.config)) {
        const expectedKind = subfields[sub];
        if (expectedKind === undefined) {
          diagnostics.push({
            code: "E_OPS_UNKNOWN_FIELD",
            message: `Unknown @ops subfield '${field}.${sub}' in rod '${rod.name}' of panel '${panelName}'`,
            severity: "error",
            line: rod.loc?.line,
            col: rod.loc?.col,
            panel: panelName,
            rod: rod.name,
          });
          continue;
        }
        if (!valueMatchesKind(subValue, expectedKind)) {
          diagnostics.push({
            code: "E_OPS_TYPE_MISMATCH",
            message: `@ops field '${field}.${sub}' expects ${expectedKind} but got ${subValue.kind} in rod '${rod.name}' of panel '${panelName}'`,
            severity: "error",
            line: rod.loc?.line,
            col: rod.loc?.col,
            panel: panelName,
            rod: rod.name,
          });
        }
      }
    } else {
      // Primitive field
      if (!valueMatchesKind(value, spec.kind)) {
        diagnostics.push({
          code: "E_OPS_TYPE_MISMATCH",
          message: `@ops field '${field}' expects ${spec.kind} but got ${value.kind} in rod '${rod.name}' of panel '${panelName}'`,
          severity: "error",
          line: rod.loc?.line,
          col: rod.loc?.col,
          panel: panelName,
          rod: rod.name,
        });
      }
    }
  }

  return diagnostics;
}

function valueMatchesKind(value: KnotValue, kind: OpsFieldKind): boolean {
  switch (kind) {
    case "number":   return value.kind === "number";
    case "duration": return value.kind === "duration";
    case "string":   return value.kind === "string";
    case "record":   return value.kind === "block";
  }
}
