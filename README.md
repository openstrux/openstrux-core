# openstrux-core

Core runtime library for Openstrux: parser, validator, AST/IR, manifest, lock.

## Status

Pre-implementation. Interfaces to be defined against `openstrux-spec@0.4.x`.

## Packages

| Package | Purpose | Status |
|---|---|---|
| `ast` | Typed AST / IR node definitions | stub |
| `parser` | Parses `.strux` source into AST | stub |
| `validator` | Type-checks, snap validation, scope rules | stub |
| `manifest` | Manifest model and serialisation (`mf.strux.json`) | stub |
| `lock` | Lock file semantics and determinism (`snap.lock`) | stub |
| `conformance` | Shared conformance test library | stub |

## Dependency

Implements `openstrux-spec@0.4.x`. Any breaking spec change requires
a corresponding update here before merge.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
