/**
 * Annotation validator — semantic checks for field-level and block-level
 * persistence annotations on @type records.
 *
 * Spec reference: openstrux-spec/specs/core/type-system.md §7 (v0.6)
 *
 * Error codes:
 *   E_DUPLICATE_PK            — more than one @pk on a record
 *   E_PK_ON_UNION             — @pk on a field in a union type (not applicable here — union
 *                               variants don't have annotations, but guard anyway)
 *   E_EXTERNAL_PK             — @pk on a field in an @external type
 *   E_TIMESTAMPS_DUPLICATE    — @timestamps + explicit createdAt or updatedAt declaration
 *   E_UNRESOLVED_RELATION_REF — @relation ref.model not in symbol table
 *   E_MISSING_RELATION_FIELD  — @relation field not a field name on the owning type
 *   E_UPDATEDAT_TYPE_MISMATCH — @updatedAt on a non-date field
 *   W_EXTERNAL_RELATION       — owned type has @relation to an @external type
 */

import type { RecordNode, StruxNode } from "@openstrux/parser";
import type { ValidationDiagnostic } from "./diagnostics.js";
import type { SymbolTable } from "./symbol-table.js";

/** Set of @external type names derived from the AST. */
function collectExternalTypes(ast: readonly StruxNode[]): Set<string> {
  const externals = new Set<string>();
  for (const node of ast) {
    if (node.kind === "record" && node.external === true) {
      externals.add(node.name);
    }
  }
  return externals;
}

export function validateAnnotations(
  ast: readonly StruxNode[],
  symbolTable: SymbolTable,
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];
  const externalTypes = collectExternalTypes(ast);

  for (const node of ast) {
    if (node.kind === "record") {
      diagnostics.push(...validateRecord(node, symbolTable, externalTypes));
    }
  }

  return diagnostics;
}

function validateRecord(
  node: RecordNode,
  symbolTable: SymbolTable,
  externalTypes: Set<string>,
): ValidationDiagnostic[] {
  const diags: ValidationDiagnostic[] = [];
  const fieldNames = new Set(node.fields.map(f => f.name));

  // E_TIMESTAMPS_DUPLICATE — if @timestamps and createdAt/updatedAt explicitly declared
  if (node.timestamps === true) {
    for (const reserved of ["createdAt", "updatedAt"]) {
      if (fieldNames.has(reserved)) {
        diags.push({
          code: "E_TIMESTAMPS_DUPLICATE",
          message: `@timestamps is present on type '${node.name}' but '${reserved}' is also declared explicitly — remove the explicit declaration`,
          severity: "error",
          line: node.loc?.line,
          col: node.loc?.col,
        });
      }
    }
  }

  let pkCount = 0;

  for (const field of node.fields) {
    for (const ann of field.annotations ?? []) {
      switch (ann.kind) {
        case "pk": {
          pkCount++;
          // E_EXTERNAL_PK
          if (node.external === true) {
            diags.push({
              code: "E_EXTERNAL_PK",
              message: `@pk on field '${field.name}' in @external type '${node.name}' — external types must not carry ownership annotations`,
              severity: "error",
              line: node.loc?.line,
              col: node.loc?.col,
            });
          }
          // E_DUPLICATE_PK checked after loop
          break;
        }

        case "relation": {
          // E_UNRESOLVED_RELATION_REF
          if (ann.ref.model !== "" && !symbolTable.has(ann.ref.model)) {
            diags.push({
              code: "E_UNRESOLVED_RELATION_REF",
              message: `@relation on field '${field.name}' of '${node.name}' references unknown type '${ann.ref.model}'`,
              severity: "error",
              line: node.loc?.line,
              col: node.loc?.col,
            });
          }

          // E_MISSING_RELATION_FIELD
          if (ann.field !== "" && !fieldNames.has(ann.field)) {
            diags.push({
              code: "E_MISSING_RELATION_FIELD",
              message: `@relation field '${ann.field}' on field '${field.name}' of '${node.name}' does not exist on this type`,
              severity: "error",
              line: node.loc?.line,
              col: node.loc?.col,
            });
          }

          // W_EXTERNAL_RELATION — owned type pointing to external type
          if (node.external !== true && ann.ref.model !== "" && externalTypes.has(ann.ref.model)) {
            diags.push({
              code: "W_EXTERNAL_RELATION",
              message: `@relation on field '${field.name}' of '${node.name}' references @external type '${ann.ref.model}' — the Prisma schema will have an orphaned relation; ensure the external model exists in the DB`,
              severity: "warning",
              line: node.loc?.line,
              col: node.loc?.col,
            });
          }
          break;
        }

        case "updatedAt": {
          // E_UPDATEDAT_TYPE_MISMATCH — @updatedAt only valid on date fields
          const type = field.type;
          const isDate =
            (type.kind === "primitive" && type.name === "date") ||
            (type.kind === "named" && type.name === "date");
          if (!isDate) {
            diags.push({
              code: "E_UPDATEDAT_TYPE_MISMATCH",
              message: `@updatedAt on field '${field.name}' of '${node.name}' requires a date type, got '${fieldTypeName(field.type)}'`,
              severity: "error",
              line: node.loc?.line,
              col: node.loc?.col,
            });
          }
          break;
        }
      }
    }
  }

  // E_DUPLICATE_PK — only one @pk allowed per record
  if (pkCount > 1) {
    diags.push({
      code: "E_DUPLICATE_PK",
      message: `Type '${node.name}' has ${String(pkCount)} @pk annotations — only one primary key is allowed`,
      severity: "error",
      line: node.loc?.line,
      col: node.loc?.col,
    });
  }

  return diags;
}

function fieldTypeName(type: RecordNode["fields"][number]["type"]): string {
  switch (type.kind) {
    case "primitive":
    case "named":
      return type.name;
    case "container":
      return `${type.container}<...>`;
    case "constrained-string":
      return "string[...]";
    case "constrained-number":
      return "number[...]";
  }
}
