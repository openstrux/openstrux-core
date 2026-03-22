/**
 * `strux doctor` command.
 *
 * 1. Read strux.config.yaml
 * 2. Check each dependency range against available adapter manifests
 * 3. Verify tsconfig.json paths are configured correctly
 * 4. Report: resolved (✓), no adapter (✗), suggestions
 *
 * Spec reference: ADR-019 §6
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  loadConfig,
  resolveOptions,
  BUNDLED_MANIFESTS,
  ConfigParseError,
  AdapterResolutionError,
} from "@openstrux/generator";

export function runDoctor(projectRoot: string = process.cwd()): void {
  console.log("\nstrux doctor\n");

  // 1. Config check
  let config;
  try {
    config = loadConfig(projectRoot);
  } catch (e) {
    if (e instanceof ConfigParseError) {
      console.log(`  ✗ strux.config.yaml — ${e.message}`);
      console.log('\n  Run "strux init" to create a config file.');
      return;
    }
    throw e;
  }
  console.log("  ✓ strux.config.yaml — found and parsed");
  console.log(`      framework:  ${config.framework.name}@${config.framework.range}`);
  console.log(`      orm:        ${config.orm.name}@${config.orm.range}`);
  console.log(`      validation: ${config.validation.name}@${config.validation.range}`);
  console.log(`      base:       ${config.base.name}@${config.base.range}`);
  console.log(`      runtime:    ${config.runtime.name}@${config.runtime.range}`);

  // 2. Adapter resolution
  let resolved;
  try {
    resolved = resolveOptions(config, BUNDLED_MANIFESTS);
    console.log(`\n  ✓ adapter resolved — ${resolved.framework.adapter}`);
  } catch (e) {
    if (e instanceof AdapterResolutionError) {
      console.log(`\n  ✗ adapter resolution failed — ${e.message}`);
      console.log("\n  Available adapters:");
      for (const m of BUNDLED_MANIFESTS) {
        console.log(`    ${m.name}@${m.version}`);
        console.log(`      framework: ${JSON.stringify(m.supports.framework)}`);
      }
    } else {
      throw e;
    }
  }

  // 3. tsconfig.json path check
  const tsconfigPath = join(projectRoot, "tsconfig.json");
  if (!existsSync(tsconfigPath)) {
    console.log("\n  ✗ tsconfig.json — not found");
  } else {
    try {
      const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf-8")) as Record<string, unknown>;
      const co = tsconfig["compilerOptions"] as Record<string, unknown> | undefined;
      const paths = co?.["paths"] as Record<string, unknown> | undefined;
      const hasBuild = paths?.["@openstrux/build"] !== undefined;
      const hasBuildStar = paths?.["@openstrux/build/*"] !== undefined;

      if (hasBuild && hasBuildStar) {
        console.log("\n  ✓ tsconfig.json — @openstrux/build paths configured");
      } else {
        console.log("\n  ✗ tsconfig.json — @openstrux/build paths not configured");
        if (!hasBuild) {
          console.log('      missing: "@openstrux/build": [".openstrux/build"]');
        }
        if (!hasBuildStar) {
          console.log('      missing: "@openstrux/build/*": [".openstrux/build/*"]');
        }
        console.log('  Run "strux init" to configure automatically.');
      }
    } catch {
      console.log("\n  ✗ tsconfig.json — could not parse");
    }
  }

  // 4. Summary
  console.log("\n");
}
