/**
 * Certification scope extractor.
 *
 * Collects all type paths actually used in the validated AST.
 * The scope reflects what was used, not just what was declared.
 *
 * Examples: "db.sql.postgres", "Proposal", "ReviewStatus"
 *
 * Spec reference: design.md §Certification scope: derived from validated AST
 */

import type { SourceFile } from "@openstrux/ast";
import type { CfgValue } from "@openstrux/ast";

// ---------------------------------------------------------------------------
// NarrowedUnion discriminant
// ---------------------------------------------------------------------------

/** CfgValue is ValueExpr | NarrowedUnion.  All ValueExpr variants have `kind`. */
function isNarrowedUnion(value: CfgValue): value is Extract<CfgValue, { rootType: string }> {
  return !("kind" in value);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract the certification scope from a validated SourceFile.
 *
 * Collects:
 *   1. All TypeDef names (records, enums, unions) declared in the file
 *   2. All NarrowedUnion path strings from rod cfg knots
 *      (e.g. DataSource narrowed to db.sql.postgres → "db.sql.postgres")
 *
 * Returns a deduplicated, sorted array of type path strings.
 */
export function extractScope(sourceFile: SourceFile): readonly string[] {
  const paths = new Set<string>();

  // 1. Type definition names
  for (const type of sourceFile.types) {
    paths.add(type.name);
  }

  // 2. NarrowedUnion paths from rod cfg knots in all panels
  for (const panel of sourceFile.panels) {
    for (const rod of panel.rods) {
      for (const [, value] of Object.entries(rod.cfg)) {
        if (isNarrowedUnion(value)) {
          const pathStr = (value as { path: { segments: readonly string[] } }).path.segments.join(".");
          if (pathStr.length > 0) paths.add(pathStr);
        }
      }
    }
  }

  return Array.from(paths).sort();
}
