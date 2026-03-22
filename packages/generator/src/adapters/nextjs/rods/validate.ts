import type { Rod } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";

export function emitValidate(rod: Rod, ctx: ChainContext): ChainStep {
  const typeName = getSchemaTypeName(rod);
  if (typeName === null) {
    return {
      imports: [],
      statement: `// STRUX-STUB: validate — ${rod.name} — schema type unresolved`,
      outputVar: ctx.inputVar,
      outputType: ctx.inputType,
    };
  }
  return {
    imports: [
      { names: [`${typeName}Schema`], from: `../schemas/${typeName}.schema.js` },
    ],
    statement: `const input = ${typeName}Schema.parse(${ctx.inputVar});`,
    outputVar: "input",
    outputType: `${typeName}Input`,
  };
}

function getSchemaTypeName(rod: Rod): string | null {
  const schemaCfg = rod.cfg["schema"] as unknown as Record<string, unknown> | undefined;
  if (schemaCfg === undefined) return null;
  if (schemaCfg["kind"] === "TypeRef" && typeof schemaCfg["name"] === "string") {
    return schemaCfg["name"] as string;
  }
  return null;
}
