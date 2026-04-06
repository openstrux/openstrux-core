/**
 * store rod emitter — state management get/put/delete (Single → Single).
 *
 * Spec reference: openstrux-spec/specs/modules/rods/overview.md §4 store
 * Modes: get, put, delete, cas, increment.
 * Backends: redis, dynamodb, memory, rocksdb.
 */

import type { Rod } from "@openstrux/ast";
import type { ChainContext, ChainStep, ImportDecl } from "./types.js";
import { getCfgString } from "./config-extractors.js";

export function emitStore(rod: Rod, ctx: ChainContext): ChainStep {
  const mode = getCfgString(rod, "mode") ?? "get";
  const backend = getCfgString(rod, "backend") ?? "memory";
  const namespace = getCfgString(rod, "namespace") ?? rod.name;
  const ttl = getCfgString(rod, "ttl");

  const imports: ImportDecl[] = [];
  let statement: string;

  const keyExpr = `String(${ctx.inputVar})`;
  const ttlOpt = ttl ? `, ttl: ${JSON.stringify(ttl)}` : "";

  switch (mode) {
    case "get":
      statement = `const storeResult = await stateStore.get("${namespace}", ${keyExpr});`;
      break;
    case "put":
      statement = `const storeResult = await stateStore.put("${namespace}", ${keyExpr}, ${ctx.inputVar}${ttlOpt});`;
      break;
    case "delete":
      statement = `const storeResult = await stateStore.delete("${namespace}", ${keyExpr});`;
      break;
    case "cas":
      statement = `const storeResult = await stateStore.cas("${namespace}", ${keyExpr}, ${ctx.inputVar}${ttlOpt});`;
      break;
    case "increment":
      statement = `const storeResult = await stateStore.increment("${namespace}", ${keyExpr});`;
      break;
    default:
      statement = [
        `// STRUX-STUB: store — unrecognised mode "${mode}"`,
        `const storeResult = ${ctx.inputVar};`,
      ].join("\n");
  }

  // Prepend backend-specific import hint as a comment
  const header = `// store: backend=${backend}, mode=${mode}, namespace=${namespace}`;

  return {
    imports,
    statement: `${header}\n${statement}`,
    outputVar: "storeResult",
    outputType: "unknown",
  };
}

