import type { Rod } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";

const OPERATION_STATUS: Readonly<Record<string, number>> = {
  read:   200,
  write:  201,
  delete: 204,
};

export function emitRespond(_rod: Rod, ctx: ChainContext): ChainStep {
  const operation = (ctx.panel.access as unknown as { intent?: { operation?: string } } | undefined)
    ?.intent?.operation ?? "";
  const status = OPERATION_STATUS[operation] ?? 200;
  return {
    imports: [],
    statement: `return NextResponse.json(${ctx.inputVar}, { status: ${status} });`,
    outputVar: "(returned)",
    outputType: "NextResponse",
  };
}
