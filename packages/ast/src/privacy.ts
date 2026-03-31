/**
 * Privacy type definitions for the `private-data` standard rod.
 *
 * Spec reference: openstrux-spec/specs/modules/privacy-framework.strux
 *                 openstrux-spec/specs/core/type-system.md §Privacy Types
 *                 openstrux-spec/specs/modules/rods/standard/private-data.strux
 */

// ---------------------------------------------------------------------------
// FieldClassification — unit of privacy tagging (spec: type-system.md §8.3)
// ---------------------------------------------------------------------------

export type DataCategory =
  | "identifying"
  | "quasi_identifying"
  | "sensitive_special"
  | "financial"
  | "health"
  | "biometric"
  | "genetic"
  | "political"
  | "religious"
  | "trade_union"
  | "sexual_orientation"
  | "criminal";

export type Sensitivity = "standard" | "special_category" | "highly_sensitive";

export interface FieldClassification {
  readonly field: string;
  readonly category: DataCategory;
  readonly sensitivity: Sensitivity;
}

// ---------------------------------------------------------------------------
// RetentionPolicy — data storage limitation config (spec: type-system.md §8.1)
// ---------------------------------------------------------------------------

export type RetentionBasis =
  | "legal_obligation"
  | "contract"
  | "consent"
  | "legitimate_interest"
  | "vital_interests"
  | "public_task";

export interface RetentionPolicy {
  readonly duration: string;         // e.g., "P2Y" (ISO 8601 duration)
  readonly basis: RetentionBasis;
  readonly review_date?: string | undefined;
}

// ---------------------------------------------------------------------------
// PrivacyFramework union tree (spec: privacy-framework.strux)
// ---------------------------------------------------------------------------

export type GdprBasis =
  | "consent"
  | "contract"
  | "legal_obligation"
  | "vital_interests"
  | "public_task"
  | "legitimate_interest";

export type TransferMechanism =
  | "adequacy_decision"
  | "standard_contractual_clauses"
  | "binding_corporate_rules"
  | "explicit_consent";

export interface CrossBorderTransfer {
  readonly mechanism: TransferMechanism;
  readonly destination_countries: readonly string[];
}

export interface GdprBaseConfig {
  readonly lawful_basis: GdprBasis;
  readonly data_subject_categories: readonly string[];
  readonly dpia_ref?: string | undefined;
  readonly cross_border_transfer?: CrossBorderTransfer | undefined;
}

export type EmployeeCategory =
  | "applicant"
  | "employee"
  | "former_employee"
  | "contractor"
  | "trainee";

export interface BdsgConfig extends GdprBaseConfig {
  readonly employee_data: boolean;
  readonly betriebsrat_consent?: string | undefined;
  readonly employee_category?: EmployeeCategory | undefined;
}

/** Resolved PrivacyFramework config — narrowed from type path. */
export type PrivacyFrameworkConfig = GdprBaseConfig | BdsgConfig;

/** Type path identifier for the resolved framework. */
export type PrivacyFrameworkPath = "gdpr" | "gdpr.bdsg";

export interface ResolvedPrivacyFramework {
  readonly path: PrivacyFrameworkPath;
  readonly config: PrivacyFrameworkConfig;
}

// ---------------------------------------------------------------------------
// PrivateData<T> — generic wrapper type (spec: type-system.md §8.7)
// ---------------------------------------------------------------------------

export interface ProcessingMetadata {
  readonly purpose: string;
  readonly basis?: string | undefined;
  readonly retention?: RetentionPolicy | undefined;
  readonly consent_ref?: string | undefined;
}

/**
 * Compile-time marker that a data flow carries personal data.
 * The compiler enforces that PrivateData<T> must pass through a
 * `private-data` rod before reaching any sink.
 */
export interface PrivateDataWrapper {
  /** Resolved inner type name (T). */
  readonly innerType: string;
  readonly classification: readonly FieldClassification[];
  readonly processing: ProcessingMetadata;
}

// ---------------------------------------------------------------------------
// PrivacyAuditRecord — auxiliary output type of private-data rod
// ---------------------------------------------------------------------------

export interface PrivacyAuditRecord {
  readonly rod_id: string;
  readonly framework: string;
  readonly purpose: string;
  readonly pseudonymized: readonly string[];
  readonly encrypted: readonly string[];
  readonly lawful_basis: string;
  readonly expansion_hash: string;
  readonly ts: string;
}
