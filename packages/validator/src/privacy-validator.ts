/**
 * Privacy validation rules for the `private-data` standard rod and `@privacy` decorator.
 *
 * Implements:
 *   - E_GDPR_PURPOSE_REQUIRED     (Art. 5(1)(b)) — cfg.purpose missing on private-data rod
 *   - E_GDPR_RETENTION_REQUIRED   (Art. 5(1)(e)) — cfg.retention missing
 *   - E_GDPR_INVALID_BASIS_SPECIAL_CATEGORY (Art. 9) — wrong basis for special-category data
 *   - W_GDPR_LI_DPIA_RECOMMENDED  (Art. 35) — legitimate_interest without dpia_ref
 *   - E_PRIVACY_BYPASS            (@privacy) — flow reaches sink without private-data rod
 *   - E_PRIVATE_DATA_BYPASS       (PrivateData<T>) — PrivateData input bypasses private-data rod
 *   - E_BDSG_EMPLOYEE_CATEGORY    (§26 BDSG) — employee_data:true without employee_category
 *
 * Spec reference: openstrux-spec/specs/modules/rods/standard/private-data-gdpr.md
 *                 openstrux-spec/specs/modules/rods/standard/private-data-bdsg.md
 *                 openstrux-spec/specs/core/semantics.md §@privacy decorator
 */

import type { PanelNode, RodNode, KnotValue } from "@openstrux/parser";
import {
  FRAMEWORK_PATH,
  GDPR_BASIS,
  PRIVACY_DIAG,
  PRIVATE_DATA_KNOT,
  ROD_TYPE,
  SENSITIVITY,
  SPECIAL_CATEGORY_ALLOWED_BASES,
} from "@openstrux/ast";
import type { ValidationDiagnostic } from "./diagnostics.js";

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function validatePrivacy(panels: readonly PanelNode[]): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];
  for (const panel of panels) {
    diagnostics.push(...validatePanel(panel));
  }
  return diagnostics;
}

// ---------------------------------------------------------------------------
// Per-panel checks
// ---------------------------------------------------------------------------

function validatePanel(panel: PanelNode): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];
  const privateDataRods = panel.rods.filter((r) => r.rodType === ROD_TYPE.PRIVATE_DATA);
  const hasPrivacyDecorator = panelHasPrivacyDecorator(panel);

  // Per-rod GDPR/BDSG config validation
  for (const rod of privateDataRods) {
    diagnostics.push(...validatePrivateDataRod(rod, panel.name));
  }

  // @privacy decorator: every source→sink path must pass through a private-data rod
  if (hasPrivacyDecorator && privateDataRods.length === 0) {
    diagnostics.push({
      code: PRIVACY_DIAG.PRIVACY_BYPASS,
      message: `Panel '${panel.name}' declares @privacy but has no '${ROD_TYPE.PRIVATE_DATA}' rod. Every data flow path must pass through a private-data rod.`,
      severity: "error",
      panel: panel.name,
    });
  }

  // PrivateData<T> enforcement: any rod with PrivateData<T> input that is not a
  // private-data rod requires a private-data rod downstream before reaching a sink.
  diagnostics.push(...checkPrivateDataWrapperFlow(panel, privateDataRods));

  return diagnostics;
}

// ---------------------------------------------------------------------------
// private-data rod config validation
// ---------------------------------------------------------------------------

function validatePrivateDataRod(rod: RodNode, panelName: string): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];
  const knots = rod.knots;

  const frameworkPath = resolveFrameworkPath(knots);
  const isGdpr = frameworkPath === FRAMEWORK_PATH.GDPR || frameworkPath === FRAMEWORK_PATH.GDPR_BDSG;
  const isBdsg = frameworkPath === FRAMEWORK_PATH.GDPR_BDSG || frameworkPath === FRAMEWORK_PATH.BDSG;

  if (isGdpr) {
    // E_GDPR_PURPOSE_REQUIRED — Art. 5(1)(b)
    if (!knotHasValue(knots[PRIVATE_DATA_KNOT.CFG_PURPOSE])) {
      diagnostics.push({
        code: PRIVACY_DIAG.PURPOSE_REQUIRED,
        message: `Rod '${rod.name}' in panel '${panelName}': cfg.purpose is required for GDPR framework (Art. 5(1)(b)).`,
        severity: "error",
        panel: panelName,
        rod: rod.name,
        line: rod.loc?.line,
      });
    }

    // E_GDPR_RETENTION_REQUIRED — Art. 5(1)(e)
    if (!knotHasValue(knots[PRIVATE_DATA_KNOT.CFG_RETENTION])) {
      diagnostics.push({
        code: PRIVACY_DIAG.RETENTION_REQUIRED,
        message: `Rod '${rod.name}' in panel '${panelName}': cfg.retention is required for GDPR framework (Art. 5(1)(e)).`,
        severity: "error",
        panel: panelName,
        rod: rod.name,
        line: rod.loc?.line,
      });
    }

    // Art. 9 — special category field restrictions
    diagnostics.push(...checkSpecialCategoryBasis(rod, panelName));

    // W_GDPR_LI_DPIA_RECOMMENDED — Art. 35
    const frameworkCfg = getFrameworkConfig(knots);
    const lawfulBasis = knotValueToString(frameworkCfg?.[GDPR_BASIS_KNOT]);
    if (lawfulBasis === GDPR_BASIS.LEGITIMATE_INTEREST && !frameworkCfg?.[DPIA_REF_KNOT]) {
      diagnostics.push({
        code: PRIVACY_DIAG.LI_DPIA_RECOMMENDED,
        message: `Rod '${rod.name}' in panel '${panelName}': processing under legitimate_interest without dpia_ref (Art. 35). Consider adding dpia_ref.`,
        severity: "warning",
        panel: panelName,
        rod: rod.name,
        line: rod.loc?.line,
      });
    }
  }

  // BDSG §26 — employee_data:true requires employee_category
  if (isBdsg) {
    const frameworkCfg = getFrameworkConfig(knots);
    const employeeData = knotValueToBool(frameworkCfg?.[EMPLOYEE_DATA_KNOT]);
    const hasCategory = !!frameworkCfg?.[EMPLOYEE_CATEGORY_KNOT];
    if (employeeData === true && !hasCategory) {
      diagnostics.push({
        code: PRIVACY_DIAG.BDSG_EMPLOYEE_CATEGORY,
        message: `Rod '${rod.name}' in panel '${panelName}': employee_data:true requires employee_category under BDSG §26.`,
        severity: "error",
        panel: panelName,
        rod: rod.name,
        line: rod.loc?.line,
      });
    }
  }

  return diagnostics;
}

function checkSpecialCategoryBasis(rod: RodNode, panelName: string): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];
  const fields = rod.knots[PRIVATE_DATA_KNOT.CFG_FIELDS];
  if (!fields) return diagnostics;

  const hasSpecialCategory = fieldBatchHasSpecialCategory(fields);
  if (!hasSpecialCategory) return diagnostics;

  const frameworkCfg = getFrameworkConfig(rod.knots);
  const basis = knotValueToString(frameworkCfg?.[GDPR_BASIS_KNOT]);

  if (basis && !SPECIAL_CATEGORY_ALLOWED_BASES.has(basis)) {
    diagnostics.push({
      code: PRIVACY_DIAG.INVALID_BASIS_SPECIAL,
      message: `Rod '${rod.name}' in panel '${panelName}': lawful_basis '${basis}' is not permitted for special category data under Art. 9(2). Use consent, legal_obligation, or vital_interests.`,
      severity: "error",
      panel: panelName,
      rod: rod.name,
      line: rod.loc?.line,
    });
  }

  return diagnostics;
}

// ---------------------------------------------------------------------------
// @privacy bypass check
// ---------------------------------------------------------------------------

function panelHasPrivacyDecorator(panel: PanelNode): boolean {
  // @privacy decorator storage in PanelNode is not yet implemented in the parser (v0.6).
  // When parser support is added, check the relevant field here.
  void panel;
  return false;
}

// ---------------------------------------------------------------------------
// PrivateData<T> flow enforcement
// ---------------------------------------------------------------------------

function checkPrivateDataWrapperFlow(
  panel: PanelNode,
  privateDataRods: RodNode[],
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];
  if (privateDataRods.length > 0) return diagnostics;

  for (const rod of panel.rods) {
    if (rodHasPrivateDataInput(rod)) {
      diagnostics.push({
        code: PRIVACY_DIAG.PRIVATE_DATA_BYPASS,
        message: `Rod '${rod.name}' in panel '${panel.name}' has PrivateData<T> input but no '${ROD_TYPE.PRIVATE_DATA}' rod is present. PrivateData<T> must flow through a private-data rod before reaching any sink.`,
        severity: "error",
        panel: panel.name,
        rod: rod.name,
        line: rod.loc?.line,
      });
    }
  }

  return diagnostics;
}

function rodHasPrivateDataInput(rod: RodNode): boolean {
  for (const knot of Object.values(rod.knots)) {
    if (knotReferencesPrivateData(knot)) return true;
  }
  return false;
}

function knotReferencesPrivateData(kv: KnotValue | undefined): boolean {
  if (!kv) return false;
  if (kv.kind === "path") return kv.segments.some((s) => s === "PrivateData");
  return false;
}

// ---------------------------------------------------------------------------
// Knot field name literals (framework config sub-fields)
// These are spec-defined field names from GdprBaseConfig / BdsgConfig.
// ---------------------------------------------------------------------------

const GDPR_BASIS_KNOT       = "lawful_basis"        as const;
const DPIA_REF_KNOT         = "dpia_ref"             as const;
const EMPLOYEE_DATA_KNOT    = "employee_data"        as const;
const EMPLOYEE_CATEGORY_KNOT = "employee_category"   as const;

// ---------------------------------------------------------------------------
// KnotValue helpers
// ---------------------------------------------------------------------------

function knotHasValue(kv: KnotValue | undefined): boolean {
  if (kv === undefined || kv === null) return false;
  if (kv.kind === "string") return kv.value.trim().length > 0;
  return true;
}

function resolveFrameworkPath(knots: Record<string, KnotValue>): string {
  const fw = knots[PRIVATE_DATA_KNOT.CFG_FRAMEWORK];
  if (!fw) return FRAMEWORK_PATH.GDPR;
  if (fw.kind === "path") return fw.segments.join(".");
  if (fw.kind === "string") return fw.value;
  return FRAMEWORK_PATH.GDPR;
}

function getFrameworkConfig(knots: Record<string, KnotValue>): Record<string, KnotValue> | undefined {
  const fw = knots[PRIVATE_DATA_KNOT.CFG_FRAMEWORK];
  if (!fw) return undefined;
  if (fw.kind === "path" && fw.config) return fw.config;
  return undefined;
}

/** Unwrap a KnotValue to a plain string. */
function knotValueToString(kv: KnotValue | undefined): string | undefined {
  if (!kv) return undefined;
  if (kv.kind === "string") return kv.value;
  if (kv.kind === "path" && kv.segments.length > 0) return kv.segments.join(".");
  return undefined;
}

/** Unwrap a KnotValue bool. */
function knotValueToBool(kv: KnotValue | undefined): boolean | undefined {
  if (!kv) return undefined;
  if (kv.kind === "bool") return kv.value;
  return undefined;
}

function fieldBatchHasSpecialCategory(fields: KnotValue): boolean {
  if (fields.kind !== "block") return false;
  for (const val of Object.values(fields.config)) {
    if (val && typeof val === "object" && val.kind === "block") {
      const sensitivity = knotValueToString(val.config[SENSITIVITY_KNOT]);
      if (
        sensitivity === SENSITIVITY.SPECIAL_CATEGORY ||
        sensitivity === SENSITIVITY.HIGHLY_SENSITIVE
      ) return true;
    }
  }
  return false;
}

const SENSITIVITY_KNOT = "sensitivity" as const;
