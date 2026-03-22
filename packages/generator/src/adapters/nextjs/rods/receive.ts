import type { Rod } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";

export function emitReceive(_rod: Rod, _ctx: ChainContext): ChainStep {
  return {
    imports: [{ names: ["NextRequest", "NextResponse"], from: "next/server" }],
    statement: "const body = await req.json();",
    outputVar: "body",
    outputType: "unknown",
  };
}
