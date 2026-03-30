#!/usr/bin/env node
// bundle.mjs — reads ../../VERSION and bundles with version injected via esbuild --define
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const version = readFileSync(join(root, "VERSION"), "utf8").trim();

console.log(`[bundle] strux version: ${version}`);

execSync(
  `npx esbuild src/bin.ts --bundle --platform=node --format=esm` +
  ` --outfile=dist/strux-standalone.mjs` +
  ` --define:__STRUX_VERSION__='"${version}"'`,
  { stdio: "inherit" },
);
