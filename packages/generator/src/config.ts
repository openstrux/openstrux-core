/**
 * Config parser for strux.config.yaml.
 *
 * Reads and parses the project-level config file. Validates that each
 * `target` entry is a valid `<name>@<semver-range>` string.
 *
 * Spec reference: openstrux-spec/specs/generator/generator.md §5
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Config shape
// ---------------------------------------------------------------------------

export interface StruxConfig {
  target: {
    base:       string;   // e.g. "typescript@~5.5"
    framework:  string;   // e.g. "next@^15.0"
    orm:        string;   // e.g. "prisma@^6.0"
    validation: string;   // e.g. "zod@^3.23"
    runtime:    string;   // e.g. "node@>=20"
  };
}

export interface ConfigEntry {
  name:  string;
  range: string;
}

export interface ParsedConfig {
  base:       ConfigEntry;
  framework:  ConfigEntry;
  orm:        ConfigEntry;
  validation: ConfigEntry;
  runtime:    ConfigEntry;
  /** Source glob patterns from the `source:` section. Empty if not specified. */
  source:     string[];
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

const ENTRY_RE = /^(@?[a-zA-Z0-9_/.-]+)@(.+)$/;

function parseEntry(raw: string, field: string): ConfigEntry {
  const m = ENTRY_RE.exec(raw.trim());
  if (!m) {
    throw new ConfigParseError(
      `Invalid ${field} entry "${raw}": expected "<name>@<semver-range>"`
    );
  }
  return { name: m[1] ?? "", range: m[2] ?? "" };
}

// ---------------------------------------------------------------------------
// parseConfig — accepts a raw YAML string
// ---------------------------------------------------------------------------

/**
 * Parse a strux.config.yaml string.
 *
 * Uses a minimal hand-rolled parser that handles only the expected shape
 * (flat key:value pairs under a `target:` section). This avoids a YAML
 * dependency for a well-constrained format.
 */
export function parseConfig(yaml: string): ParsedConfig {
  const lines = yaml.split("\n");
  let section: "none" | "target" | "source" | "output" = "none";
  const raw: Record<string, string> = {};
  const sourceGlobs: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    // Top-level section headers
    if (!line.startsWith(" ") && !line.startsWith("\t")) {
      if (trimmed === "target:") { section = "target"; continue; }
      if (trimmed === "source:") { section = "source"; continue; }
      if (trimmed === "output:") { section = "output"; continue; }
      section = "none";
      continue;
    }

    if (section === "target") {
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) continue;
      const key = trimmed.slice(0, colonIdx).trim();
      const value = trimmed.slice(colonIdx + 1).trim();
      raw[key] = value;
    }

    if (section === "source") {
      // YAML list item: `  - "glob/pattern"`
      const listMatch = trimmed.match(/^-\s+"(.+)"$/) ?? trimmed.match(/^-\s+'(.+)'$/) ?? trimmed.match(/^-\s+(.+)$/);
      if (listMatch) sourceGlobs.push(listMatch[1]!.trim());
    }
  }

  const required = ["base", "framework", "orm", "validation", "runtime"] as const;
  for (const key of required) {
    if (!raw[key]) {
      throw new ConfigParseError(`Missing required target field "${key}" in strux.config.yaml`);
    }
  }

  return {
    base:       parseEntry(raw["base"]!,       "base"),
    framework:  parseEntry(raw["framework"]!,  "framework"),
    orm:        parseEntry(raw["orm"]!,         "orm"),
    validation: parseEntry(raw["validation"]!,  "validation"),
    runtime:    parseEntry(raw["runtime"]!,     "runtime"),
    source:     sourceGlobs,
  };
}

// ---------------------------------------------------------------------------
// loadConfig — reads strux.config.yaml from the project root
// ---------------------------------------------------------------------------

export function loadConfig(projectRoot: string): ParsedConfig {
  const configPath = resolve(projectRoot, "strux.config.yaml");
  let yaml: string;
  try {
    yaml = readFileSync(configPath, "utf-8");
  } catch {
    throw new ConfigParseError(
      `strux.config.yaml not found at ${configPath}. Run "strux init" to create it.`
    );
  }
  return parseConfig(yaml);
}

// ---------------------------------------------------------------------------
// ConfigParseError
// ---------------------------------------------------------------------------

export class ConfigParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigParseError";
  }
}
