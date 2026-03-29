/**
 * `strux build` command.
 *
 * Pipeline: read config → resolve adapter → parse .strux files →
 *           validate → emit → package → write to .openstrux/build/
 *
 * Spec reference: openstrux-spec/specs/generator/generator.md §4
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname, relative, matchesGlob } from "node:path";
import { parse } from "@openstrux/parser";
import {
  loadConfig,
  resolveOptions,
  build,
  promote,
  AdapterResolutionError,
  ConfigParseError,
} from "@openstrux/generator";

export async function runBuild(projectRoot: string = process.cwd()): Promise<void> {
  // 1. Read config
  let config;
  try {
    config = loadConfig(projectRoot);
  } catch (e) {
    if (e instanceof ConfigParseError) {
      console.error(`strux: config error — ${e.message}`);
      process.exit(1);
    }
    throw e;
  }

  // 2. Resolve adapter
  let resolved;
  try {
    resolved = resolveOptions(config);
  } catch (e) {
    if (e instanceof AdapterResolutionError) {
      console.error(`strux: adapter resolution failed — ${e.message}`);
      process.exit(1);
    }
    throw e;
  }

  // 3. Parse all .strux files matched by config source globs
  const sourceGlobs: string[] = Array.isArray(config.source) ? config.source : [];
  const struxFiles = findStruxFiles(projectRoot, sourceGlobs);
  if (struxFiles.length === 0) {
    console.warn("strux: no .strux files matched source globs in strux.config.yaml. Nothing to build.");
    return;
  }

  const allNodes: ReturnType<typeof promote> = [];
  for (const filePath of struxFiles) {
    const source = readFileSync(filePath, "utf-8");
    const result = parse(source);
    if (result.diagnostics && result.diagnostics.length > 0) {
      const rel = relative(projectRoot, filePath);
      console.error(`strux: parse error in ${rel}:`);
      for (const err of result.diagnostics) {
        console.error(`  ${err.severity.toUpperCase()} ${err.code} [${err.line}:${err.col}] ${err.message}`);
      }
      process.exit(1);
    }
    allNodes.push(...promote(result.ast));
  }

  // 4. Build (emit + package)
  const { files, pkg } = build(allNodes, {}, resolved);

  // 5. Write to output directory
  const outDir = resolve(projectRoot, pkg.outputDir);
  const allFiles = [...files, ...pkg.metadata, ...pkg.entrypoints];

  for (const file of allFiles) {
    const filePath = join(outDir, file.path);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, file.content, "utf-8");
  }

  console.log(
    `strux: ✓ built ${allFiles.length} files → ${pkg.outputDir}/`
  );
}

function findStruxFiles(root: string, sourceGlobs: string[]): string[] {
  const results: string[] = [];
  const IGNORE = new Set(["node_modules", ".git", ".openstrux", "dist"]);

  function walk(dir: string): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (IGNORE.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".strux")) {
        const rel = relative(root, full);
        // If source globs are configured, only include files that match at least one
        if (sourceGlobs.length === 0 || sourceGlobs.some((g) => matchesGlob(rel, g))) {
          results.push(full);
        }
      }
    }
  }

  walk(root);
  return results;
}
