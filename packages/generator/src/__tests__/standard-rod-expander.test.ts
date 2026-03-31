/**
 * Unit tests for the standard rod expander (private-data → basic rod sub-graph).
 *
 * Spec reference: openstrux-spec/specs/core/semantics.md §Standard Rod Expansion
 */
import { describe, expect, it } from "vitest";
import type { Panel, Rod } from "@openstrux/ast";
import { FRAMEWORK_PATH, EXPANSION_SUFFIX, PSEUDO_ALGO, ROD_TYPE } from "@openstrux/ast";
import { expandStandardRods } from "../standard-rod-expander.js";

// ---------------------------------------------------------------------------
// Test helpers
// Cfg objects are cast through unknown — the expander reads them as plain
// Record<string, unknown> at runtime, so the strict IR types don't apply here.
// ---------------------------------------------------------------------------

function makePanel(rods: Rod[]): Panel {
  return {
    kind: "Panel",
    name: "test-panel",
    dp: {} as Panel["dp"],
    access: { kind: "AccessContext" } as unknown as Panel["access"],
    rods,
    snaps: [],
  };
}

function makePrivateDataRod(cfgOverrides: Record<string, unknown> = {}): Rod {
  return {
    kind: "Rod",
    name: "pd",
    rodType: ROD_TYPE.PRIVATE_DATA,
    cfg: {
      framework: {
        kind: "TypeRef",
        name: FRAMEWORK_PATH.GDPR,
        config: { lawful_basis: "consent", data_subject_categories: ["applicant"] },
      },
      purpose: { kind: "LitString", value: "process applicant data" },
      retention: { kind: "LitString", value: "P2Y" },
      ...cfgOverrides,
    } as unknown as Rod["cfg"],
    arg: {},
  };
}

function makeBdsgCfg(): Record<string, unknown> {
  return {
    framework: {
      kind: "TypeRef",
      name: FRAMEWORK_PATH.GDPR_BDSG,
      config: {
        lawful_basis: "legal_obligation",
        data_subject_categories: ["employee"],
        employee_data: true,
        employee_category: "employee",
      },
    },
  };
}

// ---------------------------------------------------------------------------
// No-op when no standard rods
// ---------------------------------------------------------------------------

describe("expandStandardRods — no standard rods", () => {
  it("returns the original panel unchanged when no standard rods are present", () => {
    const rod: Rod = { kind: "Rod", name: "r", rodType: "receive", cfg: {} as Rod["cfg"], arg: {} };
    const panel = makePanel([rod]);
    const result = expandStandardRods(panel);
    expect(result).toBe(panel);
  });
});

// ---------------------------------------------------------------------------
// GDPR base expansion
// ---------------------------------------------------------------------------

describe("expandStandardRods — gdpr base expansion", () => {
  it("expands private-data into validate → pseudonymize → guard (no encrypt by default)", () => {
    const panel = makePanel([makePrivateDataRod()]);
    const result = expandStandardRods(panel);

    const rodTypes = result.rods.map((r) => r.rodType);
    expect(rodTypes).toContain(ROD_TYPE.VALIDATE);
    expect(rodTypes).toContain(ROD_TYPE.PSEUDONYMIZE);
    expect(rodTypes).toContain(ROD_TYPE.GUARD);
    expect(rodTypes).not.toContain(ROD_TYPE.ENCRYPT);
    expect(rodTypes).not.toContain(ROD_TYPE.PRIVATE_DATA);
  });

  it("uses sha256 pseudonymization for gdpr base", () => {
    const panel = makePanel([makePrivateDataRod()]);
    const result = expandStandardRods(panel);
    const pseudRod = result.rods.find((r) => r.rodType === ROD_TYPE.PSEUDONYMIZE);
    expect(pseudRod).toBeDefined();
    const algo = (pseudRod?.cfg as unknown as Record<string, unknown>)["algo"];
    expect((algo as { value?: string })?.value).toBe(PSEUDO_ALGO.SHA256);
  });

  it("includes encrypt when encryption_required:true", () => {
    const panel = makePanel([
      makePrivateDataRod({
        encryption_required: { kind: "LitBool", value: true },
      }),
    ]);
    const result = expandStandardRods(panel);
    expect(result.rods.map((r) => r.rodType)).toContain(ROD_TYPE.ENCRYPT);
  });

  it("attaches an expansion hash to the validate rod", () => {
    const panel = makePanel([makePrivateDataRod()]);
    const result = expandStandardRods(panel);
    const validateRod = result.rods.find((r) => r.rodType === ROD_TYPE.VALIDATE);
    const hash = (validateRod?.cfg as unknown as Record<string, unknown>)["_expansionHash"];
    expect(hash).toBeDefined();
    expect(typeof (hash as { value?: unknown })?.value).toBe("string");
    expect(((hash as { value?: unknown })?.value as string).length).toBeGreaterThan(0);
  });

  it("uses namespaced sub-rod names with the correct suffixes", () => {
    const panel = makePanel([makePrivateDataRod()]);
    const result = expandStandardRods(panel);
    const rodNames = result.rods.map((r) => r.name);
    expect(rodNames).toContain(`pd${EXPANSION_SUFFIX.VALIDATE}`);
    expect(rodNames).toContain(`pd${EXPANSION_SUFFIX.PSEUDONYMIZE}`);
    expect(rodNames).toContain(`pd${EXPANSION_SUFFIX.GUARD}`);
  });
});

// ---------------------------------------------------------------------------
// BDSG expansion
// ---------------------------------------------------------------------------

describe("expandStandardRods — gdpr.bdsg expansion", () => {
  it("always includes encrypt step for BDSG", () => {
    const panel = makePanel([makePrivateDataRod(makeBdsgCfg())]);
    const result = expandStandardRods(panel);
    expect(result.rods.map((r) => r.rodType)).toContain(ROD_TYPE.ENCRYPT);
  });

  it("uses sha256_hmac for BDSG pseudonymization", () => {
    const panel = makePanel([makePrivateDataRod(makeBdsgCfg())]);
    const result = expandStandardRods(panel);
    const pseudRod = result.rods.find((r) => r.rodType === ROD_TYPE.PSEUDONYMIZE);
    const algo = (pseudRod?.cfg as unknown as Record<string, unknown>)["algo"];
    expect((algo as { value?: string })?.value).toBe(PSEUDO_ALGO.SHA256_HMAC);
  });
});

// ---------------------------------------------------------------------------
// Snap edges
// ---------------------------------------------------------------------------

describe("expandStandardRods — snap edges", () => {
  it("generates at least 2 snap edges for gdpr (validate→pseudonymize, pseudonymize→guard)", () => {
    const panel = makePanel([makePrivateDataRod()]);
    const result = expandStandardRods(panel);
    expect(result.snaps.length).toBeGreaterThanOrEqual(2);
  });

  it("generates at least 3 snap edges for gdpr.bdsg (includes encrypt step)", () => {
    const panel = makePanel([makePrivateDataRod(makeBdsgCfg())]);
    const result = expandStandardRods(panel);
    expect(result.snaps.length).toBeGreaterThanOrEqual(3);
  });

  it("first snap edge connects validate to pseudonymize", () => {
    const panel = makePanel([makePrivateDataRod()]);
    const result = expandStandardRods(panel);
    const edge = result.snaps[0];
    expect(edge?.from.rod).toContain(EXPANSION_SUFFIX.VALIDATE);
    expect(edge?.to.rod).toContain(EXPANSION_SUFFIX.PSEUDONYMIZE);
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("expandStandardRods — determinism", () => {
  it("produces identical expansion hash for identical configs", () => {
    const rod = makePrivateDataRod();
    const r1 = expandStandardRods(makePanel([rod]));
    const r2 = expandStandardRods(makePanel([{ ...rod }]));
    const h1 = ((r1.rods[0]?.cfg as unknown as Record<string, unknown>)["_expansionHash"] as { value?: string })?.value;
    const h2 = ((r2.rods[0]?.cfg as unknown as Record<string, unknown>)["_expansionHash"] as { value?: string })?.value;
    expect(h1).toBe(h2);
  });
});
