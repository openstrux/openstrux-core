import type { Rod } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";

export function emitReadData(_rod: Rod, ctx: ChainContext): ChainStep {
  const modelName = deriveModelName(ctx.inputType);
  return {
    imports: [{ names: ["prisma"], from: "../lib/prisma.js" }],
    statement: `const result = await prisma.${modelName}.findMany();`,
    outputVar: "result",
    outputType: `${modelName.charAt(0).toUpperCase() + modelName.slice(1)}[]`,
  };
}

function deriveModelName(inputType: string): string {
  const base = inputType.endsWith("Input") ? inputType.slice(0, -5) : inputType;
  const clean = base.endsWith("[]") ? base.slice(0, -2) : base;
  return clean.charAt(0).toLowerCase() + clean.slice(1);
}
