import type { Rod } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";
import { getScopeFields } from "./config-extractors.js";

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
