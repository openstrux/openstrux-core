## Why

The v0.6.0 release audit identified three code review gaps: no direct `strux build` CLI tests, the `@privacy` decorator was stubbed as unreachable code in the validator, and privacy validation rules lacked test coverage for three out of seven diagnostic codes. These gaps weaken release confidence for the privacy and CLI surface areas.

## What Changes

- **Parser**: Add `@privacy { framework, dpa_ref? }` block decorator support on `PanelNode`, matching spec §8 (config-inheritance). The parser now recognises `@privacy` inside panel bodies and stores it as a `Record<string, KnotValue>`.
- **Validator**: Wire `panelHasPrivacyDecorator` to the real `PanelNode.privacy` field (was a stub returning `false`). E_PRIVACY_BYPASS now fires when `@privacy` is declared without a `private-data` rod.
- **CLI tests**: Add `build.test.ts` covering happy-path output, missing config error, parse error propagation, and no-match warning.
- **Privacy validator tests**: Add coverage for E_PRIVACY_BYPASS (positive + negative), E_GDPR_INVALID_BASIS_SPECIAL_CATEGORY, and E_BDSG_EMPLOYEE_CATEGORY.
- **Housekeeping**: Move `packages/diagnostics.md` to `docs/diagnostics.md` to fix Vitest/esbuild loader conflict.

## Capabilities

### New Capabilities

- `privacy-decorator`: Parser and validator support for the `@privacy` block decorator on panels, enabling E_PRIVACY_BYPASS enforcement.

### Modified Capabilities

_(none — no spec-level requirement changes; this implements existing spec §8)_

## Impact

- **packages/parser**: `PanelNode` type gains `privacy?: Record<string, KnotValue>` field; parser recognises `@privacy` as a panel-body decorator.
- **packages/validator**: `privacy-validator.ts` now reads `panel.privacy` instead of always returning `false`.
- **packages/cli**: New test file `build.test.ts` (5 test cases).
- **packages/parser tests**: 2 new `@privacy` parse tests in `diagnostics.test.ts`.
- **packages/validator tests**: 6 new privacy validator test cases.
- **No breaking changes** — `PanelNode.privacy` is optional; existing consumers unaffected.
