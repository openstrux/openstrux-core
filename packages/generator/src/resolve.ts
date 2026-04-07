/**
 * Adapter resolution — matches config semver ranges against bundled adapter
 * manifests to produce a ResolvedOptions object.
 *
 * For v0.6, adapters are bundled with the CLI (no hub-based discovery).
 *
 * Spec reference: openstrux-spec/specs/generator/generator.md §5-6
 */

import type { ParsedConfig } from "./config.js";
import type { ResolvedDep, ResolvedOptions } from "./types.js";

// ---------------------------------------------------------------------------
// Adapter manifest shape
// ---------------------------------------------------------------------------

export interface AdapterManifest {
  name: string;
  version: string;
  supports: {
    framework: string | string[];
    base?: string | string[];
    orm?: string | string[];
    validation?: string | string[];
    runtime?: string | string[];
  };
}

// ---------------------------------------------------------------------------
// Strux version — keep in sync with ../../VERSION; update by running pnpm bundle
// ---------------------------------------------------------------------------

export const STRUX_VERSION = "0.6.0";

// ---------------------------------------------------------------------------
// Bundled adapter manifests (v0.6 — only nextjs)
// ---------------------------------------------------------------------------

export const BUNDLED_MANIFESTS: AdapterManifest[] = [
  {
    name: "adapter/nextjs",
    version: STRUX_VERSION,
    supports: {
      framework:  "next@>=13.0 <17.0",
      base:       "typescript@>=5.0",
      orm:        ["prisma@>=5.0 <8.0"],
      validation: ["zod@>=3.0"],
      runtime:    ["node@>=18", "bun@>=1.0"],
    },
  },
];

// ---------------------------------------------------------------------------
// Semver range satisfaction — minimal implementation for common range forms
// ---------------------------------------------------------------------------

/**
 * Returns true if `version` satisfies `range`.
 *
 * Handles the subset of npm semver range syntax used in strux.config.yaml:
 * ^X.Y, ~X.Y, >=X.Y, >=X <Y, >X, <X, =X.Y.Z, and space-joined AND ranges.
 */
export function satisfies(version: string, range: string): boolean {
  const v = parseVersion(version);
  if (v === null) return false;

  // Split space-separated AND terms (e.g. ">=14.0 <17.0")
  const terms = range.trim().split(/\s+/).filter(Boolean);
  return terms.every(term => satisfiesTerm(v, term));
}

interface SemVer { major: number; minor: number; patch: number }

function parseVersion(v: string): SemVer | null {
  const m = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(v.trim());
  if (!m) return null;
  return {
    major: parseInt(m[1] ?? "0", 10),
    minor: parseInt(m[2] ?? "0", 10),
    patch: parseInt(m[3] ?? "0", 10),
  };
}

function cmp(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

function satisfiesTerm(v: SemVer, term: string): boolean {
  if (term.startsWith("^")) {
    const base = parseVersion(term.slice(1));
    if (!base) return false;
    if (base.major === 0) {
      if (base.minor === 0) return v.major === 0 && v.minor === 0 && v.patch === base.patch;
      return v.major === 0 && v.minor === base.minor && v.patch >= base.patch;
    }
    return v.major === base.major && cmp(v, base) >= 0;
  }
  if (term.startsWith("~")) {
    const base = parseVersion(term.slice(1));
    if (!base) return false;
    return v.major === base.major && v.minor === base.minor && v.patch >= base.patch;
  }
  if (term.startsWith(">=")) {
    const base = parseVersion(term.slice(2));
    return base !== null && cmp(v, base) >= 0;
  }
  if (term.startsWith(">")) {
    const base = parseVersion(term.slice(1));
    return base !== null && cmp(v, base) > 0;
  }
  if (term.startsWith("<=")) {
    const base = parseVersion(term.slice(2));
    return base !== null && cmp(v, base) <= 0;
  }
  if (term.startsWith("<")) {
    const base = parseVersion(term.slice(1));
    return base !== null && cmp(v, base) < 0;
  }
  if (term.startsWith("=")) {
    const base = parseVersion(term.slice(1));
    return base !== null && cmp(v, base) === 0;
  }
  // Bare version — exact match
  const base = parseVersion(term);
  return base !== null && cmp(v, base) === 0;
}

// ---------------------------------------------------------------------------
// rangeIntersects — true if two semver range strings can have a common version
// ---------------------------------------------------------------------------

/**
 * Very approximate check: parse the lower bound of each range and verify
 * each bound satisfies the other range. Sufficient for the bundled manifests.
 */
function rangeIntersects(configRange: string, manifestRange: string): boolean {
  // Extract a representative version from configRange (its lower bound)
  const configLower = extractLowerBound(configRange);
  if (configLower !== null && satisfiesAllRanges(configLower, manifestRange)) return true;
  const manifestLower = extractLowerBound(manifestRange);
  if (manifestLower !== null && satisfiesAllRanges(manifestLower, configRange)) return true;
  return false;
}

function extractLowerBound(range: string): string | null {
  // Take first term; strip prefix operators to get a version string
  const term = range.trim().split(/\s+/)[0] ?? "";
  const version = term.replace(/^[~^>=<]+/, "");
  return version || null;
}

function satisfiesAllRanges(version: string, range: string): boolean {
  return satisfies(version, range);
}

// ---------------------------------------------------------------------------
// resolveOptions — produce ResolvedOptions from parsed config + manifests
// ---------------------------------------------------------------------------

export class AdapterResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdapterResolutionError";
  }
}

function resolveField(
  configEntry: { name: string; range: string },
  adapterName: string
): ResolvedDep {
  // Extract a representative version from the range (its lower bound for pinning)
  const version = extractLowerBound(configEntry.range) ?? configEntry.range;
  return {
    name:    configEntry.name,
    version,
    adapter: adapterName,
  };
}

export function resolveOptions(
  config: ParsedConfig,
  manifests: AdapterManifest[] = BUNDLED_MANIFESTS
): ResolvedOptions {
  // Find an adapter whose framework range intersects the config's framework range
  const manifest = manifests.find(m => {
    const fw = Array.isArray(m.supports.framework)
      ? m.supports.framework
      : [m.supports.framework];
    return fw.some(r => {
      // Strip the name prefix (e.g. "next@>=14.0") to get just the range
      const range = r.includes("@") ? r.slice(r.indexOf("@") + 1) : r;
      return rangeIntersects(config.framework.range, range);
    });
  });

  if (!manifest) {
    throw new AdapterResolutionError(
      `No adapter found for framework "${config.framework.name}@${config.framework.range}". ` +
      `Available adapters: ${manifests.map(m => m.name).join(", ")}`
    );
  }

  return {
    framework:  resolveField(config.framework,  manifest.name),
    orm:        resolveField(config.orm,        manifest.name),
    validation: resolveField(config.validation, manifest.name),
    runtime:    resolveField(config.runtime,    manifest.name),
  };
}
