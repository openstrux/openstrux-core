# @openstrux/ast Changelog

## [Unreleased] — v0.6.0-alpha.0 (change: v0-6-0-toolchain-bootstrap)

### Modified

#### `access.ts`
- `ResourceGrant.condition` (string) → `conditions` (Record<string, string>): aligns with spec `access-context.strux` which declares `conditions: Map<string, string>`
- `TimeWindow.from` and `TimeWindow.to`: changed from required `string` to optional `string | undefined` — spec uses `Optional<date>`
- `AccessContext`: added `ts?: string` (request timestamp — WHEN) and `evaluated?: boolean` (policy evaluation flag), both present in `access-context.strux`

#### `panel.ts`
- `DpMetadata`: added explicit `basis?: string` and `fields?: Record<string, string>` — aligns with syntax-reference `@dp { ..., basis?, fields? }`; updated index signature to include `Record<string, string>`
- `OpsConfig`: added explicit `circuitBreaker?: boolean`, `rateLimit?: string`, `fallback?: string` — aligns with syntax-reference `@ops { ..., circuit_breaker?, rate_limit?, fallback? }`; updated index signature to include `boolean`
- `CertMetadata`: added explicit `hash?: string` and `version?: string` — aligns with syntax-reference `@cert { scope, hash, version }`

### No changes required
- `common.ts`: `SourceLocation`, `SourceSpan`, `NodeBase`, `FieldPath`, `TypePath`, `RodType` (18 types), `KnotDir`, `PrimitiveTypeName`, `ContainerKind` — all match spec
- `types.ts`: `TypeRecord`, `TypeEnum`, `TypeUnion`, `NarrowedUnion`, `TypeExpr`, `FieldDecl` — all match spec; `@type` keyword reflected in node names
- `values.ts`: `ValueExpr` union covers all 11 value forms from grammar.md §6 — complete
- `expressions.ts`: all 8 expression categories covered (filter, projection, aggregation, group key, join condition, sort, split routes, guard policy) — complete
- `index.ts`: barrel exports complete; `SourceFile` exports `types: readonly TypeDef[]` and `panels: readonly Panel[]`

## [0.5.0-alpha.0] — Initial implementation

Initial typed AST/IR node definitions for OpenStrux v0.5.
