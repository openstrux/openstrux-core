import type { ChainContext, ChainStep } from "./types.js";
import type { Rod } from "@openstrux/ast";

export function emitWriteData(_rod: Rod, ctx: ChainContext): ChainStep {
  // Derive model name: strip "Input" suffix from inputType, then lowercase first char
  const modelName = deriveModelName(ctx.inputType);
  return {
    imports: [{ names: ["prisma"], from: "../lib/prisma.js" }],
    statement: `const result = await prisma.${modelName}.create({ data: ${ctx.inputVar} });`,
    outputVar: "result",
    outputType: modelName.charAt(0).toUpperCase() + modelName.slice(1),
  };
}

function deriveModelName(inputType: string): string {
  // "ProposalInput" → "proposal", "unknown" → "unknown"
  const base = inputType.endsWith("Input") ? inputType.slice(0, -5) : inputType;
  return base.charAt(0).toLowerCase() + base.slice(1);
}
