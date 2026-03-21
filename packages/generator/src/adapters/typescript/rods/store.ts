/**
 * Tier 1 emitter — store rod.
 * Emits a Prisma create stub comment.
 */

import type { Rod } from "@openstrux/ast";
import type { Panel } from "@openstrux/ast";

export function emitStore(rod: Rod, _panel: Panel): string {
  return [
    `// store: ${rod.name}`,
    `// TODO: implement store — prisma.<model>.create({ data: ... })`,
    ``,
  ].join("\n");
}
