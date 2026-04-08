/**
 * Main validator orchestrator.
 * Takes a ParseResult and runs all validation phases.
 */
import type { ParseResult, PanelNode } from "@openstrux/parser";
import type { ValidationDiagnostic } from "./diagnostics.js";
import { SymbolTable } from "./symbol-table.js";
import { resolveTypeReferences } from "./type-resolver.js";
import { checkSnapChain } from "./snap-checker.js";
import { enforceAccessContext } from "./access-enforcer.js";
import { validateScope } from "./scope-validator.js";
import { validateCert } from "./cert-validator.js";
import type { CertValidationOptions } from "./cert-validator.js";
import { resolveGuardPolicies } from "./policy-resolver.js";
import { checkTypeNames } from "./type-name-checker.js";
import { validateOpsBlocks } from "./ops-schema.js";
import { validateSchemaRefs } from "./schema-ref-validator.js";
import { validateStreamConfigs } from "./stream-validator.js";
import { validatePrivacy } from "./privacy-validator.js";
import { validateAnnotations } from "./annotation-validator.js";

export interface ValidateOptions extends CertValidationOptions {}

export interface ValidateResult {
  readonly diagnostics: ValidationDiagnostic[];
}

/**
 * Validate a parsed .strux file.
 *
 * @param parseResult - Output from @openstrux/parser `parse()`
 * @param options - Optional validation options
 * @returns ValidateResult with all semantic diagnostics
 */
export function validate(
  parseResult: ParseResult,
  options: ValidateOptions = {},
): ValidateResult {
  const { ast } = parseResult;
  const diagnostics: ValidationDiagnostic[] = [];

  // Phase 1: Collect all type declarations into symbol table
  const symbolTable = new SymbolTable();
  diagnostics.push(...symbolTable.populate(ast));

  // Phase 1b: Annotation semantic checks (E_DUPLICATE_PK, E_EXTERNAL_PK, E_RELATION_*, etc.)
  diagnostics.push(...validateAnnotations(ast, symbolTable));

  // W003: Non-PascalCase type names
  diagnostics.push(...checkTypeNames(ast));

  // Extract panels for phase-2 checks
  const panels: PanelNode[] = ast.filter(
    (n): n is PanelNode => n.kind === "panel",
  );

  // V001: Unresolved type references
  diagnostics.push(...resolveTypeReferences(panels, symbolTable));

  // V002: Snap chain compatibility
  diagnostics.push(...checkSnapChain(panels));

  // W002: Missing @access block
  diagnostics.push(...enforceAccessContext(panels));

  // V003: Scope field validation
  diagnostics.push(...validateScope(panels, symbolTable));

  // E_CERT_HASH_MISMATCH, W_CERT_SCOPE_UNCOVERED
  diagnostics.push(...validateCert(panels, options));

  // W_POLICY_OPAQUE, W_SCOPE_UNVERIFIED
  diagnostics.push(...resolveGuardPolicies(panels));

  // E_OPS_UNKNOWN_FIELD, E_OPS_TYPE_MISMATCH — rod-level @ops field validation
  diagnostics.push(...validateOpsBlocks(panels));

  // E_SCHEMA_STRING, E_SCHEMA_UNRESOLVED — validate rod schema ref resolution
  diagnostics.push(...validateSchemaRefs(panels, symbolTable));

  // E_STREAM_MISSING_FIELD, E_STREAM_UNKNOWN_ADAPTER — stream target config validation
  diagnostics.push(...validateStreamConfigs(panels));

  // E_GDPR_PURPOSE_REQUIRED, E_GDPR_RETENTION_REQUIRED, E_PRIVACY_BYPASS, etc.
  diagnostics.push(...validatePrivacy(panels));

  return { diagnostics };
}
