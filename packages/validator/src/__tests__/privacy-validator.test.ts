/**
 * Unit tests for privacy validation rules.
 *
 * Covers: E_GDPR_PURPOSE_REQUIRED, E_GDPR_RETENTION_REQUIRED,
 *         E_GDPR_INVALID_BASIS_SPECIAL_CATEGORY, W_GDPR_LI_DPIA_RECOMMENDED,
 *         E_PRIVACY_BYPASS, E_BDSG_EMPLOYEE_CATEGORY
 */
import { describe, expect, it } from "vitest";
import { parse } from "@openstrux/parser";
import { validate } from "../validator.js";

// ---------------------------------------------------------------------------
// E_GDPR_PURPOSE_REQUIRED
// ---------------------------------------------------------------------------

describe("E_GDPR_PURPOSE_REQUIRED", () => {
  it("emits error when cfg.purpose is missing on a private-data rod", () => {
    const src = `
@panel intake {
  @access { purpose: "grant_intake", operation: "write" }
  recv   = receive   { trigger: http { method: "POST", path: "/data" } }
  pd     = private-data {
    framework: gdpr { lawful_basis: consent, data_subject_categories: ["applicant"] }
    retention: { duration: "P2Y", basis: consent }
  }
  store  = write-data { target: db.sql.postgres { host: "localhost", port: 5432, db_name: "db", tls: true } }
}`;
    const result = validate(parse(src));
    const diag = result.diagnostics.find((d) => d.code === "E_GDPR_PURPOSE_REQUIRED");
    expect(diag).toBeDefined();
    expect(diag?.severity).toBe("error");
  });

  it("does NOT emit when cfg.purpose is present", () => {
    const src = `
@panel intake {
  @access { purpose: "grant_intake", operation: "write" }
  recv   = receive   { trigger: http { method: "POST", path: "/data" } }
  pd     = private-data {
    framework: gdpr { lawful_basis: consent, data_subject_categories: ["applicant"] }
    purpose: "process applicant personal data"
    retention: { duration: "P2Y", basis: consent }
  }
  store  = write-data { target: db.sql.postgres { host: "localhost", port: 5432, db_name: "db", tls: true } }
}`;
    const result = validate(parse(src));
    const diag = result.diagnostics.find((d) => d.code === "E_GDPR_PURPOSE_REQUIRED");
    expect(diag).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// E_GDPR_RETENTION_REQUIRED
// ---------------------------------------------------------------------------

describe("E_GDPR_RETENTION_REQUIRED", () => {
  it("emits error when cfg.retention is missing on a private-data rod", () => {
    const src = `
@panel intake {
  @access { purpose: "grant_intake", operation: "write" }
  recv   = receive   { trigger: http { method: "POST", path: "/data" } }
  pd     = private-data {
    framework: gdpr { lawful_basis: consent, data_subject_categories: ["applicant"] }
    purpose: "process applicant personal data"
  }
  store  = write-data { target: db.sql.postgres { host: "localhost", port: 5432, db_name: "db", tls: true } }
}`;
    const result = validate(parse(src));
    const diag = result.diagnostics.find((d) => d.code === "E_GDPR_RETENTION_REQUIRED");
    expect(diag).toBeDefined();
    expect(diag?.severity).toBe("error");
  });
});

// ---------------------------------------------------------------------------
// W_GDPR_LI_DPIA_RECOMMENDED
// ---------------------------------------------------------------------------

describe("W_GDPR_LI_DPIA_RECOMMENDED", () => {
  it("emits warning for legitimate_interest without dpia_ref", () => {
    const src = `
@panel intake {
  @access { purpose: "grant_intake", operation: "write" }
  recv   = receive   { trigger: http { method: "POST", path: "/data" } }
  pd     = private-data {
    framework: gdpr { lawful_basis: legitimate_interest, data_subject_categories: ["customer"] }
    purpose: "CRM processing"
    retention: { duration: "P1Y", basis: legitimate_interest }
  }
  store  = write-data { target: db.sql.postgres { host: "localhost", port: 5432, db_name: "db", tls: true } }
}`;
    const result = validate(parse(src));
    const diag = result.diagnostics.find((d) => d.code === "W_GDPR_LI_DPIA_RECOMMENDED");
    expect(diag).toBeDefined();
    expect(diag?.severity).toBe("warning");
  });
});

// ---------------------------------------------------------------------------
// E_PRIVACY_BYPASS
// ---------------------------------------------------------------------------

describe("E_PRIVACY_BYPASS", () => {
  it("does NOT emit when @privacy is absent", () => {
    const src = `
@panel intake {
  @access { purpose: "grant_intake", operation: "write" }
  recv   = receive   { trigger: http { method: "POST", path: "/data" } }
  store  = write-data { target: db.sql.postgres { host: "localhost", port: 5432, db_name: "db", tls: true } }
}`;
    const result = validate(parse(src));
    const diag = result.diagnostics.find((d) => d.code === "E_PRIVACY_BYPASS");
    expect(diag).toBeUndefined();
  });

  it("emits error when @privacy is declared but no private-data rod is present", () => {
    const src = `
@panel intake {
  @privacy { framework: gdpr }
  @access { purpose: "grant_intake", operation: "write" }
  recv   = receive   { trigger: http { method: "POST", path: "/data" } }
  store  = write-data { target: db.sql.postgres { host: "localhost", port: 5432, db_name: "db", tls: true } }
}`;
    const result = validate(parse(src));
    const diag = result.diagnostics.find((d) => d.code === "E_PRIVACY_BYPASS");
    expect(diag).toBeDefined();
    expect(diag?.severity).toBe("error");
  });

  it("does NOT emit when @privacy is declared and a private-data rod is present", () => {
    const src = `
@panel intake {
  @privacy { framework: gdpr }
  @access { purpose: "grant_intake", operation: "write" }
  recv   = receive   { trigger: http { method: "POST", path: "/data" } }
  pd     = private-data {
    framework: gdpr { lawful_basis: consent, data_subject_categories: ["applicant"] }
    purpose: "process applicant data"
    retention: { duration: "P2Y", basis: consent }
  }
  store  = write-data { target: db.sql.postgres { host: "localhost", port: 5432, db_name: "db", tls: true } }
}`;
    const result = validate(parse(src));
    const diag = result.diagnostics.find((d) => d.code === "E_PRIVACY_BYPASS");
    expect(diag).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// E_GDPR_INVALID_BASIS_SPECIAL_CATEGORY
// ---------------------------------------------------------------------------

describe("E_GDPR_INVALID_BASIS_SPECIAL_CATEGORY", () => {
  it("emits error when special-category data uses a disallowed lawful basis", () => {
    const src = `
@panel intake {
  @access { purpose: "grant_intake", operation: "write" }
  recv   = receive   { trigger: http { method: "POST", path: "/data" } }
  pd     = private-data {
    framework: gdpr { lawful_basis: legitimate_interest, data_subject_categories: ["patient"] }
    purpose: "health data processing"
    retention: { duration: "P5Y", basis: legal_obligation }
    fields: {
      medical_history: { sensitivity: special_category }
    }
  }
  store  = write-data { target: db.sql.postgres { host: "localhost", port: 5432, db_name: "db", tls: true } }
}`;
    const result = validate(parse(src));
    const diag = result.diagnostics.find((d) => d.code === "E_GDPR_INVALID_BASIS_SPECIAL_CATEGORY");
    expect(diag).toBeDefined();
    expect(diag?.severity).toBe("error");
  });

  it("does NOT emit when special-category data uses consent", () => {
    const src = `
@panel intake {
  @access { purpose: "grant_intake", operation: "write" }
  recv   = receive   { trigger: http { method: "POST", path: "/data" } }
  pd     = private-data {
    framework: gdpr { lawful_basis: consent, data_subject_categories: ["patient"] }
    purpose: "health data processing"
    retention: { duration: "P5Y", basis: consent }
    fields: {
      medical_history: { sensitivity: special_category }
    }
  }
  store  = write-data { target: db.sql.postgres { host: "localhost", port: 5432, db_name: "db", tls: true } }
}`;
    const result = validate(parse(src));
    const diag = result.diagnostics.find((d) => d.code === "E_GDPR_INVALID_BASIS_SPECIAL_CATEGORY");
    expect(diag).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// E_BDSG_EMPLOYEE_CATEGORY
// ---------------------------------------------------------------------------

describe("E_BDSG_EMPLOYEE_CATEGORY", () => {
  it("emits error when employee_data:true without employee_category under BDSG", () => {
    const src = `
@panel hr {
  @access { purpose: "hr_processing", operation: "write" }
  recv   = receive   { trigger: http { method: "POST", path: "/hr" } }
  pd     = private-data {
    framework: gdpr.bdsg { lawful_basis: consent, data_subject_categories: ["employee"], employee_data: true }
    purpose: "employee data processing"
    retention: { duration: "P10Y", basis: legal_obligation }
  }
  store  = write-data { target: db.sql.postgres { host: "localhost", port: 5432, db_name: "hr", tls: true } }
}`;
    const result = validate(parse(src));
    const diag = result.diagnostics.find((d) => d.code === "E_BDSG_EMPLOYEE_CATEGORY");
    expect(diag).toBeDefined();
    expect(diag?.severity).toBe("error");
  });
});

// ---------------------------------------------------------------------------
// Standard data models are recognized (no V001 for built-in types)
// ---------------------------------------------------------------------------

describe("standard personal data model types — no V001", () => {
  it("does not emit V001 for PersonName, UserIdentity, EmployeeRecord", () => {
    const src = `
@type ApplicantProfile {
  identity: UserIdentity
  financial: FinancialAccount
}
@panel intake {
  @access { purpose: "grant_intake", operation: "write" }
  recv  = receive { trigger: http { method: "POST", path: "/apply" } }
  store = write-data { target: db.sql.postgres { host: "localhost", port: 5432, db_name: "grants", tls: true } }
}`;
    const result = validate(parse(src));
    const v001 = result.diagnostics.filter((d) => d.code === "V001");
    expect(v001).toHaveLength(0);
  });

  it("does not emit V001 for PrivacyFramework types", () => {
    const src = `
@type MyConfig {
  basis: GdprBasis
  category: DataCategory
  sensitivity: Sensitivity
}
@panel p {
  @access { purpose: "test", operation: "read" }
  r = receive { trigger: http { method: "GET", path: "/x" } }
  s = respond { status: 200 }
}`;
    const result = validate(parse(src));
    const v001 = result.diagnostics.filter((d) => d.code === "V001");
    expect(v001).toHaveLength(0);
  });
});
