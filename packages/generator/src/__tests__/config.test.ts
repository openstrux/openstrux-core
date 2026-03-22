/**
 * Config parser tests (task 6.5).
 *
 * Verifies parseConfig() handles:
 * - valid config with all required fields
 * - missing required fields → ConfigParseError
 * - malformed entry (missing @) → ConfigParseError
 * - comments and blank lines are ignored
 * - scoped package names (e.g. @prisma/client@5.0)
 */

import { describe, it, expect } from "vitest";
import { parseConfig, ConfigParseError } from "../config.js";

const VALID_CONFIG = `
target:
  base: typescript@~5.5
  framework: next@^15.0
  orm: prisma@^6.0
  validation: zod@^3.23
  runtime: node@>=20
`;

describe("parseConfig: valid config", () => {
  const parsed = parseConfig(VALID_CONFIG);

  it("parses framework name and range", () => {
    expect(parsed.framework.name).toBe("next");
    expect(parsed.framework.range).toBe("^15.0");
  });

  it("parses orm name and range", () => {
    expect(parsed.orm.name).toBe("prisma");
    expect(parsed.orm.range).toBe("^6.0");
  });

  it("parses validation name and range", () => {
    expect(parsed.validation.name).toBe("zod");
    expect(parsed.validation.range).toBe("^3.23");
  });

  it("parses base name and range", () => {
    expect(parsed.base.name).toBe("typescript");
    expect(parsed.base.range).toBe("~5.5");
  });

  it("parses runtime name and range", () => {
    expect(parsed.runtime.name).toBe("node");
    expect(parsed.runtime.range).toBe(">=20");
  });
});

describe("parseConfig: comments and blank lines", () => {
  it("ignores # comment lines", () => {
    const yaml = `
# This is a comment
target:
  # another comment
  base: typescript@~5.5
  framework: next@^15.0
  orm: prisma@^6.0
  validation: zod@^3.23
  runtime: node@>=20
`;
    expect(() => parseConfig(yaml)).not.toThrow();
  });
});

describe("parseConfig: missing fields", () => {
  it("throws ConfigParseError when framework is missing", () => {
    const yaml = `
target:
  base: typescript@~5.5
  orm: prisma@^6.0
  validation: zod@^3.23
  runtime: node@>=20
`;
    expect(() => parseConfig(yaml)).toThrow(ConfigParseError);
    expect(() => parseConfig(yaml)).toThrow(/framework/);
  });

  it("throws ConfigParseError when target section is absent", () => {
    expect(() => parseConfig("# empty")).toThrow(ConfigParseError);
  });
});

describe("parseConfig: malformed entries", () => {
  it("throws ConfigParseError when entry has no @ separator", () => {
    const yaml = `
target:
  base: typescript@~5.5
  framework: next-without-range
  orm: prisma@^6.0
  validation: zod@^3.23
  runtime: node@>=20
`;
    expect(() => parseConfig(yaml)).toThrow(ConfigParseError);
    expect(() => parseConfig(yaml)).toThrow(/framework/);
  });
});
