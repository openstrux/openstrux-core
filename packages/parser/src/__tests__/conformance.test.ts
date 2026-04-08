/**
 * Conformance test suite for @openstrux/parser.
 *
 * Runs the parser against:
 * - tests/fixtures/valid/  — expects zero diagnostics and at least one AST node
 * - tests/fixtures/invalid/ — expects diagnostic codes matching *.expected.json
 *
 * Fixture files with only comment content (e.g. TODO placeholders) are
 * also expected to produce zero diagnostics (empty AST is fine).
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "../parser.js";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirnameLocal = dirname(__filename);
const coreRoot = resolve(__dirnameLocal, "../../../../");
const validFixturesDir = join(coreRoot, "tests/fixtures/valid");
const invalidFixturesDir = join(coreRoot, "tests/fixtures/invalid");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readSource(path: string): string {
  return readFileSync(path, "utf-8");
}

interface ExpectedDiagnostic {
  code: string;
  severity?: string;
  messageContains?: string;
}

interface ExpectedJson {
  diagnostics: ExpectedDiagnostic[];
}

/** Diagnostic codes emitted by the parser (not the validator).
 * E000–E003, W001: main parser errors/warnings.
 * E010–E031: expression parser errors (emitted via captureAndParseExpr).
 */
const PARSER_CODES = new Set([
  "E000", "E001", "E002", "E003", "W001",
  // Expression parser codes
  "E010", "E011", "E012", "E013", "E014", "E015", "E016",
  "E017", "E018", "E019", "E020", "E021", "E022", "E023",
  "E024", "E025", "E026", "E027", "E028", "E029", "E030", "E031",
]);

function readExpected(path: string): ExpectedJson {
  return JSON.parse(readFileSync(path, "utf-8")) as ExpectedJson;
}

function struxFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f: string) => f.endsWith(".strux"))
    .sort();
}

// ---------------------------------------------------------------------------
// Valid fixtures — expect zero diagnostics
// ---------------------------------------------------------------------------

describe("valid fixtures → zero diagnostics", () => {
  const files = struxFiles(validFixturesDir);

  if (files.length === 0) {
    it("(no valid fixtures found)", () => {
      expect(files.length).toBeGreaterThan(0);
    });
  }

  for (const file of files) {
    it(file, () => {
      const source = readSource(join(validFixturesDir, file));
      const result = parse(source);
      const errors = result.diagnostics.filter((d) => d.severity === "error");
      expect(errors, `Errors in ${file}: ${JSON.stringify(errors)}`).toHaveLength(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Invalid fixtures — expect matching diagnostic codes
// ---------------------------------------------------------------------------

describe("invalid fixtures → expected diagnostic codes", () => {
  const files = struxFiles(invalidFixturesDir);

  if (files.length === 0) {
    it("(no invalid fixtures found)", () => {
      expect(files.length).toBeGreaterThan(0);
    });
  }

  for (const file of files) {
    const expectedPath = join(invalidFixturesDir, file.replace(".strux", ".expected.json"));

    it(file, () => {
      const source = readSource(join(invalidFixturesDir, file));
      const expected = readExpected(expectedPath);
      const result = parse(source);

      for (const exp of expected.diagnostics) {
        // Skip validator-level diagnostic codes — those are checked by the validator conformance test.
        if (!PARSER_CODES.has(exp.code)) continue;

        const match = result.diagnostics.find((d) => d.code === exp.code);
        expect(
          match,
          `Expected diagnostic code '${exp.code}' in ${file}, got: ${JSON.stringify(result.diagnostics)}`,
        ).toBeDefined();

        if (exp.severity !== undefined && match !== undefined) {
          expect(match.severity).toBe(exp.severity);
        }

        if (match !== undefined) {
          expect(match.line).toBeGreaterThanOrEqual(1);
          expect(match.col).toBeGreaterThanOrEqual(1);
        }
      }
    });
  }
});
