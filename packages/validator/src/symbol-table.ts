/**
 * SymbolTable — Phase 1 pass collecting all @type declarations.
 * Populated from RecordNode, EnumNode, UnionNode in the parse AST.
 */
import type { RecordNode, EnumNode, UnionNode, StruxNode } from "@openstrux/parser";
import type { ValidationDiagnostic } from "./diagnostics.js";

export type TypeKind = "record" | "enum" | "union";

export interface TypeEntry {
  readonly name: string;
  readonly kind: TypeKind;
  readonly fields: readonly string[]; // field names for records; variant names for enums/unions
  readonly line?: number | undefined;
  readonly col?: number | undefined;
}

// ---------------------------------------------------------------------------
// Built-in standard type entries (spec: specs/modules/types/standard/personal-data/)
// Pre-populated so panel authors can reference them without re-declaring.
// ---------------------------------------------------------------------------

const BUILTIN_TYPES: TypeEntry[] = [
  // Privacy framework types
  { name: "PrivacyFramework",    kind: "union",  fields: ["gdpr", "ccpa", "lgpd"] },
  { name: "GdprFramework",       kind: "union",  fields: ["base", "bdsg", "lopdgdd"] },
  { name: "GdprBaseConfig",      kind: "record", fields: ["lawful_basis", "data_subject_categories", "dpia_ref", "cross_border_transfer"] },
  { name: "GdprBasis",           kind: "enum",   fields: ["consent", "contract", "legal_obligation", "vital_interests", "public_task", "legitimate_interest"] },
  { name: "CrossBorderTransfer", kind: "record", fields: ["mechanism", "destination_countries"] },
  { name: "TransferMechanism",   kind: "enum",   fields: ["adequacy_decision", "standard_contractual_clauses", "binding_corporate_rules", "explicit_consent"] },
  { name: "BdsgConfig",          kind: "record", fields: ["lawful_basis", "data_subject_categories", "dpia_ref", "cross_border_transfer", "employee_data", "betriebsrat_consent", "employee_category"] },
  { name: "EmployeeCategory",    kind: "enum",   fields: ["applicant", "employee", "former_employee", "contractor", "trainee"] },
  // Field classification types
  { name: "FieldClassification", kind: "record", fields: ["field", "category", "sensitivity"] },
  { name: "DataCategory",        kind: "enum",   fields: ["identifying", "quasi_identifying", "sensitive_special", "financial", "health", "biometric", "genetic", "political", "religious", "trade_union", "sexual_orientation", "criminal"] },
  { name: "Sensitivity",         kind: "enum",   fields: ["standard", "special_category", "highly_sensitive"] },
  // Retention
  { name: "RetentionPolicy",     kind: "record", fields: ["duration", "basis", "review_date"] },
  { name: "RetentionBasis",      kind: "enum",   fields: ["legal_obligation", "contract", "consent", "legitimate_interest", "vital_interests", "public_task"] },
  // PrivateData<T> wrapper
  { name: "PrivateData",         kind: "record", fields: ["data", "classification", "processing"] },
  { name: "ProcessingMetadata",  kind: "record", fields: ["purpose", "basis", "retention", "consent_ref"] },
  { name: "PrivacyAuditRecord",  kind: "record", fields: ["rod_id", "framework", "purpose", "pseudonymized", "encrypted", "lawful_basis", "expansion_hash", "ts"] },
  // Standard personal data models (spec: specs/modules/types/standard/personal-data/)
  { name: "PersonName",          kind: "record", fields: ["given_name", "family_name", "middle_name", "prefix", "suffix"] },
  { name: "PersonalContact",     kind: "record", fields: ["email", "phone", "mobile", "preferred_channel"] },
  { name: "PostalAddress",       kind: "record", fields: ["street", "city", "state", "postal_code", "country"] },
  { name: "UserIdentity",        kind: "record", fields: ["name", "contact", "date_of_birth", "national_id"] },
  { name: "EmployeeRecord",      kind: "record", fields: ["identity", "employee_id", "department", "position", "hire_date", "salary", "manager_id"] },
  { name: "FinancialAccount",    kind: "record", fields: ["iban", "bic", "account_holder", "bank_name"] },
];

export class SymbolTable {
  private readonly table: Map<string, TypeEntry> = new Map();

  constructor() {
    // Pre-populate with built-in standard types
    for (const entry of BUILTIN_TYPES) {
      this.table.set(entry.name, entry);
    }
  }

  /**
   * Populate the symbol table from a parse AST.
   * Phase 1: collect all @type declarations.
   * Returns diagnostics for duplicate or shadowing declarations.
   */
  populate(ast: readonly StruxNode[]): ValidationDiagnostic[] {
    const diagnostics: ValidationDiagnostic[] = [];
    for (const node of ast) {
      if (node.kind === "record") {
        diagnostics.push(...this.addRecord(node));
      } else if (node.kind === "enum") {
        diagnostics.push(...this.addEnum(node));
      } else if (node.kind === "union") {
        diagnostics.push(...this.addUnion(node));
      }
    }
    return diagnostics;
  }

  private addRecord(node: RecordNode): ValidationDiagnostic[] {
    return this.setEntry(node.name, {
      name: node.name,
      kind: "record",
      fields: node.fields.map((f) => f.name),
      line: node.loc?.line,
      col: node.loc?.col,
    });
  }

  private addEnum(node: EnumNode): ValidationDiagnostic[] {
    return this.setEntry(node.name, {
      name: node.name,
      kind: "enum",
      fields: node.variants,
      line: node.loc?.line,
      col: node.loc?.col,
    });
  }

  private addUnion(node: UnionNode): ValidationDiagnostic[] {
    return this.setEntry(node.name, {
      name: node.name,
      kind: "union",
      fields: node.variants.map((v) => v.tag),
      line: node.loc?.line,
      col: node.loc?.col,
    });
  }

  private setEntry(name: string, entry: TypeEntry): ValidationDiagnostic[] {
    const existing = this.table.get(name);
    if (existing !== undefined) {
      if (existing.line === undefined) {
        // Shadowing a built-in type — warn but allow override
        this.table.set(name, entry);
        return [{
          code: "W_SHADOW_BUILTIN",
          message: `Type '${name}' shadows a built-in standard type`,
          severity: "warning",
          line: entry.line,
          col: entry.col,
        }];
      } else {
        // Duplicate user-defined type — error, keep first
        return [{
          code: "E_DUPLICATE_TYPE",
          message: `Duplicate type declaration '${name}' (first declared at line ${String(existing.line)})`,
          severity: "error",
          line: entry.line,
          col: entry.col,
        }];
      }
    }
    this.table.set(name, entry);
    return [];
  }

  /** Look up a type by name. Returns undefined if not found. */
  lookup(name: string): TypeEntry | undefined {
    return this.table.get(name);
  }

  /** Check if a type name is defined. */
  has(name: string): boolean {
    return this.table.has(name);
  }

  /** All type names. */
  names(): IterableIterator<string> {
    return this.table.keys();
  }
}
