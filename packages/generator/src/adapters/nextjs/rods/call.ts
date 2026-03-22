import type { Rod } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";

export function emitCall(rod: Rod, _ctx: ChainContext): ChainStep {
  const endpoint = getCfgString(rod, "endpoint") ?? "TODO: endpoint";
  const method   = getCfgString(rod, "method")   ?? "GET";
  return {
    imports: [],
    statement: `const result = await fetch("${endpoint}", { method: "${method}" }).then(r => r.json());`,
    outputVar: "result",
    outputType: "unknown",
  };
}

function getCfgString(rod: Rod, key: string): string | undefined {
  const val = rod.cfg[key] as unknown as Record<string, unknown> | undefined;
  if (val === undefined) return undefined;
  if (val["kind"] === "LitString" && typeof val["value"] === "string") return val["value"] as string;
  if (typeof val === "string") return val;
  return undefined;
}
