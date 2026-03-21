/**
 * Tier 2 stub — aggregate rod.
 * Emits a STRUX-STUB comment. Not demo-capable; excluded from benchmark claims.
 */

import type { Rod } from "@openstrux/ast";
import type { Panel } from "@openstrux/ast";

export function emitAggregate(rod: Rod, _panel: Panel): string {
  return `// STRUX-STUB: aggregate — ${rod.name} — implement for production use\n`;
}
