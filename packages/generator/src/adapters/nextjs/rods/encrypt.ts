import type { Rod } from "@openstrux/ast";
import type { ChainContext, ChainStep } from "./types.js";
import { getScopeFields } from "./config-extractors.js";

export function emitEncrypt(_rod: Rod, ctx: ChainContext): ChainStep {
  const fields = getScopeFields(ctx.panel);
  const fieldsDoc = fields.length > 0 ? fields.join(", ") : "TODO: specify fields";
  return {
    imports: [],
    statement: [
      `/**`,
      ` * @compliance encrypt`,
      ` * @access scope.fieldMask: ${fieldsDoc}`,
      ` */`,
      `const result = await encrypt(${ctx.inputVar}, ctx);`,
    ].join("\n"),
    outputVar: "result",
    outputType: ctx.inputType,
  };
}
