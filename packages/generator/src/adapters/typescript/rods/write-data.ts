/**
 * Tier 1 emitter — write-data rod.
 * Emits a Prisma create/update stub with model name from cfg.target.
 */

import type { Rod } from "@openstrux/ast";
import type { Panel } from "@openstrux/ast";
import type { NarrowedUnion } from "@openstrux/ast";

export function emitWriteData(rod: Rod, _panel: Panel): string {
  const targetHint = getTargetHint(rod);
  return [
    `// write-data: ${rod.name}`,
    `// TODO: implement write — prisma.<model>.create({ data: input })${targetHint}`,
    ``,
  ].join("\n");
}

function getTargetHint(rod: Rod): string {
  const target = rod.cfg["target"];
  if (target === undefined) return "";
  const nu = target as unknown as NarrowedUnion;
  if (nu.path?.segments !== undefined && Array.isArray(nu.path.segments)) {
    return ` — target: ${nu.path.segments.join(".")}`;
  }
  return "";
}
