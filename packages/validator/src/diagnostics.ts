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
 *
 *   @ops validation (v0.6.0):
 *   E_OPS_UNKNOWN_FIELD   Unrecognized field in @ops decorator block
 *   E_OPS_TYPE_MISMATCH   @ops field value has wrong type (e.g., retry: "five")
 *
 *   validate rod schema ref (v0.6.0):
 *   E_SCHEMA_STRING       validate.schema uses string literal; must be identifier
 *   E_SCHEMA_UNRESOLVED   validate.schema identifier not declared as @type
 *
 *   stream/write-data config (v0.6.0):
 *   E_STREAM_MISSING_FIELD   Required field missing in stream adapter config
 *   E_STREAM_UNKNOWN_ADAPTER Unrecognized stream adapter type
 *
 *   private-data / @privacy validation (v0.6.0):
 *   E_GDPR_PURPOSE_REQUIRED            cfg.purpose missing on private-data rod (Art. 5(1)(b))
 *   E_GDPR_RETENTION_REQUIRED          cfg.retention missing on private-data rod (Art. 5(1)(e))
 *   E_GDPR_INVALID_BASIS_SPECIAL_CATEGORY  Invalid lawful basis for special category data (Art. 9)
 *   W_GDPR_LI_DPIA_RECOMMENDED         legitimate_interest without dpia_ref (Art. 35)
 *   E_PRIVACY_BYPASS                   @privacy panel has no private-data rod
 *   E_PRIVATE_DATA_BYPASS              PrivateData<T> bypasses private-data rod
 *   E_BDSG_EMPLOYEE_CATEGORY           employee_data:true without employee_category (BDSG §26)
 */
export interface ValidationDiagnostic {
  readonly code: DiagnosticCode;
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
  | "W_SCOPE_UNVERIFIED"
  | "E_OPS_UNKNOWN_FIELD"
  | "E_OPS_TYPE_MISMATCH"
  | "E_SCHEMA_STRING"
  | "E_SCHEMA_UNRESOLVED"
  | "E_STREAM_MISSING_FIELD"
  | "E_STREAM_UNKNOWN_ADAPTER"
  // Privacy
  | "E_GDPR_PURPOSE_REQUIRED"
  | "E_GDPR_RETENTION_REQUIRED"
  | "E_GDPR_INVALID_BASIS_SPECIAL_CATEGORY"
  | "W_GDPR_LI_DPIA_RECOMMENDED"
  | "E_PRIVACY_BYPASS"
  | "E_PRIVATE_DATA_BYPASS"
  | "E_BDSG_EMPLOYEE_CATEGORY"
  // Duplicate / unknown declarations
  | "E_DUPLICATE_TYPE"
  | "W_SHADOW_BUILTIN"
  | "W_UNKNOWN_ROD"
  // @ops required subfields
  | "E_OPS_MISSING_FIELD";
