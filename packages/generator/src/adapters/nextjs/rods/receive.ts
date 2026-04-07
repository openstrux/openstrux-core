import type { Rod } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";

export function emitReceive(_rod: Rod, ctx: ChainContext): ChainStep {
  const operation = (ctx.panel.access as unknown as { intent?: { operation?: string } } | undefined)
    ?.intent?.operation ?? "";
  const noBody = operation === "read" || operation === "delete";
  return {
    imports: [{ names: ["NextRequest", "NextResponse"], from: "next/server" }],
    statement: noBody ? "const body = {};" : "const body = await req.json();",
    outputVar: "body",
    outputType: "unknown",
  };
}
