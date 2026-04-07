/**
 * strux build integration test (C.3).
 *
 * Uses a temporary directory with a strux.config.yaml and a .strux source
 * file, then runs `runBuild` directly. Verifies:
 * - output files are written to .openstrux/build/
 * - error is reported for missing config
 * - error is reported for parse failures
 * - no-op when no .strux files match source globs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runBuild } from "../commands/build.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const STRUX_CONFIG = `target:
  base: typescript@~5.5
  framework: next@^15.0
  orm: prisma@^6.0
  validation: zod@^3.23
  runtime: node@>=20
source:
  - "src/strux/**/*.strux"
`;

const MINIMAL_PANEL = `
@panel health {
  @access { purpose: "health_check", operation: "read" }
  recv = receive { trigger: http { method: "GET", path: "/health" } }
  resp = respond  { status: 200 }
}
`;

const INVALID_PANEL = `
@panel broken {
  @access { purpose: "bad", operation: "read" }
  recv = receive { trigger: http { method: "GET", path: "/bad" }
`;

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "strux-build-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("strux build: happy path", () => {
  beforeEach(() => {
    writeFileSync(join(tmpDir, "strux.config.yaml"), STRUX_CONFIG, "utf-8");
    const struxDir = join(tmpDir, "src", "strux");
    mkdirSync(struxDir, { recursive: true });
    writeFileSync(join(struxDir, "health.strux"), MINIMAL_PANEL, "utf-8");
  });

  it("writes output files to .openstrux/build/", async () => {
    await runBuild(tmpDir);
    const outDir = join(tmpDir, ".openstrux", "build");
    expect(existsSync(outDir)).toBe(true);
    // Should have at least one generated file
    const files = collectFiles(outDir);
    expect(files.length).toBeGreaterThan(0);
  });

  it("generates a package.json with @openstrux/build name", async () => {
    await runBuild(tmpDir);
    const pkgPath = join(tmpDir, ".openstrux", "build", "package.json");
    expect(existsSync(pkgPath)).toBe(true);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { name: string };
    expect(pkg.name).toBe("@openstrux/build");
  });
});

describe("strux build: missing config", () => {
  it("throws with config error message when strux.config.yaml is missing", async () => {
    await expect(runBuild(tmpDir)).rejects.toThrow("config error");
  });
});

describe("strux build: parse error", () => {
  beforeEach(() => {
    writeFileSync(join(tmpDir, "strux.config.yaml"), STRUX_CONFIG, "utf-8");
    const struxDir = join(tmpDir, "src", "strux");
    mkdirSync(struxDir, { recursive: true });
    writeFileSync(join(struxDir, "broken.strux"), INVALID_PANEL, "utf-8");
  });

  it("throws with parse error message when .strux file has syntax errors", async () => {
    await expect(runBuild(tmpDir)).rejects.toThrow("parse error");
  });
});

describe("strux build: no matching files", () => {
  beforeEach(() => {
    writeFileSync(join(tmpDir, "strux.config.yaml"), STRUX_CONFIG, "utf-8");
    // No .strux files in src/strux/
  });

  it("warns and returns without output when no .strux files match", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await runBuild(tmpDir);

    const output = warnSpy.mock.calls.flat().join(" ");
    expect(output).toContain("no .strux files");
    // No output directory should be created
    expect(existsSync(join(tmpDir, ".openstrux", "build"))).toBe(false);

    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// F2 — matchGlob pattern matching
// ---------------------------------------------------------------------------

describe("matchGlob patterns (F2)", () => {
  // Access the internal matchGlob via a re-export trick: we test it through the
  // build behavior since matchGlob is not exported. These tests verify that the
  // source-glob filtering works correctly for common patterns.

  it("**/*.strux matches a file in a subdirectory", async () => {
    writeFileSync(join(tmpDir, "strux.config.yaml"), STRUX_CONFIG, "utf-8");
    const struxDir = join(tmpDir, "src", "strux", "subdir");
    mkdirSync(struxDir, { recursive: true });
    writeFileSync(join(struxDir, "deep.strux"), MINIMAL_PANEL, "utf-8");
    await runBuild(tmpDir);
    const outDir = join(tmpDir, ".openstrux", "build");
    expect(existsSync(outDir)).toBe(true);
  });

  it("**/*.strux matches a file directly in the glob root", async () => {
    writeFileSync(join(tmpDir, "strux.config.yaml"), STRUX_CONFIG, "utf-8");
    const struxDir = join(tmpDir, "src", "strux");
    mkdirSync(struxDir, { recursive: true });
    writeFileSync(join(struxDir, "root.strux"), MINIMAL_PANEL, "utf-8");
    await runBuild(tmpDir);
    const outDir = join(tmpDir, ".openstrux", "build");
    expect(existsSync(outDir)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectFiles(dir: string, prefix = ""): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...collectFiles(join(dir, entry.name), rel));
    } else {
      results.push(rel);
    }
  }
  return results;
}
