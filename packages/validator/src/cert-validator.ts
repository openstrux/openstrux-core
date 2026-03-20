/**
 * @cert enforcement (ADR-011).
 *
 * E_CERT_HASH_MISMATCH: cert hash does not match compiled output
 * W_CERT_SCOPE_UNCOVERED: panel uses type path not covered by @cert scope
 *
 * Note: E_CERT_IN_CONTEXT is emitted by the config package, not here.
 */
import type { PanelNode, KnotValue } from "@openstrux/parser";
import type { ValidationDiagnostic } from "./diagnostics.js";

export interface CertValidationOptions {
  /** Compiled content hash to verify against @cert.hash (if present). */
  compiledHash?: string | undefined;
}

export function validateCert(
  panels: readonly PanelNode[],
  options: CertValidationOptions = {},
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];

  for (const panel of panels) {
    // Look for @cert knot in panel-level dp block (cert is declared at panel level in .strux)
    const certVal = panel.dp?.["cert"];
    if (certVal === undefined) continue;

    // E_CERT_HASH_MISMATCH: check cert hash against compiled output
    if (options.compiledHash !== undefined && certVal.kind === "block") {
      const hashVal = certVal.config["hash"];
      if (hashVal !== undefined && hashVal.kind === "string") {
        if (hashVal.value !== options.compiledHash) {
          diagnostics.push({
            code: "E_CERT_HASH_MISMATCH",
            message: `@cert hash mismatch in panel '${panel.name}': expected '${options.compiledHash}' but cert declares '${hashVal.value}'`,
            severity: "error",
            line: panel.loc?.line,
            panel: panel.name,
          });
        }
      }
    }

    // W_CERT_SCOPE_UNCOVERED: check type paths used in panel are in cert scope
    if (certVal.kind === "block") {
      const scopeVal = certVal.config["scope"];
      if (scopeVal !== undefined) {
        const uncoveredDiags = checkCertScopeCoverage(panel, scopeVal);
        diagnostics.push(...uncoveredDiags);
      }
    }
  }

  return diagnostics;
}

function checkCertScopeCoverage(
  panel: PanelNode,
  certScope: KnotValue,
): ValidationDiagnostic[] {
  // For v0.6.0: cert scope is a block of type paths
  // If a rod uses a type path not listed in cert.scope, emit W_CERT_SCOPE_UNCOVERED
  if (certScope.kind !== "block") return [];

  const coveredPaths = new Set(Object.keys(certScope.config));
  const diagnostics: ValidationDiagnostic[] = [];

  for (const rod of panel.rods) {
    for (const [_key, value] of Object.entries(rod.knots)) {
      const paths = extractTypePaths(value);
      for (const path of paths) {
        const topLevel = path.split(".")[0];
        if (
          topLevel !== undefined &&
          !coveredPaths.has(path) &&
          !coveredPaths.has(topLevel)
        ) {
          diagnostics.push({
            code: "W_CERT_SCOPE_UNCOVERED",
            message: `Panel '${panel.name}' rod '${rod.name}' uses type path '${path}' not covered by @cert scope`,
            severity: "warning",
            line: rod.loc?.line,
            panel: panel.name,
            rod: rod.name,
          });
        }
      }
    }
  }

  return diagnostics;
}

function extractTypePaths(value: KnotValue): string[] {
  const paths: string[] = [];
  if (value.kind === "path" && value.segments.length > 1) {
    paths.push(value.segments.join("."));
  }
  if (
    value.kind === "block" ||
    (value.kind === "path" && value.config !== undefined)
  ) {
    const config =
      value.kind === "block" ? value.config : (value.config ?? {});
    for (const [_k, v] of Object.entries(config)) {
      paths.push(...extractTypePaths(v));
    }
  }
  return paths;
}
