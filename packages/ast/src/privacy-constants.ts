/**
 * Compile-time constants for privacy types, rod identifiers, and framework values.
 *
 * Use these instead of raw string literals in all privacy-related implementation
 * files (validator, expander, manifest emitter, rod emitter).
 *
 * Spec reference: openstrux-spec/specs/modules/privacy-framework.strux
 *                 openstrux-spec/specs/modules/rods/standard/private-data.strux
 */

// ---------------------------------------------------------------------------
// Rod type identifiers
// ---------------------------------------------------------------------------

export const ROD_TYPE = {
  PRIVATE_DATA:   "private-data",
  VALIDATE:       "validate",
  PSEUDONYMIZE:   "pseudonymize",
  ENCRYPT:        "encrypt",
  GUARD:          "guard",
  WRITE_DATA:     "write-data",
  RESPOND:        "respond",
  RECEIVE:        "receive",
} as const;

export type RodTypeKey = typeof ROD_TYPE[keyof typeof ROD_TYPE];

// ---------------------------------------------------------------------------
// Privacy framework type names
// ---------------------------------------------------------------------------

export const PRIVACY_TYPE = {
  PRIVACY_FRAMEWORK:     "PrivacyFramework",
  GDPR_FRAMEWORK:        "GdprFramework",
  GDPR_BASE_CONFIG:      "GdprBaseConfig",
  GDPR_BASIS:            "GdprBasis",
  BDSG_CONFIG:           "BdsgConfig",
  EMPLOYEE_CATEGORY:     "EmployeeCategory",
  CROSS_BORDER_TRANSFER: "CrossBorderTransfer",
  TRANSFER_MECHANISM:    "TransferMechanism",
  FIELD_CLASSIFICATION:  "FieldClassification",
  DATA_CATEGORY:         "DataCategory",
  SENSITIVITY:           "Sensitivity",
  RETENTION_POLICY:      "RetentionPolicy",
  RETENTION_BASIS:       "RetentionBasis",
  PRIVATE_DATA:          "PrivateData",
  PROCESSING_METADATA:   "ProcessingMetadata",
  PRIVACY_AUDIT_RECORD:  "PrivacyAuditRecord",
} as const;

// Standard personal data model type names
export const STANDARD_DATA_TYPE = {
  PERSON_NAME:       "PersonName",
  PERSONAL_CONTACT:  "PersonalContact",
  POSTAL_ADDRESS:    "PostalAddress",
  USER_IDENTITY:     "UserIdentity",
  EMPLOYEE_RECORD:   "EmployeeRecord",
  FINANCIAL_ACCOUNT: "FinancialAccount",
} as const;

// ---------------------------------------------------------------------------
// Framework path identifiers (type-path resolved values)
// ---------------------------------------------------------------------------

export const FRAMEWORK_PATH = {
  GDPR:      "gdpr",
  GDPR_BDSG: "gdpr.bdsg",
  BDSG:      "bdsg",           // shorthand alias — resolves to gdpr.bdsg
  CCPA:      "ccpa",           // reserved, not normative in v0.6
  LGPD:      "lgpd",           // reserved, not normative in v0.6
} as const;

export type FrameworkPath = typeof FRAMEWORK_PATH[keyof typeof FRAMEWORK_PATH];

// ---------------------------------------------------------------------------
// GDPR lawful basis values (GdprBasis enum)
// ---------------------------------------------------------------------------

export const GDPR_BASIS = {
  CONSENT:              "consent",
  CONTRACT:             "contract",
  LEGAL_OBLIGATION:     "legal_obligation",
  VITAL_INTERESTS:      "vital_interests",
  PUBLIC_TASK:          "public_task",
  LEGITIMATE_INTEREST:  "legitimate_interest",
} as const;

export type GdprBasisValue = typeof GDPR_BASIS[keyof typeof GDPR_BASIS];

/** Lawful bases permitted for special category / highly-sensitive data (Art. 9(2)). */
export const SPECIAL_CATEGORY_ALLOWED_BASES = new Set<string>([
  GDPR_BASIS.CONSENT,
  GDPR_BASIS.LEGAL_OBLIGATION,
  GDPR_BASIS.VITAL_INTERESTS,
]);

// ---------------------------------------------------------------------------
// Field sensitivity values (Sensitivity enum)
// ---------------------------------------------------------------------------

export const SENSITIVITY = {
  STANDARD:          "standard",
  SPECIAL_CATEGORY:  "special_category",
  HIGHLY_SENSITIVE:  "highly_sensitive",
} as const;

export type SensitivityValue = typeof SENSITIVITY[keyof typeof SENSITIVITY];

/** Sensitivity levels that force encryption and restrict lawful basis. */
export const ENCRYPTION_FORCING_SENSITIVITIES = new Set<string>([
  SENSITIVITY.SPECIAL_CATEGORY,
  SENSITIVITY.HIGHLY_SENSITIVE,
]);

// ---------------------------------------------------------------------------
// Pseudonymization algorithm identifiers
// ---------------------------------------------------------------------------

export const PSEUDO_ALGO = {
  SHA256:      "sha256",
  SHA256_HMAC: "sha256_hmac",  // keyed — required for BDSG
} as const;

export type PseudoAlgo = typeof PSEUDO_ALGO[keyof typeof PSEUDO_ALGO];

// ---------------------------------------------------------------------------
// Knot names for the private-data rod
// ---------------------------------------------------------------------------

export const PRIVATE_DATA_KNOT = {
  CFG_FRAMEWORK:           "framework",
  CFG_FIELDS:              "fields",
  CFG_PURPOSE:             "purpose",
  CFG_RETENTION:           "retention",
  CFG_ENCRYPTION_REQUIRED: "encryption_required",
  ARG_PREDICATE:           "predicate",
  IN_DATA:                 "data",
  OUT_PROTECTED:           "protected",
  OUT_AUDIT:               "audit",
  ERR_DENIED:              "denied",
  ERR_INVALID:             "invalid",
  ERR_POLICY_VIOLATION:    "policy_violation",
} as const;

// ---------------------------------------------------------------------------
// Expansion sub-rod name suffixes
// ---------------------------------------------------------------------------

export const EXPANSION_SUFFIX = {
  VALIDATE:     ".__validate",
  PSEUDONYMIZE: ".__pseudonymize",
  ENCRYPT:      ".__encrypt",
  GUARD:        ".__guard",
} as const;

// ---------------------------------------------------------------------------
// Manifest field names for privacy records
// ---------------------------------------------------------------------------

export const MANIFEST_PRIVACY = {
  PRIVACY_RECORDS:       "privacyRecords",
  FRAMEWORK:             "framework",
  ARTICLE_30:            "article30",
  BDSG:                  "bdsg",
} as const;

// ---------------------------------------------------------------------------
// Diagnostic codes — privacy validation (validator package uses these)
// ---------------------------------------------------------------------------

export const PRIVACY_DIAG = {
  // Errors
  PURPOSE_REQUIRED:            "E_GDPR_PURPOSE_REQUIRED",
  RETENTION_REQUIRED:          "E_GDPR_RETENTION_REQUIRED",
  INVALID_BASIS_SPECIAL:       "E_GDPR_INVALID_BASIS_SPECIAL_CATEGORY",
  PRIVACY_BYPASS:              "E_PRIVACY_BYPASS",
  PRIVATE_DATA_BYPASS:         "E_PRIVATE_DATA_BYPASS",
  BDSG_EMPLOYEE_CATEGORY:      "E_BDSG_EMPLOYEE_CATEGORY",
  // Warnings
  LI_DPIA_RECOMMENDED:         "W_GDPR_LI_DPIA_RECOMMENDED",
} as const;

export type PrivacyDiagCode = typeof PRIVACY_DIAG[keyof typeof PRIVACY_DIAG];
