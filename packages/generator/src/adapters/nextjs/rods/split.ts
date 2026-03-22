import type { Rod } from "@openstrux/ast";
import type { SplitRoutesExpr } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";

export function emitSplit(rod: Rod, ctx: ChainContext): ChainStep {
  const routes = getRouteNames(rod);
  const cases = routes.map(r => [
    `  case "${r}":`,
    `    // STRUX-STUB: split branch — ${r}`,
    `    break;`,
  ].join("\n")).join("\n");

  const stmt = routes.length > 0
    ? `switch ((${ctx.inputVar} as { kind?: string }).kind) {\n${cases}\n}`
    : `// STRUX-STUB: split — ${rod.name} — no routes defined`;

  return {
    imports: [],
    statement: stmt,
    outputVar: ctx.inputVar,
    outputType: ctx.inputType,
  };
}

function getRouteNames(rod: Rod): string[] {
  const routesArg = rod.arg["routes"] as unknown as Record<string, unknown> | undefined;
  if (routesArg === undefined) return [];
  if (routesArg["kind"] === "SplitRoutesExpr") {
    const expr = routesArg as unknown as SplitRoutesExpr;
    return expr.routes.map(r => r.name);
  }
  return [];
}
