/**
 * strux init integration test (task 6.6).
 *
 * Uses a temporary directory as a fake project root and mocks readline
 * (to auto-confirm the prompt). Verifies:
 * - strux.config.yaml is written with detected stack
 * - tsconfig.json @openstrux/build paths are added
 * - .openstrux/ is added to .gitignore
 * - src/strux/starter.strux is written
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// vi.mock is hoisted by vitest, so readline is mocked before any imports
vi.mock("node:readline", () => ({
  createInterface: () => ({
    question: (_q: string, cb: (answer: string) => void) => cb("y"),
    close: () => undefined,
  }),
}));

import { runInit } from "../commands/init.js";

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

const PACKAGE_JSON = JSON.stringify({
  dependencies: {
    next: "^15.0.0",
    prisma: "^6.0.0",
    zod: "^3.23.0",
  },
  devDependencies: {
    typescript: "^5.5.0",
  },
}, null, 2);

const TSCONFIG_BASE = JSON.stringify({
  compilerOptions: {
    strict: true,
  },
}, null, 2);

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "strux-init-test-"));
  writeFileSync(join(tmpDir, "package.json"), PACKAGE_JSON, "utf-8");
  writeFileSync(join(tmpDir, "tsconfig.json"), TSCONFIG_BASE, "utf-8");
  // Create a minimal .strux file so strux build produces output
  const struxDir = join(tmpDir, "src", "strux");
  mkdirSync(struxDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("strux init: writes project files", () => {
  it("writes strux.config.yaml with detected framework", async () => {
    await runInit(tmpDir);
    const configPath = join(tmpDir, "strux.config.yaml");
    expect(existsSync(configPath)).toBe(true);
    const content = readFileSync(configPath, "utf-8");
    expect(content).toContain("next@");
    expect(content).toContain("prisma@");
    expect(content).toContain("zod@");
  });

  it("adds @openstrux/build paths to tsconfig.json", async () => {
    await runInit(tmpDir);
    const tsconfig = JSON.parse(readFileSync(join(tmpDir, "tsconfig.json"), "utf-8")) as {
      compilerOptions: { paths: Record<string, string[]> };
    };
    expect(tsconfig.compilerOptions.paths["@openstrux/build"]).toEqual([".openstrux/build"]);
    expect(tsconfig.compilerOptions.paths["@openstrux/build/*"]).toEqual([".openstrux/build/*"]);
  });

  it("adds .openstrux/ to .gitignore", async () => {
    await runInit(tmpDir);
    const gitignorePath = join(tmpDir, ".gitignore");
    expect(existsSync(gitignorePath)).toBe(true);
    const content = readFileSync(gitignorePath, "utf-8");
    expect(content).toContain(".openstrux/");
  });

  it("writes src/strux/starter.strux", async () => {
    await runInit(tmpDir);
    const starterPath = join(tmpDir, "src", "strux", "starter.strux");
    expect(existsSync(starterPath)).toBe(true);
    const content = readFileSync(starterPath, "utf-8");
    expect(content).toContain("@panel health");
  });
});

describe("strux init: idempotent gitignore", () => {
  it("does not duplicate .openstrux/ in .gitignore if already present", async () => {
    writeFileSync(join(tmpDir, ".gitignore"), ".openstrux/\n", "utf-8");
    await runInit(tmpDir);
    const content = readFileSync(join(tmpDir, ".gitignore"), "utf-8");
    const occurrences = (content.match(/\.openstrux\//g) ?? []).length;
    expect(occurrences).toBe(1);
  });
});
