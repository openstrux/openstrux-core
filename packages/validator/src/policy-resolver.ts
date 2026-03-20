/**
 * Policy resolution — guard rod policy tier classification.
 * ADR-010: inline → hub → external tiers.
 *
 * W_POLICY_OPAQUE: guard references external or unreachable hub policy
 * W_SCOPE_UNVERIFIED: scope fields cannot be statically confirmed
 */
import type { PanelNode, KnotValue } from "@openstrux/parser";
import type { ValidationDiagnostic } from "./diagnostics.js";

export type PolicyTier = "inline" | "hub" | "external";

const EXTERNAL_ENGINES = new Set(["opa", "cedar", "casbin", "custom"]);

/**
 * Classify a policy knot value into a tier.
 */
export function classifyPolicyTier(policyVal: KnotValue): PolicyTier {
  if (policyVal.kind === "block") {
    // Inline policy: { rules: [...] }
    return "inline";
  }
  if (policyVal.kind === "path") {
    const first = policyVal.segments[0];
    if (first !== undefined && EXTERNAL_ENGINES.has(first)) {
      return "external";
    }
    // Hub reference: multi-segment path like "hub.policy.my-policy"
    if (policyVal.segments.length > 1) {
      return "hub";
    }
  }
  if (policyVal.kind === "raw-expr") {
    // Check for known external engine names
    for (const engine of EXTERNAL_ENGINES) {
      if (policyVal.text.startsWith(engine)) return "external";
    }
  }
  return "inline"; // default
}

export function resolveGuardPolicies(
  panels: readonly PanelNode[],
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];

  for (const panel of panels) {
    for (const rod of panel.rods) {
      if (rod.rodType !== "guard") continue;

      const policyVal = rod.knots["policy"];
      if (policyVal === undefined) continue;

      const tier = classifyPolicyTier(policyVal);

      if (tier === "external") {
        // 3.4: External policy always emits W_POLICY_OPAQUE
        diagnostics.push({
          code: "W_POLICY_OPAQUE",
          message: `Guard rod '${rod.name}' in panel '${panel.name}' references an external policy that cannot be verified at compile time`,
          severity: "warning",
          line: rod.loc?.line,
          panel: panel.name,
          rod: rod.name,
        });
      } else if (tier === "hub") {
        // 3.3: Hub policy — attempt lookup, emit W_POLICY_OPAQUE if unreachable
        // For v0.6.0, hub is always considered unreachable (no hub client)
        diagnostics.push({
          code: "W_POLICY_OPAQUE",
          message: `Guard rod '${rod.name}' in panel '${panel.name}' references a hub policy that could not be resolved at compile time`,
          severity: "warning",
          line: rod.loc?.line,
          panel: panel.name,
          rod: rod.name,
        });
      }
      // Inline: no diagnostic (fully verified)

      // 3.5: W_SCOPE_UNVERIFIED — check if scope fields in policy can be confirmed
      if (tier !== "external" && panel.access !== undefined) {
        const scopeVal = panel.access.fields["scope"];
        if (
          scopeVal !== undefined &&
          !canVerifyScopeFields(policyVal, scopeVal)
        ) {
          diagnostics.push({
            code: "W_SCOPE_UNVERIFIED",
            message: `Guard rod '${rod.name}' in panel '${panel.name}' — AccessContext scope fields referenced in policy cannot be statically confirmed`,
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

/**
 * Check if policy scope field references can be statically confirmed.
 * For v0.6.0: inline policies with raw-expr rules that reference scope fields
 * are considered statically unverifiable if the scope contains a fieldMask.
 */
function canVerifyScopeFields(
  _policy: KnotValue,
  scope: KnotValue,
): boolean {
  // Simplified: if scope has a block with fieldMask, assume verifiable for inline, not for hub
  if (
    scope.kind === "block" &&
    scope.config["fieldMask"] !== undefined
  ) {
    return false; // cannot statically confirm which fields are accessed
  }
  return true;
}
