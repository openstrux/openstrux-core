/**
 * ValidationDiagnostic — semantic diagnostics from the validator.
 *
 * Codes:
 *   V001  Unresolved type reference
 *   V002  Rod knot type mismatch (snap chain break)
 *   V003  Scope field not declared on referenced type
 *   V004  Snap chain break (disconnected rod)
 *   W002  Missing @access block (warning in v0.6.0, error in v0.7.0)
 *   W003  Non-PascalCase type name
 *   E_CERT_IN_CONTEXT   @cert found in strux.context file
 *   E_CERT_HASH_MISMATCH  @cert hash does not match compiled output
 *   W_CERT_SCOPE_UNCOVERED  Panel uses type path not covered by @cert scope
 *   W_POLICY_OPAQUE     Guard references external or unreachable hub policy
 *   W_SCOPE_UNVERIFIED  Scope fields in policy cannot be statically confirmed
 */
export interface ValidationDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly line?: number | undefined;
  readonly col?: number | undefined;
  /** The panel name this diagnostic is associated with, if applicable. */
  readonly panel?: string | undefined;
  /** The rod name this diagnostic is associated with, if applicable. */
  readonly rod?: string | undefined;
}

export type DiagnosticCode =
  | "V001"
  | "V002"
  | "V003"
  | "V004"
  | "W002"
  | "W003"
  | "E_CERT_IN_CONTEXT"
  | "E_CERT_HASH_MISMATCH"
  | "W_CERT_SCOPE_UNCOVERED"
  | "W_POLICY_OPAQUE"
  | "W_SCOPE_UNVERIFIED";
