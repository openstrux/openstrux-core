/**
 * Tier 2 stub — group rod.
 * Emits a STRUX-STUB comment. Not demo-capable; excluded from benchmark claims.
 */

import type { Rod } from "@openstrux/ast";
import type { Panel } from "@openstrux/ast";

export function emitGroup(rod: Rod, _panel: Panel): string {
  return `// STRUX-STUB: group — ${rod.name} — implement for production use\n`;
}
