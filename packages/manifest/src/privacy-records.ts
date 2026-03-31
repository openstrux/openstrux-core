/**
 * Privacy records emitter — generates Art. 30 / BDSG §26 manifest entries
 * from `private-data` rod instances in the compiled SourceFile.
 *
 * Spec reference: openstrux-spec/specs/modules/rods/standard/private-data-gdpr.md §Art. 30
 *                 openstrux-spec/specs/modules/rods/standard/private-data-bdsg.md §BDSG extensions
 *                 openstrux-spec/specs/modules/manifest.md §Privacy Records
 *
 * Determinism: field order within each record is fixed (alphabetical within
 * structured fields). Array values are sorted. This guarantees stable output
 * across compilations with the same source and lock file.
 */

import type { SourceFile, Panel, Rod } from "@openstrux/ast";
import {
  ENCRYPTION_FORCING_SENSITIVITIES,
  FRAMEWORK_PATH,
  PRIVATE_DATA_KNOT,
  ROD_TYPE,
} from "@openstrux/ast";
import type { Art30Record, BdsgExtension, PrivacyRecord } from "./types.js";

// ---------------------------------------------------------------------------
// Framework config field name literals (GdprBaseConfig / BdsgConfig spec fields)
// ---------------------------------------------------------------------------

const FW_LAWFUL_BASIS              = "lawful_basis"              as const;
const FW_DATA_SUBJECT_CATEGORIES   = "data_subject_categories"   as const;
const FW_DPIA_REF                  = "dpia_ref"                  as const;
const FW_CROSS_BORDER_TRANSFER     = "cross_border_transfer"     as const;
const FW_EMPLOYEE_DATA             = "employee_data"             as const;
const FW_EMPLOYEE_CATEGORY         = "employee_category"         as const;
const FW_BETRIEBSRAT_CONSENT       = "betriebsrat_consent"       as const;
const FW_MECHANISM                 = "mechanism"                 as const;
const FW_DESTINATION_COUNTRIES     = "destination_countries"     as const;

const FIELD_SENSITIVITY            = "sensitivity"               as const;
const FIELD_CATEGORY               = "category"                  as const;
const FIELD_FIELD                  = "field"                     as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Emit privacy records for all `private-data` rod instances across all panels.
 * Returns undefined when no private-data rods are present (field omitted from manifest).
 */
export function emitPrivacyRecords(sourceFile: SourceFile): readonly PrivacyRecord[] | undefined {
  const records: PrivacyRecord[] = [];

  for (const panel of sourceFile.panels) {
    for (const rod of panel.rods) {
      if (rod.rodType === ROD_TYPE.PRIVATE_DATA) {
        records.push(buildPrivacyRecord(rod, panel));
      }
    }
  }

  return records.length > 0 ? records : undefined;
}

// ---------------------------------------------------------------------------
// Record builder
// ---------------------------------------------------------------------------

function buildPrivacyRecord(rod: Rod, panel: Panel): PrivacyRecord {
  const cfg = rod.cfg as Record<string, unknown>;
  const frameworkPath = resolveFrameworkPath(cfg);
  const frameworkCfg = resolveFrameworkConfig(cfg);

  const article30 = buildArt30Record(rod, panel, cfg, frameworkCfg);
  const bdsg = (frameworkPath === FRAMEWORK_PATH.GDPR_BDSG || frameworkPath === FRAMEWORK_PATH.BDSG)
    ? buildBdsgExtension(frameworkCfg)
    : undefined;

  return {
    rodName: rod.name,
    framework: frameworkPath,
    article30,
    ...(bdsg !== undefined ? { bdsg } : {}),
  };
}

function buildArt30Record(
  _rod: Rod,
  panel: Panel,
  cfg: Record<string, unknown>,
  frameworkCfg: Record<string, unknown>,
): Art30Record {
  const dp = panel.dp as Record<string, unknown>;

  const { personalDataCategories, specialCategories } = deriveFieldCategories(cfg);
  const recipients = deriveSinkTargets(panel).sort();
  const technicalMeasures = deriveTechnicalMeasures(cfg, frameworkCfg);
  const retention = retentionToString(cfg[PRIVATE_DATA_KNOT.CFG_RETENTION]);

  return {
    controller:              String(dp["controller"] ?? ""),
    ...(dp["controllerId"]   ? { controllerId: String(dp["controllerId"]) }   : {}),
    ...(dp["dpo"]            ? { dpo: String(dp["dpo"]) }                     : {}),
    ...(dp["record"]         ? { dpRecord: String(dp["record"]) }             : {}),
    purpose:                 String(extractLitString(cfg[PRIVATE_DATA_KNOT.CFG_PURPOSE]) ?? ""),
    lawfulBasis:             String(frameworkCfg[FW_LAWFUL_BASIS] ?? ""),
    dataSubjectCategories:   toStringArray(frameworkCfg[FW_DATA_SUBJECT_CATEGORIES]).sort(),
    personalDataCategories,
    specialCategories,
    recipients,
    retention,
    technicalMeasures,
    dpiaRef:                 (frameworkCfg[FW_DPIA_REF] as string | null) ?? null,
    crossBorderTransfer:     buildCrossBorderTransfer(frameworkCfg),
  };
}

function buildBdsgExtension(frameworkCfg: Record<string, unknown>): BdsgExtension {
  return {
    bdsgSection26: frameworkCfg[FW_EMPLOYEE_DATA] === true,
    ...(frameworkCfg[FW_EMPLOYEE_CATEGORY]
      ? { employeeCategory: String(frameworkCfg[FW_EMPLOYEE_CATEGORY]) }
      : {}),
    ...(frameworkCfg[FW_BETRIEBSRAT_CONSENT]
      ? { betriebsratConsent: String(frameworkCfg[FW_BETRIEBSRAT_CONSENT]) }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Derivation helpers
// ---------------------------------------------------------------------------

function deriveFieldCategories(cfg: Record<string, unknown>): {
  personalDataCategories: readonly string[];
  specialCategories: readonly string[];
} {
  const fields = cfg[PRIVATE_DATA_KNOT.CFG_FIELDS];
  if (!Array.isArray(fields)) {
    return { personalDataCategories: [], specialCategories: [] };
  }

  const categories = new Set<string>();
  const special = new Set<string>();

  for (const f of fields) {
    const field = f as Record<string, unknown>;
    const category = String(field[FIELD_CATEGORY] ?? "");
    if (category) categories.add(category);
    const sensitivity = String(field[FIELD_SENSITIVITY] ?? "");
    if (ENCRYPTION_FORCING_SENSITIVITIES.has(sensitivity)) {
      special.add(String(field[FIELD_FIELD] ?? category));
    }
  }

  return {
    personalDataCategories: [...categories].sort(),
    specialCategories: [...special].sort(),
  };
}

function deriveSinkTargets(panel: Panel): string[] {
  const sinks: string[] = [];
  for (const rod of panel.rods) {
    if (rod.rodType === ROD_TYPE.WRITE_DATA || rod.rodType === ROD_TYPE.RESPOND) {
      const cfg = rod.cfg as Record<string, unknown>;
      const target = cfg["target"];
      if (target) sinks.push(extractLitString(target) ?? rod.name);
    }
  }
  return sinks;
}

function deriveTechnicalMeasures(
  cfg: Record<string, unknown>,
  frameworkCfg: Record<string, unknown>,
): readonly string[] {
  const measures = ["pseudonymization"];
  const isBdsg = frameworkCfg[FW_EMPLOYEE_DATA] !== undefined;
  const encryptionRequired = isBdsg || extractLitBool(cfg[PRIVATE_DATA_KNOT.CFG_ENCRYPTION_REQUIRED]) === true;
  if (encryptionRequired) measures.push("encryption");
  return measures.sort();
}

function buildCrossBorderTransfer(
  frameworkCfg: Record<string, unknown>,
): Art30Record["crossBorderTransfer"] {
  const cbt = frameworkCfg[FW_CROSS_BORDER_TRANSFER] as Record<string, unknown> | undefined;
  if (!cbt) return null;
  return {
    mechanism: String(cbt[FW_MECHANISM] ?? ""),
    destinationCountries: toStringArray(cbt[FW_DESTINATION_COUNTRIES]).sort(),
  };
}

// ---------------------------------------------------------------------------
// Config resolution
// ---------------------------------------------------------------------------

function resolveFrameworkPath(cfg: Record<string, unknown>): string {
  const fw = cfg[PRIVATE_DATA_KNOT.CFG_FRAMEWORK] as Record<string, unknown> | undefined;
  if (!fw) return FRAMEWORK_PATH.GDPR;
  if (fw["kind"] === "TypeRef") {
    const name = fw["name"] as string;
    if (name === FRAMEWORK_PATH.GDPR_BDSG || name === FRAMEWORK_PATH.BDSG) return FRAMEWORK_PATH.GDPR_BDSG;
    if (name === FRAMEWORK_PATH.GDPR) return FRAMEWORK_PATH.GDPR;
    return name;
  }
  return FRAMEWORK_PATH.GDPR;
}

function resolveFrameworkConfig(cfg: Record<string, unknown>): Record<string, unknown> {
  const fw = cfg[PRIVATE_DATA_KNOT.CFG_FRAMEWORK] as Record<string, unknown> | undefined;
  if (!fw) return {};
  return (fw["config"] as Record<string, unknown> | undefined) ?? fw;
}

// ---------------------------------------------------------------------------
// Value unwrappers
// ---------------------------------------------------------------------------

function extractLitString(val: unknown): string | undefined {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    const v = val as Record<string, unknown>;
    if (v["kind"] === "LitString") return v["value"] as string;
    if (v["kind"] === "TypeRef") return v["name"] as string;
  }
  return undefined;
}

function extractLitBool(val: unknown): boolean | undefined {
  if (typeof val === "boolean") return val;
  if (val && typeof val === "object") {
    const v = val as Record<string, unknown>;
    if (v["kind"] === "LitBool") return v["value"] as boolean;
  }
  return undefined;
}

function toStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") return [val];
  return [];
}

function retentionToString(retention: unknown): string {
  if (!retention) return "";
  const r = retention as Record<string, unknown>;
  const duration = extractLitString(r["duration"]) ?? String(r["duration"] ?? "");
  const basis = String(r["basis"] ?? "");
  return basis ? `${duration} (${basis})` : duration;
}
