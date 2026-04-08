/**
 * join rod emitter — combine by key (Stream → Stream).
 *
 * Spec reference: openstrux-spec/specs/modules/rods/overview.md §3 join
 * Modes: inner, left, right, outer, cross, lookup.
 *
 * Lowering:
 *   PortableJoinCond  → Map-based equi-join on matched key pairs
 *   FunctionRef       → import + call
 *   legacy cfg.key    → single-field Map join (backward compat)
 *
 * In a linear chain, join receives one input; the right-side is referenced
 * by cfg.right (the right-side variable name expected in scope).
 */

import type { Rod } from "@openstrux/ast";
import type {
  JoinCondExpr,
  PortableJoinCond,
  KeyMatch,
  FunctionRef,
} from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";
import { getCfgString } from "./config-extractors.js";

export function emitJoin(rod: Rod, ctx: ChainContext): ChainStep {
  const mode     = getCfgString(rod, "mode") ?? "inner";
  const rightVar = getCfgString(rod, "right") ?? "rightData";
  const fnName   = `join${toPascal(rod.name)}`;
  const condArg  = rod.arg["on"] as unknown as JoinCondExpr | undefined;

  // FunctionRef (task 4.9)
  if (condArg?.kind === "FunctionRef") {
    const ref = condArg as FunctionRef;
    return {
      imports: [{ names: [ref.fn], from: ref.module }],
      statement: [
        `const joined = ${ref.fn}(${ctx.inputVar} as unknown[], ${rightVar} as unknown[]);`,
      ].join("\n"),
      outputVar: "joined",
      outputType: "unknown[]",
    };
  }

  // PortableJoinCond (task 4.7)
  if (condArg?.kind === "PortableJoinCond") {
    const pjc = condArg as PortableJoinCond;
    const stmt = buildJoinStmt(fnName, mode, rightVar, ctx.inputVar, pjc.matches);
    return { imports: [], statement: stmt, outputVar: "joined", outputType: "unknown[]" };
  }

  // Legacy fallback: cfg.key string
  const key = getCfgString(rod, "key") ?? "id";
  const matches: KeyMatch[] = [
    { left: { segments: [key] }, right: { segments: [key] } },
  ];
  const stmt = buildJoinStmt(fnName, mode, rightVar, ctx.inputVar, matches);
  return { imports: [], statement: stmt, outputVar: "joined", outputType: "unknown[]" };
}

// ---------------------------------------------------------------------------
// Join statement builder
// ---------------------------------------------------------------------------

function buildJoinStmt(
  fnName: string,
  mode: string,
  rightVar: string,
  inputVar: string,
  matches: readonly KeyMatch[],
): string {
  const leftKey  = keyExtractor("l", matches.map(m => m.left));
  const rightKey = keyExtractor("r", matches.map(m => m.right));

  const lines: string[] = [
    `function ${fnName}(left: unknown[], right: unknown[]): unknown[] {`,
    `  const rightIndex = new Map<string, unknown>();`,
    `  for (const r of right) rightIndex.set(String(${rightKey}), r);`,
  ];

  switch (mode) {
    case "left":
      lines.push(`  return left.map(l => ({ ...l as object, ...(rightIndex.get(String(${leftKey})) as object ?? {}) }));`);
      break;
    case "outer":
      lines.push(`  const leftKeys = new Set(left.map(l => String(${leftKey})));`);
      lines.push(`  const matched = left.map(l => ({ ...l as object, ...(rightIndex.get(String(${leftKey})) as object ?? {}) }));`);
      lines.push(`  const unmatched = right.filter(r => !leftKeys.has(String(${rightKey})));`);
      lines.push(`  return [...matched, ...unmatched];`);
      break;
    case "cross":
      lines.push(`  return left.flatMap(l => right.map(r => ({ ...l as object, ...r as object })));`);
      break;
    default: // inner / lookup / right (right implemented as flipped inner)
      lines.push(`  return left.filter(l => rightIndex.has(String(${leftKey}))).map(l => ({ ...l as object, ...rightIndex.get(String(${leftKey})) as object }));`);
  }

  lines.push(`}`);
  lines.push(`const joined = ${fnName}(${inputVar} as unknown[], ${rightVar} as unknown[]);`);
  return lines.join("\n");
}

/** Produce a key expression for a list of FieldPath segments on a variable. */
function keyExtractor(varName: string, fields: Array<{ segments: readonly string[] }>): string {
  if (fields.length === 1) {
    const path = fields[0]!.segments.map(s => `["${s}"]`).join("");
    return `(${varName} as Record<string, unknown>)${path}`;
  }
  const parts = fields.map(f => {
    const path = f.segments.map(s => `["${s}"]`).join("");
    return `(${varName} as Record<string, unknown>)${path}`;
  });
  return `JSON.stringify([${parts.join(", ")}])`;
}

function toPascal(name: string): string {
  return name.split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join("");
}
