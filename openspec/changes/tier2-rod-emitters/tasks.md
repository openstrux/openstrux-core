## 1. Computation Rod Emitters

- [x] 1.1 Create `packages/generator/src/adapters/nextjs/rods/group.ts` — key-based partitioning with configurable key field
- [x] 1.2 Create `packages/generator/src/adapters/nextjs/rods/aggregate.ts` — count/sum/avg/min/max with configurable field
- [x] 1.3 Create `packages/generator/src/adapters/nextjs/rods/merge.ts` — array concatenation
- [x] 1.4 Create `packages/generator/src/adapters/nextjs/rods/join.ts` — inner/left/outer key-based join with helper function
- [x] 1.5 Create `packages/generator/src/adapters/nextjs/rods/window.ts` — timestamp batch windowing with duration parsing

## 2. Control Rod Emitter

- [x] 2.1 Create `packages/generator/src/adapters/nextjs/rods/store.ts` — get/put/delete/cas/increment with backend and namespace config

## 3. Wiring and Cleanup

- [x] 3.1 Convert `tier2.ts` from stub factory to re-export barrel
- [x] 3.2 Remove Tier 2 stub classification and non-demo-capable warning from `index.ts`
- [x] 3.3 Remove unused `isTier2Rod` and `TIER2_ROD_TYPES` imports from adapter entry

## 4. Tests

- [x] 4.1 Replace 5 stub assertion tests with 15 functional output tests in `rods.test.ts`
- [x] 4.2 Update generator summary test (no longer expects non-demo-capable warning)
- [x] 4.3 Verify all 334 tests pass (`pnpm test`)
