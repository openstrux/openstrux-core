import type { Rod } from "@openstrux/ast";
import type { AccessContext } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";

export function emitPseudonymize(_rod: Rod, ctx: ChainContext): ChainStep {
  const fields = getScopeFields(ctx.panel);
  const fieldsDoc = fields.length > 0 ? fields.join(", ") : "TODO: specify fields";
  return {
    imports: [],
    statement: [
      `/**`,
      ` * @compliance pseudonymize`,
      ` * @access scope.fieldMask: ${fieldsDoc}`,
      ` */`,
      `const result = await pseudonymize(${ctx.inputVar}, ctx);`,
    ].join("\n"),
    outputVar: "result",
    outputType: ctx.inputType,
  };
}

function getScopeFields(panel: unknown): string[] {
  const access = (panel as { access?: AccessContext }).access;
  const fieldMask = access?.scope?.fieldMask;
  if (Array.isArray(fieldMask)) return [...fieldMask];
  return [];
}
