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
