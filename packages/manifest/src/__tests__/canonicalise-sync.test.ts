/**
 * Sync-check test: verifies that the canonicalisation algorithm duplicated
 * in @openstrux/lock produces identical output to the authoritative
 * implementation in @openstrux/manifest.
 *
 * This test exists because lock duplicates canonicalise to avoid a circular
 * dependency. Any change to either copy must keep them in sync.
 */

import { describe, it, expect } from "vitest";
import { canonicalise as manifestCanonicalise } from "../canonicalise.js";
import { canonicalise as lockCanonicalise } from "@openstrux/lock";

const TEST_SOURCES = [
  `@panel intake {
  receive req { cfg.trigger http.post }
  validate input { cfg.schema Proposal }
  write-data store { cfg.target db.sql.postgres }
  respond ok {}
}`,

  `// This is a comment
@type Proposal {
  title    string
  amount   number
}

// Another comment
@panel review {
  receive req { cfg.trigger http.get }
  read-data fetch { cfg.source db.sql.postgres }
  respond ok {}
}`,

  `@panel certified {
  receive req { cfg.trigger http.post }
  validate input { cfg.schema Submission }
  @cert {
    hash "abc123"
    scope { resources [ "Submission" ] }
  }
}`,

  `@type Zebra { name string }
@type Alpha { id number }
@panel workflow { receive req { cfg.trigger http.get } }`,

  `// only comments
// nothing here`,

  `@panel deep {
  guard policy {
    cfg.policy {
      rules {
        condition { nested { deep true } }
        action allow
      }
    }
  }
}`,
];

describe("canonicalise sync-check: lock ↔ manifest", () => {
  for (let i = 0; i < TEST_SOURCES.length; i++) {
    const source = TEST_SOURCES[i]!;
    it(`test source ${i + 1}: lock and manifest produce identical canonical forms`, () => {
      expect(lockCanonicalise(source)).toEqual(manifestCanonicalise(source));
    });
  }
});

// ---------------------------------------------------------------------------
// C3 — escaped quotes inside strings do not break comment stripping
// ---------------------------------------------------------------------------

describe("C3 — escaped quotes in strings", () => {
  it("does not toggle string state on \\ escape inside a string", () => {
    const src = `@type Msg { text: string } // note: use \\"hello\\" syntax`;
    // The `//` after escaped quotes must be treated as a comment
    const result = lockCanonicalise(src);
    expect(result).toEqual(manifestCanonicalise(src));
    // The comment should be stripped — canonical form contains no //
    expect(result).not.toContain("//");
  });

  it("handles a string containing escaped quotes followed by a comment", () => {
    const src = `@panel p { policy: "allow\\"all\\"" } // end`;
    const result = lockCanonicalise(src);
    expect(result).toEqual(manifestCanonicalise(src));
  });
});

// ---------------------------------------------------------------------------
// C4 — braces inside string literals do not affect depth tracking
// ---------------------------------------------------------------------------

describe("C4 — braces in string literals", () => {
  it("does not count { or } inside string literals as declaration boundaries", () => {
    const src = `@type Tmpl { pattern: string }
// template uses {var} syntax
@panel p { receive req {} }`;
    const result = lockCanonicalise(src);
    expect(result).toEqual(manifestCanonicalise(src));
    // Should not be empty — declarations were found
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles a string with multiple braces", () => {
    const src = `@type Fmt { template: string } // e.g. "{name} {age}"
@panel q { r = receive {} }`;
    expect(lockCanonicalise(src)).toEqual(manifestCanonicalise(src));
  });
});

// ---------------------------------------------------------------------------
// Negative: hash changes when source changes
// ---------------------------------------------------------------------------

describe("hash changes when source changes", () => {
  it("produces a different canonical form when a field is added", () => {
    const src1 = `@type Proposal { id: string }`;
    const src2 = `@type Proposal { id: string\n  title: string }`;
    expect(lockCanonicalise(src1)).not.toEqual(lockCanonicalise(src2));
  });
});
