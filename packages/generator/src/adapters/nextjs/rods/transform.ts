import type { Rod } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";

export function emitTransform(rod: Rod, ctx: ChainContext): ChainStep {
  const inType  = getCfgTypeName(rod, "in")  ?? ctx.inputType;
  const outType = getCfgTypeName(rod, "out") ?? "unknown";
  const fnName  = `transform${toPascal(rod.name)}`;
  return {
    imports: [],
    // The stub helper function is injected as a preamble by the chain composer
    statement: `const result = ${fnName}(${ctx.inputVar} as ${inType});`,
    outputVar: "result",
    outputType: outType,
    // Extra field used by chain composer to emit a preamble function
    ...({ _helperFn: buildHelperFn(fnName, inType, outType, rod.name) } as object),
  };
}

export function getTransformHelper(step: ChainStep): string | undefined {
  return (step as ChainStep & { _helperFn?: string })._helperFn;
}

function buildHelperFn(fnName: string, inType: string, outType: string, rodName: string): string {
  return [
    `function ${fnName}(input: ${inType}): ${outType} {`,
    `  // STRUX-STUB: transform — ${rodName} — expression not lowered`,
    `  throw new Error("not implemented");`,
    `}`,
  ].join("\n");
}

function getCfgTypeName(rod: Rod, key: string): string | undefined {
  const val = rod.cfg[key] as unknown as Record<string, unknown> | undefined;
  if (val === undefined) return undefined;
  if (val["kind"] === "TypeRef" && typeof val["name"] === "string") return val["name"] as string;
  if (typeof val["resolvedType"] === "string") return val["resolvedType"] as string;
  return undefined;
}

function toPascal(name: string): string {
  return name.split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join("");
}
