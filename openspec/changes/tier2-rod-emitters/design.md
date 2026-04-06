## Context

The Next.js target adapter generates TypeScript route handlers by composing `ChainStep` objects emitted by per-rod functions. Thirteen rod types + private-data standard rod already produce functional output. Six rods (group, aggregate, merge, join, window, store) emitted stub comments via a shared `makeStub()` factory in `tier2.ts`. The spec defines their signatures in `openstrux-spec/specs/modules/rods/overview.md`.

## Goals / Non-Goals

**Goals:**
- All 18 basic rod types generate functional TypeScript in the Next.js adapter
- Each emitter follows the established pattern: `(Rod, ChainContext) → ChainStep`
- Rod config is extracted from `rod.cfg` / `rod.arg` per spec knot definitions
- Tests verify functional output (not just absence of crashes)

**Non-Goals:**
- Multi-input snap wiring (join's second input, merge's N inputs) — requires chain composer changes
- Streaming semantics for window rod — Next.js is batch-only
- Runtime state store adapter generation — store emits calls against a `stateStore` interface
- Golden fixture files for Tier 2 rods — deferred until output stabilizes

## Decisions

**One file per rod** — Each emitter gets a dedicated module (`group.ts`, `aggregate.ts`, etc.) rather than keeping them in `tier2.ts`. This matches the Tier 1 pattern and makes diffs reviewable per-rod. `tier2.ts` becomes a re-export barrel.

**getCfgString duplication** — Each emitter contains a local `getCfgString()` helper, matching the existing pattern in `call.ts` and `transform.ts`. A shared utility extraction is tracked as a separate code review item (C.6) to avoid scope creep.

**aggregate output type is `number`** — All built-in aggregation functions (count, sum, avg, min, max) produce numeric results. The output type is hardcoded to `number` rather than attempting to infer from input types.

**join generates a named helper function** — Following the `transform` pattern of injecting helper functions, `join` creates a `join{PascalName}()` function that builds a right-side Map index. This keeps the main chain statement clean.

**window uses bucket assignment** — For non-streaming Next.js, temporal windowing is implemented as `Math.floor(ts / sizeMs) * sizeMs` bucket assignment. This produces `Record<string, T[]>` grouped by window start timestamp.

**store references external `stateStore`** — Rather than generating a state store implementation (which depends on backend choice), the emitter generates calls to a `stateStore` object that must be provided by the project runtime.

## Risks / Trade-offs

**[join only receives one input in linear chains]** → In the current linear chain model, join receives only the upstream output. The second input (`rightData`) is a placeholder variable. This is acceptable because explicit snap wiring (which provides multi-input) is not yet implemented in the chain composer. When it is, the join emitter's `rightVar` parameter will be wired automatically.

**[window only implements fixed bucketing]** → Sliding and session window semantics differ from fixed, but the batch context makes them all equivalent to bucket assignment. True streaming window semantics would require a different adapter (e.g., Beam/Flink).

**[aggregate spreads large arrays]** → `Math.min(...arr)` and `Math.max(...arr)` spread the entire array as arguments. For very large datasets this could hit the call stack limit. Acceptable for the Next.js target which processes HTTP request payloads, not bulk pipelines.
