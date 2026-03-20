/**
 * Tests for source canonicalisation and content hash.
 *
 * Covers:
 *   - Task 2.3: same content, different declaration order → same hash
 *   - Task 2.4: comment changes → same hash
 *   - Task 2.5: @cert block presence/absence → same hash
 */

import { describe, expect, it } from "vitest";
import { canonicalise, computeContentHash } from "../canonicalise.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ALPHA_DECL = `@type Alpha { id: string }`;
const BETA_DECL = `@type Beta { name: string }`;

const ORDER_A = `${ALPHA_DECL}\n${BETA_DECL}`;
const ORDER_B = `${BETA_DECL}\n${ALPHA_DECL}`;

const WITH_COMMENTS = `
// This is a comment
@type Alpha { id: string }

// Another comment
@type Beta { name: string }
`.trim();

const WITHOUT_COMMENTS = `
@type Alpha { id: string }
@type Beta { name: string }
`.trim();

const WITHOUT_CERT = `
@type Alpha { id: string }

@panel my-panel {
  intake = receive {
    trigger: http { method: "POST" }
  }
}
`.trim();

const WITH_CERT = `
@type Alpha { id: string }

@panel my-panel {
  intake = receive {
    @cert { level: "P0", scope: { data: "grant-workflow.Proposal" } }
    trigger: http { method: "POST" }
  }
}
`.trim();

// ---------------------------------------------------------------------------
// Task 2.3: declaration order stability
// ---------------------------------------------------------------------------

describe("computeContentHash — declaration order", () => {
  it("produces the same hash for declarations in different order", () => {
    expect(computeContentHash(ORDER_A)).toBe(computeContentHash(ORDER_B));
  });

  it("produces different hashes for different content", () => {
    const different = `@type Alpha { id: number }`;
    expect(computeContentHash(ALPHA_DECL)).not.toBe(computeContentHash(different));
  });
});

// ---------------------------------------------------------------------------
// Task 2.4: comment stability
// ---------------------------------------------------------------------------

describe("computeContentHash — comment stability", () => {
  it("produces the same hash with and without comments", () => {
    expect(computeContentHash(WITH_COMMENTS)).toBe(computeContentHash(WITHOUT_COMMENTS));
  });

  it("produces the same hash for added inline comments", () => {
    const withInline = `@type Alpha { id: string // the primary key\n }`;
    const withoutInline = `@type Alpha { id: string }`;
    expect(computeContentHash(withInline)).toBe(computeContentHash(withoutInline));
  });
});

// ---------------------------------------------------------------------------
// Task 2.5: @cert block stability
// ---------------------------------------------------------------------------

describe("computeContentHash — @cert block stability", () => {
  it("produces the same hash regardless of @cert block presence", () => {
    expect(computeContentHash(WITH_CERT)).toBe(computeContentHash(WITHOUT_CERT));
  });
});

// ---------------------------------------------------------------------------
// Canonicalise: structural checks
// ---------------------------------------------------------------------------

describe("canonicalise", () => {
  it("sorts declarations alphabetically by name", () => {
    const result = canonicalise(ORDER_B);
    const lines = result.split("\n");
    expect(lines[0]).toContain("Alpha");
    expect(lines[1]).toContain("Beta");
  });

  it("collapses whitespace", () => {
    const source = `@type  Alpha  {  id:  string  }`;
    expect(canonicalise(source)).toBe(`@type Alpha { id: string }`);
  });
});
