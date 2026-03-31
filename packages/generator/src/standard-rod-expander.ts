/**
 * Standard rod IR expander — replaces standard rod nodes with basic rod sub-graphs.
 *
 * Called during IR lowering, after promotion and before target generation.
 * Currently implements expansion for the `private-data` standard rod.
 *
 * Spec reference: openstrux-spec/specs/core/semantics.md §Standard Rod Expansion
 *                 openstrux-spec/specs/modules/rods/standard/private-data.strux
 */

import { createHash } from "crypto";
import type { Panel, Rod, SnapEdge } from "@openstrux/ast";
import {
  ENCRYPTION_FORCING_SENSITIVITIES,
  EXPANSION_SUFFIX,
  FRAMEWORK_PATH,
  PRIVATE_DATA_KNOT,
  PSEUDO_ALGO,
  ROD_TYPE,
} from "@openstrux/ast";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Expand all standard rod nodes in a Panel into basic rod sub-graphs.
 * Returns a new Panel with standard rods replaced by their expansions.
 * If the panel contains no standard rods, returns the original panel unchanged.
 */
export function expandStandardRods(panel: Panel): Panel {
  const hasStandard = panel.rods.some(isStandardRod);
  if (!hasStandard) return panel;

  const expandedRods: Rod[] = [];
  const expansionSnaps: SnapEdge[] = [];

  for (const rod of panel.rods) {
    if (rod.rodType === ROD_TYPE.PRIVATE_DATA) {
      const { rods, snaps } = expandPrivateDataRod(rod);
      expandedRods.push(...rods);
      expansionSnaps.push(...snaps);
    } else {
      expandedRods.push(rod);
    }
  }

  return {
    ...panel,
    rods: expandedRods,
    snaps: [...panel.snaps, ...expansionSnaps],
  };
}

// ---------------------------------------------------------------------------
// private-data expansion
// ---------------------------------------------------------------------------

interface ExpansionResult {
  rods: Rod[];
  snaps: SnapEdge[];
}

/**
 * Expand a `private-data` rod into: validate → pseudonymize → [encrypt] → guard.
 * Spec: semantics.md §Expansion rules for `private-data`
 */
function expandPrivateDataRod(rod: Rod): ExpansionResult {
  const prefix = rod.name;
  const cfg = rod.cfg as Record<string, unknown>;

  const frameworkPath = resolveFrameworkPath(cfg);
  const encryptionRequired = resolveEncryptionRequired(cfg, frameworkPath);
  const pseudoAlgo = frameworkPath === FRAMEWORK_PATH.GDPR_BDSG
    ? PSEUDO_ALGO.SHA256_HMAC
    : PSEUDO_ALGO.SHA256;

  const validateName     = `${prefix}${EXPANSION_SUFFIX.VALIDATE}`;
  const pseudonymizeName = `${prefix}${EXPANSION_SUFFIX.PSEUDONYMIZE}`;
  const encryptName      = `${prefix}${EXPANSION_SUFFIX.ENCRYPT}`;
  const guardName        = `${prefix}${EXPANSION_SUFFIX.GUARD}`;

  const expansionHash = computeExpansionHash(rod);

  const rods: Rod[] = [];

  // 1. validate rod
  rods.push({
    kind: "Rod",
    name: validateName,
    rodType: ROD_TYPE.VALIDATE,
    cfg: {
      schema: cfg[PRIVATE_DATA_KNOT.CFG_FIELDS] ?? { kind: "LitNull" },
      _expandedFrom:  { kind: "LitString", value: rod.name },
      _expansionHash: { kind: "LitString", value: expansionHash },
    } as Rod["cfg"],
    arg: {},
  });

  // 2. pseudonymize rod
  const pseudonymizeCfg: Record<string, unknown> = {
    algo: { kind: "LitString", value: pseudoAlgo },
    _expandedFrom: { kind: "LitString", value: rod.name },
  };
  if (frameworkPath === FRAMEWORK_PATH.GDPR_BDSG) {
    const bdsgCfg = cfg[PRIVATE_DATA_KNOT.CFG_FRAMEWORK] as Record<string, unknown> | undefined;
    if (bdsgCfg?.["key_ref"]) pseudonymizeCfg["key_ref"] = bdsgCfg["key_ref"];
  }
  rods.push({
    kind: "Rod",
    name: pseudonymizeName,
    rodType: ROD_TYPE.PSEUDONYMIZE,
    cfg: pseudonymizeCfg as Rod["cfg"],
    arg: {},
  });

  // 3. encrypt rod (conditional)
  if (encryptionRequired) {
    rods.push({
      kind: "Rod",
      name: encryptName,
      rodType: ROD_TYPE.ENCRYPT,
      cfg: { _expandedFrom: { kind: "LitString", value: rod.name } } as Rod["cfg"],
      arg: {},
    });
  }

  // 4. guard rod — lawful basis check
  const frameworkCfg = cfg[PRIVATE_DATA_KNOT.CFG_FRAMEWORK] as Record<string, unknown> | undefined;
  const lawfulBasis = frameworkCfg?.["lawful_basis"] ?? "unset";
  rods.push({
    kind: "Rod",
    name: guardName,
    rodType: ROD_TYPE.GUARD,
    cfg: {
      policy: { kind: "LitString", value: `privacy:${frameworkPath}:${String(lawfulBasis)}` },
      _expandedFrom: { kind: "LitString", value: rod.name },
    } as Rod["cfg"],
    arg: {},
  });

  // Snap edges — linear chain through the sub-graph
  const snaps: SnapEdge[] = [];
  snaps.push({
    from: { rod: validateName,     dir: "out", knot: "valid"     },
    to:   { rod: pseudonymizeName, dir: "in",  knot: PRIVATE_DATA_KNOT.IN_DATA },
  });
  if (encryptionRequired) {
    snaps.push({
      from: { rod: pseudonymizeName, dir: "out", knot: PRIVATE_DATA_KNOT.OUT_PROTECTED },
      to:   { rod: encryptName,      dir: "in",  knot: PRIVATE_DATA_KNOT.IN_DATA },
    });
    snaps.push({
      from: { rod: encryptName, dir: "out", knot: "encrypted" },
      to:   { rod: guardName,   dir: "in",  knot: PRIVATE_DATA_KNOT.IN_DATA },
    });
  } else {
    snaps.push({
      from: { rod: pseudonymizeName, dir: "out", knot: PRIVATE_DATA_KNOT.OUT_PROTECTED },
      to:   { rod: guardName,        dir: "in",  knot: PRIVATE_DATA_KNOT.IN_DATA },
    });
  }

  return { rods, snaps };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isStandardRod(rod: Rod): boolean {
  return rod.rodType === ROD_TYPE.PRIVATE_DATA;
}

function resolveFrameworkPath(cfg: Record<string, unknown>): string {
  const framework = cfg[PRIVATE_DATA_KNOT.CFG_FRAMEWORK] as Record<string, unknown> | undefined;
  if (!framework) return FRAMEWORK_PATH.GDPR;
  const path = (framework["_path"] as string) ??
    (framework["kind"] === "TypeRef" ? (framework["name"] as string) : FRAMEWORK_PATH.GDPR);
  if (path === FRAMEWORK_PATH.GDPR_BDSG || path === FRAMEWORK_PATH.BDSG) {
    return FRAMEWORK_PATH.GDPR_BDSG;
  }
  return FRAMEWORK_PATH.GDPR;
}

function resolveEncryptionRequired(cfg: Record<string, unknown>, frameworkPath: string): boolean {
  if (frameworkPath === FRAMEWORK_PATH.GDPR_BDSG) return true;

  const explicit = cfg[PRIVATE_DATA_KNOT.CFG_ENCRYPTION_REQUIRED];
  if (explicit !== undefined) {
    const val = (explicit as { value?: unknown })?.value;
    if (val === true) return true;
    if (val === false) return false;
  }

  const fields = cfg[PRIVATE_DATA_KNOT.CFG_FIELDS] as Array<{ sensitivity?: string }> | undefined;
  if (Array.isArray(fields)) {
    return fields.some((f) => ENCRYPTION_FORCING_SENSITIVITIES.has(f.sensitivity ?? ""));
  }

  return false;
}

/**
 * Compute a stable expansion hash for the lock file.
 * sha256(rod_type + sorted cfg pairs) — spec: semantics.md §Determinism requirement
 */
function computeExpansionHash(rod: Rod): string {
  const cfg = rod.cfg as Record<string, unknown>;
  const sortedCfg = Object.keys(cfg)
    .sort()
    .map((k) => `${k}=${JSON.stringify(cfg[k])}`)
    .join(";");
  return createHash("sha256")
    .update(`${rod.rodType};${sortedCfg}`)
    .digest("hex")
    .slice(0, 16);
}
