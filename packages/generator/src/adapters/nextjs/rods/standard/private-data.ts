/**
 * Next.js emitter for the `private-data` standard rod.
 *
 * The `private-data` rod is expanded into basic rods (validate → pseudonymize
 * → [encrypt] → guard) during IR lowering (standard-rod-expander.ts). This
 * emitter handles the case where expansion has NOT yet been applied — i.e., when
 * the generator is called with the pre-expansion IR. It emits a single composite
 * step that wires all sub-operations inline.
 *
 * In the normal build pipeline the expander runs first, so the basic rod emitters
 * handle the expanded nodes. This emitter acts as a direct fallback for contexts
 * where expansion is skipped (e.g., early-stage code generation, testing stubs).
 *
 * Spec reference: openstrux-spec/specs/modules/rods/standard/private-data.strux
 *                 openstrux-spec/specs/core/semantics.md §Standard Rod Expansion
 */

import type { Rod } from "@openstrux/ast";
import {
  FRAMEWORK_PATH,
  GDPR_BASIS,
  PRIVATE_DATA_KNOT,
} from "@openstrux/ast";
import type { ChainContext, ChainStep } from "../types.js";

export function emitPrivateData(rod: Rod, ctx: ChainContext): ChainStep {
  const cfg = rod.cfg as Record<string, unknown>;
  const frameworkPath = resolveFrameworkPath(cfg);
  const encryptionRequired = resolveEncryptionRequired(cfg, frameworkPath);
  const purpose = extractLitString(cfg[PRIVATE_DATA_KNOT.CFG_PURPOSE]) ?? "unspecified";
  const lawfulBasis = extractLawfulBasis(cfg) ?? "unset";

  const lastVar = encryptionRequired ? "encrypted" : "pseudonymized";

  const statement = [
    `/**`,
    ` * @standard-rod private-data`,
    ` * @framework ${frameworkPath}`,
    ` * @purpose ${purpose}`,
    ` * @lawful-basis ${lawfulBasis}`,
    ` */`,
    `const validated     = await validate(${ctx.inputVar}, ctx);`,
    `const pseudonymized = await pseudonymize(validated, ctx);`,
    ...(encryptionRequired ? [`const encrypted     = await encrypt(pseudonymized, ctx);`] : []),
    `const privateDataResult = await guard(${lastVar}, ctx);`,
  ].join("\n");

  return {
    imports: [],
    statement,
    outputVar: "privateDataResult",
    outputType: ctx.inputType,
  };
}

// ---------------------------------------------------------------------------
// Helpers (mirrors standard-rod-expander.ts logic for consistency)
// ---------------------------------------------------------------------------

function resolveFrameworkPath(cfg: Record<string, unknown>): string {
  const fw = cfg[PRIVATE_DATA_KNOT.CFG_FRAMEWORK] as Record<string, unknown> | undefined;
  if (!fw) return FRAMEWORK_PATH.GDPR;
  if (fw["kind"] === "TypeRef") {
    const name = fw["name"] as string;
    if (name === FRAMEWORK_PATH.GDPR_BDSG || name === FRAMEWORK_PATH.BDSG) return FRAMEWORK_PATH.GDPR_BDSG;
    return String(name);
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
    return fields.some(
      (f) => f.sensitivity === "special_category" || f.sensitivity === "highly_sensitive"
    );
  }
  return false;
}

function extractLitString(val: unknown): string | undefined {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    const v = val as Record<string, unknown>;
    if (v["kind"] === "LitString") return v["value"] as string;
  }
  return undefined;
}

function extractLawfulBasis(cfg: Record<string, unknown>): string | undefined {
  const fw = cfg[PRIVATE_DATA_KNOT.CFG_FRAMEWORK] as Record<string, unknown> | undefined;
  if (!fw) return GDPR_BASIS.CONSENT; // default
  const inner = (fw["config"] ?? fw) as Record<string, unknown>;
  return String(inner["lawful_basis"] ?? "");
}
