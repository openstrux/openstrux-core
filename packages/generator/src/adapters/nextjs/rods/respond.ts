import type { Rod } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";

export function emitRespond(_rod: Rod, ctx: ChainContext): ChainStep {
  return {
    imports: [],
    statement: `return NextResponse.json(${ctx.inputVar}, { status: 201 });`,
    outputVar: "(returned)",
    outputType: "NextResponse",
  };
}
