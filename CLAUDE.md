# openstrux-core — Core Runtime Library

Parser, validator, AST/IR, manifest, and lock implementation for Openstrux. Implements `openstrux-spec@0.4.x`. Any breaking spec change requires a corresponding update here before merge.

## Folder guide

```
packages/ast/           Typed AST/IR node definitions — mirrors spec type system
packages/parser/        .strux source → AST; handles grammar and syntax errors
packages/validator/     Type-checking, snap validation, scope/certification rules
packages/manifest/      mf.strux.json model: version, content hash, certification scope
packages/lock/          snap.lock semantics and determinism guarantees
packages/conformance/   Shared conformance test library consumed by spec fixtures
docs/                   Implementation-level API docs (not spec-level)
tests/                  Integration tests; unit tests live inside each package
tests/fixtures/valid/   Mirrors conformance/valid/ from openstrux-spec
tests/fixtures/invalid/ Mirrors conformance/invalid/ from openstrux-spec
tests/fixtures/golden/  Mirrors conformance/golden/ from openstrux-spec
```

## Key rules

- `packages/ast/` node definitions MUST stay in sync with `openstrux-spec/specs/core/type-system.md`.
- Conformance fixtures are sourced from `openstrux-spec/conformance/` — do not diverge.
- Generated artifacts (compiled Beam Python, TypeScript) go to `dist/` — never committed.
- Each package has its own `README.md` stating current implementation status.

## Spec reference

The authoritative spec is at `../openstrux-spec`. When in doubt, spec wins.
