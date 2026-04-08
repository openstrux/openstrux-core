#!/usr/bin/env node
/**
 * strux CLI entry point.
 *
 * Usage:
 *   strux build   — parse .strux files and emit to .openstrux/build/
 *   strux init    — detect stack, write config, configure tsconfig
 *   strux doctor  — check config, adapters, and tsconfig paths
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { runBuild } from "./commands/build.js";
import { runInit } from "./commands/init.js";
import { runDoctor } from "./commands/doctor.js";

// Injected at bundle time by bundle.mjs via esbuild --define:__STRUX_VERSION__
// Falls back to the root VERSION file for non-bundled (tsc) builds.
declare const __STRUX_VERSION__: string;
const STRUX_VERSION: string = (typeof __STRUX_VERSION__ !== "undefined")
  ? __STRUX_VERSION__
  : (() => {
      try {
        const versionFile = join(dirname(fileURLToPath(import.meta.url)), "../../../VERSION");
        return readFileSync(versionFile, "utf8").trim();
      } catch {
        return "0.0.0-dev";
      }
    })();

const [, , command, ...args] = process.argv;

function printUsage(): void {
  console.log("strux — OpenStrux build tool\n");
  console.log("Usage:");
  console.log("  strux build [--no-explain] [--overwrite-schema]  Build .strux files → .openstrux/build/");
  console.log("  strux init    Initialize project (detect stack, write config)");
  console.log("  strux doctor  Check config, adapters, and tsconfig paths");
  console.log("\nOptions:");
  console.log("  --version, -V  Print version");
  console.log("  --help,    -h  Print this help message");
}

async function main(): Promise<void> {
  switch (command) {
    case "--version":
    case "-V":
      console.log(STRUX_VERSION);
      break;
    case "--help":
    case "-h":
      printUsage();
      break;
    case "build": {
      const overwriteSchema = args.includes("--overwrite-schema");
      const explain = !args.includes("--no-explain");
      const projectRoot = args.find(a => !a.startsWith("--"));
      await runBuild(projectRoot, { overwriteSchema, explain });
      break;
    }
    case "init":
      await runInit(args[0]);
      break;
    case "doctor":
      runDoctor(args[0]);
      break;
    default:
      printUsage();
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
