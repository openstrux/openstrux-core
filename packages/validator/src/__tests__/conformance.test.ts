/**
 * Conformance test suite for @openstrux/validator.
 *
 * Runs the validator against:
 * - tests/fixtures/valid/  — expects zero error diagnostics
 * - tests/fixtures/invalid/ — expects diagnostic codes from *.expected.json
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "@openstrux/parser";
import { validate } from "../validator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirnameLocal = dirname(__filename);
const coreRoot = resolve(__dirnameLocal, "../../../../");
const validFixturesDir = join(coreRoot, "tests/fixtures/valid");
const invalidFixturesDir = join(coreRoot, "tests/fixtures/invalid");

interface ExpectedDiagnostic {
  code: string;
  severity?: string;
}
interface ExpectedJson {
  diagnostics: ExpectedDiagnostic[];
}

function readExpected(path: string): ExpectedJson {
  return JSON.parse(readFileSync(path, "utf-8")) as ExpectedJson;
}

function struxFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f: string) => f.endsWith(".strux"))
    .sort();
}

describe("valid fixtures → zero validator errors", () => {
  const files = struxFiles(validFixturesDir);

  for (const file of files) {
    it(file, () => {
      const source = readFileSync(join(validFixturesDir, file), "utf-8");
      const parseResult = parse(source);
      const result = validate(parseResult);
      const errors = result.diagnostics.filter((d) => d.severity === "error");
      expect(
        errors,
        `Validator errors in ${file}: ${JSON.stringify(errors)}`,
      ).toHaveLength(0);
    });
  }
});

describe("invalid fixtures → expected validator diagnostic codes", () => {
  const files = struxFiles(invalidFixturesDir);

  for (const file of files) {
    const expectedPath = join(
      invalidFixturesDir,
      file.replace(".strux", ".expected.json"),
    );
    // Only run if there's an expected.json for this file
    if (!existsSync(expectedPath)) continue;

    it(file, () => {
      const source = readFileSync(join(invalidFixturesDir, file), "utf-8");
      const expected = readExpected(expectedPath);
      const parseResult = parse(source);
      const result = validate(parseResult);

      const allDiagnostics = [
        ...parseResult.diagnostics,
        ...result.diagnostics,
      ];

      for (const exp of expected.diagnostics) {
        const match = allDiagnostics.find((d) => d.code === exp.code);
        expect(match, `Expected diagnostic ${exp.code} in ${file}`).toBeDefined();
        if (match !== undefined && exp.severity !== undefined) {
          expect(match.severity).toBe(exp.severity);
        }
      }
    });
  }
});
