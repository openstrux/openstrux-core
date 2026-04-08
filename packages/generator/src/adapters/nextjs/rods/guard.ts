/**
 * guard rod emitter — access control policy check.
 *
 * Spec reference: openstrux-spec/specs/modules/rods/overview.md §3 guard
 *
 * Lowering:
 *   PortableFilter (guard policy) → inline guardPolicy_name(ctx) helper fn
 *   ExternalPolicyRef             → stub (OPA/Cedar not lowered in v0.6.0)
 *   FunctionRef                   → import + call
 *   no policy arg                 → pass-through (no guard)
 *
 * Guard context convention: the access context object is expected at
 * `(req as any)._accessCtx` — set by upstream middleware. The generated
 * policy function takes `ctx: Record<string, unknown>` so field paths like
 * `principal.role` become `ctx.principal.role`.
 */

import type { Rod } from "@openstrux/ast";
import type { GuardPolicyExpr, FunctionRef } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";
import { lowerFilter, isPortableFilter, sourceSpecificStub } from "./expression-lowerer.js";

export function emitGuard(rod: Rod, ctx: ChainContext): ChainStep {
  const policyArg = rod.arg["policy"] as unknown as GuardPolicyExpr | undefined;
  const panelName = (ctx.panel as { name?: string }).name ?? "unknown";
  const fnName    = `guardPolicy${toPascal(panelName)}`;

  if (policyArg === undefined) {
    // No policy — pass-through (guard rod present but no expression)
    return {
      imports: [],
      statement: `// guard: no policy expression — all requests allowed`,
      outputVar: ctx.inputVar,
      outputType: ctx.inputType,
    };
  }

  // FunctionRef (task 4.9)
  if (policyArg.kind === "FunctionRef") {
    const ref = policyArg as FunctionRef;
    return {
      imports: [{ names: [ref.fn], from: ref.module }],
      statement: [
        `const _guardCtx = (req as unknown as Record<string, unknown>)["_accessCtx"] as Record<string, unknown> ?? {};`,
        `if (!${ref.fn}(_guardCtx)) {`,
        `  return NextResponse.json({ error: "Forbidden" }, { status: 403 });`,
        `}`,
      ].join("\n"),
      outputVar: ctx.inputVar,
      outputType: ctx.inputType,
    };
  }

  // ExternalPolicyRef (OPA, Cedar — deferred post-v0.6.0) (task 4.10)
  if (policyArg.kind === "ExternalPolicyRef") {
    const ref = policyArg as { kind: string; engine: string; ref: string };
    return {
      imports: [],
      statement: [
        `// Source-specific (${ref.engine}): ${ref.ref}`,
        `throw new Error("source-specific expression — manual implementation required");`,
      ].join("\n"),
      outputVar: ctx.inputVar,
      outputType: ctx.inputType,
    };
  }

  // Portable filter (task 4.4): lower the policy expression
  if (isPortableFilter(policyArg)) {
    // Guard context: principal.*, intent.*, element.*, scope.* are top-level
    // fields on the access context object. rootVar "ctx" makes them accessible
    // as ctx.principal.role, ctx.scope.fieldMask, etc.
    const predicate = lowerFilter(policyArg, { rootVar: "ctx" });
    const helperFn = [
      `function ${fnName}(ctx: Record<string, unknown>): boolean {`,
      `  return ${predicate};`,
      `}`,
    ].join("\n");

    return {
      imports: [],
      statement: [
        `const _guardCtx = (req as unknown as Record<string, unknown>)["_accessCtx"] as Record<string, unknown> ?? {};`,
        `if (!${fnName}(_guardCtx)) {`,
        `  return NextResponse.json({ error: "Forbidden" }, { status: 403 });`,
        `}`,
      ].join("\n"),
      outputVar: ctx.inputVar,
      outputType: ctx.inputType,
      ...({ _helperFn: helperFn } as object),
    };
  }

  // Fallback stub
  return {
    imports: [],
    statement: [
      `// STRUX-STUB: guard — ${rod.name} — unrecognised policy kind`,
      `// ${sourceSpecificStub("unknown", String((policyArg as { kind?: string }).kind ?? ""))}`,
    ].join("\n"),
    outputVar: ctx.inputVar,
    outputType: ctx.inputType,
  };
}

export function getGuardHelper(step: ChainStep): string | undefined {
  return (step as ChainStep & { _helperFn?: string })._helperFn;
}

function toPascal(name: string): string {
  return name.split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join("");
}
