/**
 * Tier 1 emitter — split rod.
 * Emits a switch block with one case per named route.
 */

import type { Rod } from "@openstrux/ast";
import type { Panel } from "@openstrux/ast";
import type { SplitRoutesExpr } from "@openstrux/ast";

export function emitSplit(rod: Rod, _panel: Panel): string {
  const routes = getRouteNames(rod);
  const cases = routes.length > 0
    ? routes.map(r => [
        `  case "${r}":`,
        `    // TODO: handle ${r}`,
        `    break;`,
      ].join("\n")).join("\n")
    : `  // TODO: add route cases`;
  return [
    `// split: ${rod.name}`,
    `switch (/* TODO: ${rod.name} route key */ undefined) {`,
    cases,
    `}`,
    ``,
  ].join("\n");
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
