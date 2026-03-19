# @openstrux/ast

Typed AST/IR node definitions for OpenStrux v0.5.

## Responsibility

Defines the intermediate representation (IR) that all OpenStrux tooling operates on. The IR is produced by the parser after normalization and consumed by the validator and emitters.

This package is **types only** — no runtime code. It exports TypeScript interfaces and type aliases.

## Modules

| File | Contents |
|------|----------|
| `common.ts` | `SourceLocation`, `FieldPath`, `TypePath`, `RodType`, `NodeBase` |
| `types.ts` | `TypeRecord`, `TypeEnum`, `TypeUnion`, `NarrowedUnion`, `TypeExpr` |
| `values.ts` | `ValueExpr` union: literals, `EnvRef`, `SecretRef`, `SourceRef`, `TypePathValue` |
| `expressions.ts` | All expression AST nodes: filter, projection, aggregation, group key, join, sort, split routes, guard policy |
| `access.ts` | `AccessContext`, `Principal`, `Intent`, `Scope`, `AuthzResult` |
| `panel.ts` | `Panel`, `Rod`, `SnapEdge`, `DpMetadata`, `OpsConfig`, `ResolvedContext` |
| `index.ts` | Barrel re-export of all public types + `SourceFile` |

## Spec dependency

Implements node types defined in:

- `openstrux-spec/specs/core/ir.md` — IR node types and invariants
- `openstrux-spec/specs/core/type-system.md` — record, enum, union forms
- `openstrux-spec/specs/core/grammar.md` — EBNF productions
- `openstrux-spec/specs/core/expression-shorthand.md` — expression AST
- `openstrux-spec/specs/core/access-context.strux` — AccessContext types
- `openstrux-spec/specs/core/semantics.md` — evaluation model

## Conformance class

Supports **all** conformance levels (Level 1–3). The AST types are the shared vocabulary between parser, validator, and builder.
