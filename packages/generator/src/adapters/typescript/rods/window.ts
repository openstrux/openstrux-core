/**
 * Tier 2 stub — window rod.
 * Emits a STRUX-STUB comment. Not demo-capable; excluded from benchmark claims.
 */

import type { Rod } from "@openstrux/ast";
import type { Panel } from "@openstrux/ast";

export function emitWindow(rod: Rod, _panel: Panel): string {
  return `// STRUX-STUB: window — ${rod.name} — implement for production use\n`;
}
