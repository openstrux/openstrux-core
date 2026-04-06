import type { Rod } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";
import { getCfgString } from "./config-extractors.js";

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
