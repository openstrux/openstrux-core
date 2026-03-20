#!/usr/bin/env node
/**
 * Generate golden fixtures from p0-domain-model.strux.
 * Run: node packages/generator/scripts/gen-golden.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const coreRoot = join(__dirname, "../../..");

// Import built packages
const { parse } = await import("@openstrux/parser");
const { generate, promote } = await import("@openstrux/generator");

const fixturePath = join(coreRoot, "tests/fixtures/valid/p0-domain-model.strux");
const source = readFileSync(fixturePath, "utf-8");

const parseResult = parse(source);
if (parseResult.diagnostics.length > 0) {
  console.error("Parse errors:", parseResult.diagnostics);
  process.exit(1);
}

const ast = promote(parseResult.ast);
const files = generate(ast, {}, { target: "typescript" });

// Output to stdout as JSON for inspection, and write to golden dirs
console.log(`Generated ${files.length} files:`);
for (const f of files) {
  console.log(`  ${f.path} (${f.lang})`);
}

// Write to spec golden dir
const specGolden = join(coreRoot, "../openstrux-spec/conformance/golden/target-ts");
mkdirSync(specGolden, { recursive: true });

// Write to core golden dir
const coreGolden = join(coreRoot, "tests/fixtures/golden/target-ts");
mkdirSync(coreGolden, { recursive: true });

for (const f of files) {
  // Spec golden: prefix with p0-domain-model--
  const specFileName = "p0-domain-model--" + f.path.replace(/\//g, "--");
  const specFilePath = join(specGolden, specFileName);
  mkdirSync(dirname(specFilePath), { recursive: true });
  writeFileSync(specFilePath, f.content, "utf-8");

  // Core golden: same structure
  const coreFilePath = join(coreGolden, specFileName);
  mkdirSync(dirname(coreFilePath), { recursive: true });
  writeFileSync(coreFilePath, f.content, "utf-8");
}

console.log(`\nGolden files written to:`);
console.log(`  ${specGolden}`);
console.log(`  ${coreGolden}`);
