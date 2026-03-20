/**
 * @openstrux/validator — public API
 *
 * Semantic validator for OpenStrux .strux source files.
 * Takes a ParseResult (from @openstrux/parser) and emits ValidationDiagnostic[].
 */
export { validate } from "./validator.js";
export type { ValidateOptions, ValidateResult } from "./validator.js";
export type { ValidationDiagnostic, DiagnosticCode } from "./diagnostics.js";
export { SymbolTable } from "./symbol-table.js";
export type { TypeEntry, TypeKind } from "./symbol-table.js";
export {
  ROD_SIGNATURES,
  getRodSignature,
  areContainerKindsCompatible,
} from "./rod-signatures.js";
export type { RodSignature, ContainerKind } from "./rod-signatures.js";
export { classifyPolicyTier } from "./policy-resolver.js";
export type { PolicyTier } from "./policy-resolver.js";
