import type { ChainContext, ChainStep } from "./types.js";
import type { Rod } from "@openstrux/ast";
import { deriveModelName } from "./config-extractors.js";

export function emitWriteData(_rod: Rod, ctx: ChainContext): ChainStep {
  const modelName = deriveModelName(ctx.inputType);
  return {
    imports: [{ names: ["prisma"], from: "../lib/prisma.js" }],
    statement: `const result = await prisma.${modelName}.create({ data: ${ctx.inputVar} });`,
    outputVar: "result",
    outputType: modelName.charAt(0).toUpperCase() + modelName.slice(1),
  };
}
