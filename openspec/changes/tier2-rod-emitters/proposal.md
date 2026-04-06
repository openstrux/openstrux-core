## Why

The v0.6.0 release gate requires all 18 basic rod types to be handled without crashing in the Next.js target generator. Five computation rods (group, aggregate, merge, join, window) and one control rod (store) were stubs emitting `// STRUX-STUB` comments. Replacing them with functional implementations completes change package #7 (v0-6-0-rods-target-ts) and removes the "non-demo-capable" classification from panels using these rods.

## What Changes

- 6 new rod emitter modules generating functional TypeScript for the Next.js adapter
- `tier2.ts` converted from stub factory to re-export barrel
- Generator summary simplified: Tier 1/Tier 2 classification removed (all rods now fully emitted)
- 15 new tests replacing 5 stub assertion tests (net +5 tests, total 334)

## Capabilities

### New Capabilities

- `nextjs-computation-rods`: Code generation for group (key-based partitioning), aggregate (count/sum/avg/min/max reduction), merge (array concatenation), join (inner/left/outer key-based join), and window (timestamp batch windowing) rods in the Next.js target adapter
- `nextjs-store-rod`: Code generation for the store rod (state management with get/put/delete/cas/increment modes) in the Next.js target adapter

### Modified Capabilities

## Impact

- `packages/generator/src/adapters/nextjs/rods/` — 6 new files, 2 modified files
- `packages/generator/src/adapters/nextjs/index.ts` — removed Tier 2 imports and stub warning logic
- `packages/generator/src/__tests__/rods.test.ts` — 15 new test cases
- No AST, parser, validator, manifest, lock, or CLI changes
- No breaking changes to public API
