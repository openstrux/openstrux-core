import type { Rod } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";

export function emitGuard(_rod: Rod, ctx: ChainContext): ChainStep {
  const panelName = (ctx.panel as { name?: string }).name ?? "unknown";
  const pascal = panelName.split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join("");
  return {
    imports: [{ names: ["withGuard"], from: `../guards/${panelName}.guard.js` }],
    statement: `// guard: see guards/${panelName}.guard.ts`,
    outputVar: ctx.inputVar,
    outputType: `${pascal}AccessContext`,
  };
}
