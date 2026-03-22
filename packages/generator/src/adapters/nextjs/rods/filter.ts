import type { Rod } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";

export function emitFilter(_rod: Rod, ctx: ChainContext): ChainStep {
  return {
    imports: [],
    statement: `const result = (${ctx.inputVar} as unknown[]).filter((item) => item);`,
    outputVar: "result",
    outputType: "unknown[]",
  };
}
