import type { Rod } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";
import { deriveModelName } from "./config-extractors.js";

export function emitReadData(_rod: Rod, ctx: ChainContext): ChainStep {
  const modelName = deriveModelName(ctx.inputType);
  return {
    imports: [{ names: ["prisma"], from: "../lib/prisma.js" }],
    statement: `const result = await prisma.${modelName}.findMany();`,
    outputVar: "result",
    outputType: `${modelName.charAt(0).toUpperCase() + modelName.slice(1)}[]`,
  };
}
