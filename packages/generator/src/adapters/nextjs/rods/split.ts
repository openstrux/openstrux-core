/**
 * split rod emitter — route-based branching (Stream → Stream).
 *
 * Spec reference: openstrux-spec/specs/modules/rods/overview.md §3 split
 *
 * Lowering:
 *   SplitRoutesExpr with predicates → chained if/else on filter predicates
 *   SplitRoutesExpr without predicates → stub per route
 *   no routes arg → stub
 */

import type { Rod } from "@openstrux/ast";
import type { SplitRoutesExpr, RouteEntry } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";
import { lowerFilter, isPortableFilter } from "./expression-lowerer.js";

export function emitSplit(rod: Rod, ctx: ChainContext): ChainStep {
  const routesArg = rod.arg["routes"] as unknown as Record<string, unknown> | undefined;

  if (routesArg === undefined || routesArg["kind"] !== "SplitRoutesExpr") {
    return {
      imports: [],
      statement: `// STRUX-STUB: split — ${rod.name} — no routes defined`,
      outputVar: ctx.inputVar,
      outputType: ctx.inputType,
    };
  }

  const expr = routesArg as unknown as SplitRoutesExpr;
  const stmt = buildSplitStmt(expr.routes, ctx.inputVar);

  return {
    imports: [],
    statement: stmt,
    outputVar: ctx.inputVar,
    outputType: ctx.inputType,
  };
}

// ---------------------------------------------------------------------------
// Split statement builder (task 4.8)
// ---------------------------------------------------------------------------

function buildSplitStmt(routes: readonly RouteEntry[], inputVar: string): string {
  const hasPredicates = routes.some(r => r.predicate !== null);

  if (!hasPredicates) {
    // No predicates — emit stub switch on route name
    const cases = routes
      .map(r => [
        `  case "${r.name}":`,
        `    // STRUX-STUB: split branch — ${r.name}`,
        `    break;`,
      ].join("\n"))
      .join("\n");
    return `switch ((${inputVar} as { kind?: string }).kind) {\n${cases}\n}`;
  }

  // Routes have predicates — emit chained if/else with filter lowering
  // Output: an object mapping route name → filtered array
  const lines: string[] = [
    `const _input = ${inputVar} as unknown[];`,
    `const splitResult: Record<string, unknown[]> = {};`,
  ];

  // Track items already routed (so each item goes to first matching route)
  lines.push(`const _routed = new Set<number>();`);

  for (const route of routes) {
    if (route.predicate === null) {
      // Default route (*): collects anything not yet routed
      lines.push(`splitResult[${JSON.stringify(route.name)}] = _input.filter((_, i) => !_routed.has(i));`);
    } else if (isPortableFilter(route.predicate)) {
      const pred = lowerFilter(route.predicate, { rootVar: "item" });
      lines.push(
        `splitResult[${JSON.stringify(route.name)}] = _input.filter((item, i) => {`,
        `  if (_routed.has(i)) return false;`,
        `  const match = ${pred};`,
        `  if (match) _routed.add(i);`,
        `  return match;`,
        `});`,
      );
    } else {
      // Non-portable predicate — stub
      lines.push(`splitResult[${JSON.stringify(route.name)}] = []; // STRUX-STUB: non-portable predicate`);
    }
  }

  lines.push(`const splitOutput = splitResult;`);
  return lines.join("\n");
}
