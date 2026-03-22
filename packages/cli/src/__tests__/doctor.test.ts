/**
 * strux doctor tests (task 6.7).
 *
 * Uses a temporary directory as a fake project root to verify:
 * - valid config + adapter → reports ✓
 * - missing config → reports ✗ and prompts strux init
 * - missing tsconfig paths → reports ✗ with specific missing entries
 * - tsconfig paths correctly configured → reports ✓
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runDoctor } from "../commands/doctor.js";

const VALID_CONFIG = `target:
  base: typescript@~5.5
  framework: next@^15.0
  orm: prisma@^6.0
  validation: zod@^3.23
  runtime: node@>=20
`;

const TSCONFIG_WITH_PATHS = JSON.stringify({
  compilerOptions: {
    paths: {
      "@openstrux/build": [".openstrux/build"],
      "@openstrux/build/*": [".openstrux/build/*"],
    },
  },
}, null, 2);

const TSCONFIG_WITHOUT_PATHS = JSON.stringify({ compilerOptions: {} }, null, 2);

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let tmpDir: string;
let logs: string[];
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "strux-doctor-test-"));
  logs = [];
  logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    logs.push(args.join(" "));
  });
});

afterEach(() => {
  logSpy.mockRestore();
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("strux doctor: missing config", () => {
  it("reports ✗ for missing strux.config.yaml and suggests strux init", () => {
    runDoctor(tmpDir);
    const output = logs.join("\n");
    expect(output).toContain("✗");
    expect(output).toContain("strux init");
  });
});

describe("strux doctor: valid config, no tsconfig", () => {
  beforeEach(() => {
    writeFileSync(join(tmpDir, "strux.config.yaml"), VALID_CONFIG, "utf-8");
  });

  it("reports ✓ for config", () => {
    runDoctor(tmpDir);
    const output = logs.join("\n");
    expect(output).toContain("✓");
    expect(output).toContain("strux.config.yaml");
  });

  it("reports ✗ for missing tsconfig.json", () => {
    runDoctor(tmpDir);
    const output = logs.join("\n");
    expect(output).toContain("✗");
    expect(output).toContain("tsconfig.json");
  });
});

describe("strux doctor: valid config, tsconfig missing paths", () => {
  beforeEach(() => {
    writeFileSync(join(tmpDir, "strux.config.yaml"), VALID_CONFIG, "utf-8");
    writeFileSync(join(tmpDir, "tsconfig.json"), TSCONFIG_WITHOUT_PATHS, "utf-8");
  });

  it("reports ✗ for missing @openstrux/build paths", () => {
    runDoctor(tmpDir);
    const output = logs.join("\n");
    expect(output).toContain("✗");
    expect(output).toContain("@openstrux/build");
  });

  it("mentions strux init to fix tsconfig paths", () => {
    runDoctor(tmpDir);
    const output = logs.join("\n");
    expect(output).toContain("strux init");
  });
});

describe("strux doctor: valid config, tsconfig paths configured", () => {
  beforeEach(() => {
    writeFileSync(join(tmpDir, "strux.config.yaml"), VALID_CONFIG, "utf-8");
    writeFileSync(join(tmpDir, "tsconfig.json"), TSCONFIG_WITH_PATHS, "utf-8");
  });

  it("reports ✓ for tsconfig paths", () => {
    runDoctor(tmpDir);
    const tsconfigLines = logs.filter(l => l.includes("tsconfig.json"));
    expect(tsconfigLines.some(l => l.includes("✓"))).toBe(true);
  });

  it("reports adapter resolved", () => {
    runDoctor(tmpDir);
    const output = logs.join("\n");
    expect(output).toContain("adapter resolved");
    expect(output).toContain("nextjs");
  });
});
