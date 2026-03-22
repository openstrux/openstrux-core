#!/usr/bin/env node
/**
 * strux CLI entry point.
 *
 * Usage:
 *   strux build   — parse .strux files and emit to .openstrux/build/
 *   strux init    — detect stack, write config, configure tsconfig
 *   strux doctor  — check config, adapters, and tsconfig paths
 */

import { runBuild } from "./commands/build.js";
import { runInit } from "./commands/init.js";
import { runDoctor } from "./commands/doctor.js";

const [, , command, ...args] = process.argv;

async function main(): Promise<void> {
  switch (command) {
    case "build":
      await runBuild(args[0]);
      break;
    case "init":
      await runInit(args[0]);
      break;
    case "doctor":
      runDoctor(args[0]);
      break;
    default:
      console.log("strux — OpenStrux build tool\n");
      console.log("Usage:");
      console.log("  strux build   Build .strux files → .openstrux/build/");
      console.log("  strux init    Initialize project (detect stack, write config)");
      console.log("  strux doctor  Check config, adapters, and tsconfig paths");
      if (command) {
        console.error(`\nUnknown command: ${command}`);
        process.exit(1);
      }
  }
}

main().catch((err: unknown) => {
  console.error("strux:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
