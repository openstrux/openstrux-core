/**
 * Conformance test: diffs actual generator output against golden fixtures.
 *
 * Normalisation rules (per generator.md §8):
 *   1. Collapse runs of blank lines to a single blank line
 *   2. Trim trailing whitespace per line
 *   3. Sort import statements alphabetically within each import block
 *
 * Test fixtures: tests/fixtures/golden/target-nextjs/
 * Input: tests/fixtures/valid/p0-domain-model.strux
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parse } from "@openstrux/parser";
import { build, promote } from "../index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirnameLocal = dirname(__filename);
const coreRoot = resolve(__dirnameLocal, "../../../../");
const goldenDir = join(coreRoot, "tests/fixtures/golden/target-nextjs");
const fixturesDir = join(coreRoot, "tests/fixtures/valid");

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

function normalise(content: string): string {
  // 1. Normalise line endings
  let s = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // 2. Trim trailing whitespace per line
  const lines = s.split("\n").map(l => l.trimEnd());
  // 3. Collapse consecutive blank lines to a single blank line
  const collapsed: string[] = [];
  let prevBlank = false;
  for (const line of lines) {
    const blank = line === "";
    if (blank && prevBlank) continue;
    collapsed.push(line);
    prevBlank = blank;
  }
  s = collapsed.join("\n");
  // 4. Sort import lines within each contiguous import block
  const normalized: string[] = [];
  let importBlock: string[] = [];
  for (const line of s.split("\n")) {
    if (line.startsWith("import ")) {
      importBlock.push(line);
    } else {
      if (importBlock.length > 0) {
        importBlock.sort();
        normalized.push(...importBlock);
        importBlock = [];
      }
      normalized.push(line);
    }
  }
  if (importBlock.length > 0) {
    importBlock.sort();
    normalized.push(...importBlock);
  }
  return normalized.join("\n").trimEnd() + "\n";
}

// ---------------------------------------------------------------------------
// Map golden filename back to generated file path
// Golden filename format: p0-domain-model--<path--with--double-dashes>
// e.g. p0-domain-model--handlers--intake-proposals.ts → handlers/intake-proposals.ts
// ---------------------------------------------------------------------------

function goldenToPath(goldenName: string, prefix: string): string {
  // Strip fixture prefix (e.g. "p0-domain-model--")
  const rest = goldenName.slice(prefix.length);
  // Replace double-dashes with path separator, but preserve extension
  // Split on "--" and rejoin with "/"
  return rest.split("--").join("/");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("target-nextjs golden conformance: p0-domain-model", () => {
  const source = readFileSync(join(fixturesDir, "p0-domain-model.strux"), "utf-8");
  const parseResult = parse(source);
  const ast = promote(parseResult.ast);
  const { files, pkg } = build(ast, {}, { framework: "next" });
  const allFiles = [...files, ...pkg.metadata, ...pkg.entrypoints];
  const generatedMap = new Map(allFiles.map(f => [f.path, f.content]));

  const prefix = "p0-domain-model--";
  const goldenFiles = readdirSync(goldenDir)
    .filter(f => f.startsWith(prefix))
    .sort();

  for (const goldenFile of goldenFiles) {
    const generatedPath = goldenToPath(goldenFile, prefix);
    it(`${generatedPath} matches golden`, () => {
      const goldenContent = readFileSync(join(goldenDir, goldenFile), "utf-8");
      const actualContent = generatedMap.get(generatedPath);
      expect(actualContent).toBeDefined();
      expect(normalise(actualContent ?? "")).toEqual(normalise(goldenContent));
    });
  }
});
