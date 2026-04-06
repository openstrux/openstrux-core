## Context

The v0.6.0 audit (C-track) found three gaps: the `@privacy` decorator was defined in the spec (§8 config-inheritance) but the parser never emitted it and the validator had a stub always returning `false`; the `strux build` CLI command had no direct tests; and three of seven privacy diagnostic codes had no test coverage.

All changes are in openstrux-core. The spec already defines `@privacy` syntax and semantics — this is pure implementation catch-up.

## Goals / Non-Goals

**Goals:**
- Parse `@privacy { framework: ..., dpa_ref?: "..." }` inside panel bodies and store it on `PanelNode`
- Wire the validator's `panelHasPrivacyDecorator` to the real AST field so E_PRIVACY_BYPASS fires
- Add direct `strux build` CLI tests covering happy path, error paths, and no-match
- Add test coverage for E_GDPR_INVALID_BASIS_SPECIAL_CATEGORY and E_BDSG_EMPLOYEE_CATEGORY

**Non-Goals:**
- `@privacy` inheritance from `strux.context` (requires context resolution, deferred)
- Framework narrowing/widening validation (deferred — current check is presence-only)
- `@privacy` on `@context` blocks (parser does not yet handle context-level decorators)

## Decisions

**1. Reuse AT_UNKNOWN token for @privacy (same as @ops)**

The lexer already routes unknown `@` keywords to `AT_UNKNOWN`. Rather than adding a new `AT_PRIVACY` token type, we match `AT_UNKNOWN` with value `"@privacy"` inside the panel parse loop. This is the established pattern (`@ops` works identically) and avoids lexer changes.

**2. PanelNode.privacy as Record<string, KnotValue> (not boolean)**

The spec defines `@privacy` as a block with `framework` (required) and `dpa_ref` (optional). Storing it as a `Record<string, KnotValue>` matches how `@dp` is stored and allows future validation of framework narrowing rules without type changes.

**3. Optional field with undefined default**

`privacy` is `undefined` when absent, matching the pattern used by `dp`, `access`, and `ops`. The return expression uses `privacy || undefined` to collapse falsy values.

## Risks / Trade-offs

- **[Risk] @privacy without context inheritance limits real-world utility** → Acceptable for v0.6.0; the panel-level decorator is sufficient for conformance fixtures and E_PRIVACY_BYPASS validation. Context inheritance is tracked for v0.7.
- **[Risk] No framework compatibility validation yet** → The validator only checks presence (`privacy != null`), not whether `private-data` rod frameworks are compatible with the declared `@privacy` framework. This is consistent with the v0.6.0 scope (static tracking only per ADR-010).
