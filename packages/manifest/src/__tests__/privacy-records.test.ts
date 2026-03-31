/**
 * Unit tests for the privacy records emitter.
 *
 * Spec reference: openstrux-spec/specs/modules/rods/standard/private-data-gdpr.md §Art. 30
 *                 openstrux-spec/specs/modules/manifest.md §Privacy Records
 */
import { describe, expect, it } from "vitest";
import type { SourceFile, Panel, Rod } from "@openstrux/ast";
import { emitPrivacyRecords } from "../privacy-records.js";

// ---------------------------------------------------------------------------
// Helpers
// Synthetic rod/panel objects are cast through unknown to avoid strict CfgValue
// type constraints — this is intentional in test helpers where we control the
// shape consumed by the emitter.
// ---------------------------------------------------------------------------

function makeSourceFile(panels: Panel[]): SourceFile {
  return { types: [], panels };
}

function makePanel(rods: Rod[], dp: Record<string, unknown> = {}): Panel {
  return {
    kind: "Panel",
    name: "test-panel",
    dp: {
      controller: "Test Corp",
      controllerId: "TC-001",
      record: "GW-2026-001",
      ...dp,
    } as unknown as Panel["dp"],
    access: { kind: "AccessContext" } as unknown as Panel["access"],
    rods,
    snaps: [],
  };
}

function makePrivateDataRod(cfgOverrides: Record<string, unknown> = {}): Rod {
  return {
    kind: "Rod",
    name: "pd",
    rodType: "private-data",
    cfg: {
      framework: {
        kind: "TypeRef",
        name: "gdpr",
        config: {
          lawful_basis: "consent",
          data_subject_categories: ["applicant"],
        },
      },
      purpose: { kind: "LitString", value: "Process grant applicant data" },
      retention: { duration: { kind: "LitString", value: "P2Y" }, basis: "consent" },
      fields: [
        { field: "email",       category: "identifying", sensitivity: "standard" },
        { field: "national_id", category: "identifying", sensitivity: "highly_sensitive" },
      ],
      ...cfgOverrides,
    } as unknown as Rod["cfg"],
    arg: {},
  };
}

// ---------------------------------------------------------------------------
// No privacy records when no private-data rods
// ---------------------------------------------------------------------------

describe("emitPrivacyRecords — no private-data rods", () => {
  it("returns undefined when no panels contain private-data rods", () => {
    const source = makeSourceFile([
      makePanel([
        { kind: "Rod", name: "r", rodType: "receive", cfg: {} as Rod["cfg"], arg: {} },
      ]),
    ]);
    expect(emitPrivacyRecords(source)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// GDPR record emission
// ---------------------------------------------------------------------------

describe("emitPrivacyRecords — GDPR base", () => {
  it("emits one record per private-data rod", () => {
    const source = makeSourceFile([makePanel([makePrivateDataRod()])]);
    const records = emitPrivacyRecords(source);
    expect(records).toHaveLength(1);
    expect(records?.[0]?.rodName).toBe("pd");
    expect(records?.[0]?.framework).toBe("gdpr");
  });

  it("populates Art. 30 controller from panel @dp", () => {
    const source = makeSourceFile([makePanel([makePrivateDataRod()])]);
    const record = emitPrivacyRecords(source)?.[0];
    expect(record?.article30.controller).toBe("Test Corp");
    expect(record?.article30.dpRecord).toBe("GW-2026-001");
  });

  it("derives lawful_basis from framework config", () => {
    const source = makeSourceFile([makePanel([makePrivateDataRod()])]);
    const record = emitPrivacyRecords(source)?.[0];
    expect(record?.article30.lawfulBasis).toBe("consent");
  });

  it("derives personalDataCategories from field classifications (sorted, deduplicated)", () => {
    const source = makeSourceFile([makePanel([makePrivateDataRod()])]);
    const record = emitPrivacyRecords(source)?.[0];
    expect(record?.article30.personalDataCategories).toEqual(["identifying"]);
  });

  it("includes special categories for highly_sensitive fields", () => {
    const source = makeSourceFile([makePanel([makePrivateDataRod()])]);
    const record = emitPrivacyRecords(source)?.[0];
    expect(record?.article30.specialCategories).toContain("national_id");
  });

  it("includes pseudonymization in technicalMeasures", () => {
    const source = makeSourceFile([makePanel([makePrivateDataRod()])]);
    const record = emitPrivacyRecords(source)?.[0];
    expect(record?.article30.technicalMeasures).toContain("pseudonymization");
  });

  it("does NOT include bdsg extension for gdpr base", () => {
    const source = makeSourceFile([makePanel([makePrivateDataRod()])]);
    const record = emitPrivacyRecords(source)?.[0];
    expect(record?.bdsg).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// BDSG record emission
// ---------------------------------------------------------------------------

describe("emitPrivacyRecords — BDSG", () => {
  it("emits bdsg extension for gdpr.bdsg framework", () => {
    const bdsgRod = makePrivateDataRod({
      framework: {
        kind: "TypeRef",
        name: "gdpr.bdsg",
        config: {
          lawful_basis: "legal_obligation",
          data_subject_categories: ["employee"],
          employee_data: true,
          employee_category: "employee",
          betriebsrat_consent: "BR-2026-001",
        },
      },
    });
    const source = makeSourceFile([makePanel([bdsgRod])]);
    const record = emitPrivacyRecords(source)?.[0];
    expect(record?.framework).toBe("gdpr.bdsg");
    expect(record?.bdsg?.bdsgSection26).toBe(true);
    expect(record?.bdsg?.employeeCategory).toBe("employee");
    expect(record?.bdsg?.betriebsratConsent).toBe("BR-2026-001");
  });
});

// ---------------------------------------------------------------------------
// Multiple rods → multiple records
// ---------------------------------------------------------------------------

describe("emitPrivacyRecords — multiple rods", () => {
  it("emits one record per private-data rod instance", () => {
    const rod1 = makePrivateDataRod();
    const rod2 = { ...makePrivateDataRod(), name: "pd2" };
    const source = makeSourceFile([makePanel([rod1, rod2])]);
    const records = emitPrivacyRecords(source);
    expect(records).toHaveLength(2);
    expect(records?.map((r) => r.rodName)).toEqual(["pd", "pd2"]);
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("emitPrivacyRecords — determinism", () => {
  it("produces identical output for identical input", () => {
    const source = makeSourceFile([makePanel([makePrivateDataRod()])]);
    const r1 = emitPrivacyRecords(source);
    const r2 = emitPrivacyRecords(source);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
