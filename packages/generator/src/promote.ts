/**
 * Promotion step: converts @openstrux/parser `StruxNode[]` (parse-level AST)
 * to `TopLevelNode[]` (IR-level AST) for the generator.
 *
 * This is a best-effort structural promotion for the supported subset.
 * The validator has already checked semantic correctness; we just need
 * to reshape the nodes for the generator adapter.
 */

import type { StruxNode, ParseTypeExpr, KnotValue } from "@openstrux/parser";
import type {
  TypeRecord,
  TypeEnum,
  TypeUnion,
  Panel,
  Rod,
  TypeExpr,
  UnionVariant,
  FieldDecl,
  AccessContext,
} from "@openstrux/ast";
import type { TopLevelNode } from "./types.js";

// ---------------------------------------------------------------------------
// ParseTypeExpr → TypeExpr
// ---------------------------------------------------------------------------

function promoteTypeExpr(pt: ParseTypeExpr): TypeExpr {
  if (pt.kind === "primitive") {
    return { kind: "PrimitiveType", name: pt.name } as TypeExpr;
  }
  if (pt.kind === "named") {
    return { kind: "TypeRef", name: pt.name } as TypeExpr;
  }
  // container
  return {
    kind: "ContainerType",
    container: pt.container,
    typeArgs: pt.args.map(promoteTypeExpr),
  } as TypeExpr;
}

// ---------------------------------------------------------------------------
// KnotValue → suitable value for cfg lookup
// ---------------------------------------------------------------------------

function promoteKnotValue(kv: KnotValue): unknown {
  if (kv.kind === "string")   return { kind: "LitString", value: kv.value };
  if (kv.kind === "number")   return { kind: "LitNumber", value: kv.value };
  if (kv.kind === "bool")     return { kind: "LitBool", value: kv.value };
  if (kv.kind === "duration") return { kind: "LitDuration", value: kv.value, unit: kv.unit };
  if (kv.kind === "path")     return { kind: "TypeRef", name: kv.segments.join("."), segments: kv.segments, config: kv.config ? promoteBlock(kv.config) : undefined };
  if (kv.kind === "raw-expr") return { kind: "RawExpr", text: kv.text };
  // block
  return promoteBlock(kv.config);
}

function promoteBlock(config: Record<string, KnotValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    out[k] = promoteKnotValue(v);
  }
  return out;
}

// ---------------------------------------------------------------------------
// StruxNode → TopLevelNode promotion
// ---------------------------------------------------------------------------

export function promote(ast: StruxNode[]): TopLevelNode[] {
  const result: TopLevelNode[] = [];

  for (const node of ast) {
    if (node.kind === "record") {
      const promoted: TypeRecord = {
        kind: "TypeRecord",
        name: node.name,
        fields: node.fields.map((f): FieldDecl => ({
          name: f.name,
          type: promoteTypeExpr(f.type),
        })),
      };
      result.push(promoted);
      continue;
    }

    if (node.kind === "enum") {
      const promoted: TypeEnum = {
        kind: "TypeEnum",
        name: node.name,
        variants: node.variants,
      };
      result.push(promoted);
      continue;
    }

    if (node.kind === "union") {
      const promoted: TypeUnion = {
        kind: "TypeUnion",
        name: node.name,
        variants: node.variants.map((v): UnionVariant => ({
          tag: v.tag,
          type: promoteTypeExpr(v.type),
        })),
      };
      result.push(promoted);
      continue;
    }

    if (node.kind === "panel") {
      // Build cfg dict from rod knots
      const rods: Rod[] = node.rods.map((rod): Rod => {
        const cfg: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rod.knots)) {
          cfg[k] = promoteKnotValue(v);
        }
        return {
          kind: "Rod",
          name: rod.name,
          rodType: rod.rodType,
          cfg: cfg as Rod["cfg"],
          arg: {} as Rod["arg"],
        };
      });

      // Build minimal AccessContext from @access block
      const rawAccess = node.access as Record<string, unknown> | undefined;
      const intent = rawAccess
        ? {
            purpose: String(rawAccess["purpose"] ?? ""),
            basis: String(rawAccess["basis"] ?? ""),
            operation: String(rawAccess["operation"] ?? "") as "read" | "write" | "delete" | "transform" | "export" | "audit",
            urgency: "routine" as const,
          }
        : undefined;

      const access: AccessContext = {
        kind: "AccessContext",
        intent,
      };

      const promoted: Panel = {
        kind: "Panel",
        name: node.name,
        dp: (node.dp ? promoteBlock(node.dp) : {}) as Panel["dp"],
        access,
        rods,
        snaps: [],
      };
      result.push(promoted);
    }
  }

  return result;
}
