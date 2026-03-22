/**
 * TypeScript type-expression mappers — shared across all TS-targeting adapters.
 *
 * Spec reference: openstrux-spec/specs/modules/target-nextjs/generator.md §4
 */

import type { TypeExpr } from "@openstrux/ast";

export function tsType(expr: TypeExpr): string {
  switch (expr.kind) {
    case "PrimitiveType": {
      switch (expr.name) {
        case "string": return "string";
        case "number": return "number";
        case "bool":   return "boolean";
        case "date":   return "Date";
        case "bytes":  return "Buffer";
        default:       return expr.name;
      }
    }
    case "ContainerType": {
      const inner = tsType(expr.typeArgs[0] ?? ({ kind: "PrimitiveType", name: "unknown" } as TypeExpr));
      switch (expr.container) {
        case "Optional": return `${inner} | null`;
        case "Batch":    return `${inner}[]`;
        case "Stream":   return `AsyncIterable<${inner}>`;
        case "Single":   return inner;
        case "Map":      return `Record<string, ${inner}>`;
        default:         return `${expr.container}<${inner}>`;
      }
    }
    case "ConstrainedNumberType": return "number";
    case "ConstrainedStringType": return expr.values.map(v => JSON.stringify(v)).join(" | ");
    case "TypeRef":               return expr.name;
    default:                      return "unknown";
  }
}

export function prismaType(expr: TypeExpr, _enumNames: Set<string>): string {
  switch (expr.kind) {
    case "PrimitiveType": {
      switch (expr.name) {
        case "string": return "String";
        case "number": return "Float";
        case "bool":   return "Boolean";
        case "date":   return "DateTime";
        case "bytes":  return "Bytes";
        default:       return "String";
      }
    }
    case "ContainerType": {
      const inner = prismaType(
        expr.typeArgs[0] ?? ({ kind: "PrimitiveType", name: "string" } as TypeExpr),
        _enumNames
      );
      switch (expr.container) {
        case "Optional": return `${inner}?`;
        case "Batch":    return `${inner}[]`;
        case "Map":      return "Json";
        default:         return inner;
      }
    }
    case "ConstrainedNumberType": return "Float";
    case "ConstrainedStringType": return "String";
    case "TypeRef":               return expr.name;
    default:                      return "String";
  }
}

export function zodType(expr: TypeExpr, enumNames: Set<string>): string {
  switch (expr.kind) {
    case "PrimitiveType": {
      switch (expr.name) {
        case "string": return "z.string()";
        case "number": return "z.number()";
        case "bool":   return "z.boolean()";
        case "date":   return "z.coerce.date()";
        case "bytes":  return "z.instanceof(Buffer)";
        default:       return "z.unknown()";
      }
    }
    case "ContainerType": {
      const inner = zodType(
        expr.typeArgs[0] ?? ({ kind: "PrimitiveType", name: "string" } as TypeExpr),
        enumNames
      );
      switch (expr.container) {
        case "Optional": return `${inner}.nullable()`;
        case "Batch":    return `${inner}.array()`;
        default:         return inner;
      }
    }
    case "ConstrainedNumberType": return `z.number().min(${expr.min}).max(${expr.max})`;
    case "ConstrainedStringType": return `z.enum([${expr.values.map(v => JSON.stringify(v)).join(", ")}])`;
    case "TypeRef":
      if (enumNames.has(expr.name)) return `z.nativeEnum(${expr.name})`;
      return `z.lazy(() => ${expr.name}Schema)`;
    default: return "z.unknown()";
  }
}

export function collectTypeRefs(expr: TypeExpr): string[] {
  if (expr.kind === "TypeRef") return [expr.name];
  if (expr.kind === "ContainerType") return expr.typeArgs.flatMap(collectTypeRefs);
  return [];
}
