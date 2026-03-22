# openstrux-core

Core runtime library for Openstrux: parser, validator, AST/IR, generator, and CLI.

## Status

v0.6 — implements `openstrux-spec@0.5.x` with ADR-019 native package output.

## Packages

| Package | Purpose | Status |
|---|---|---|
| `ast` | Typed AST / IR node definitions | active |
| `parser` | Parses `.strux` source into AST | active |
| `validator` | Type-checks, snap validation, scope rules | active |
| `generator` | Code generation engine: adapters, `emit()` + `package()` | active |
| `cli` | `strux build`, `strux init`, `strux doctor` | active |
| `manifest` | Manifest model and serialisation (`mf.strux.json`) | active |
| `lock` | Lock file semantics and determinism (`snap.lock`) | stub |
| `conformance` | Shared conformance test library | active |

## Quick start

```bash
# In your Next.js project:
npm install --save-dev @openstrux/cli
npx strux init
npx strux build
```

Import the generated output:

```typescript
// app/api/proposals/route.ts
export { POST } from "@openstrux/build/handlers/intake-proposals.js";
```

See `docs/getting-started.md` in the hub repo for the full onboarding guide.

## CLI commands

| Command | Description |
|---|---|
| `strux init` | Detect stack, write `strux.config.yaml`, configure `tsconfig.json`, create starter file |
| `strux build` | Parse `.strux` files → emit → package → write to `.openstrux/build/` |
| `strux doctor` | Check config, adapter resolution, and `tsconfig.json` path aliases |

## Programmatic usage

```typescript
import { build, promote } from "@openstrux/generator";
import { parse } from "@openstrux/parser";

const result = parse(source);
const ast = promote(result.ast);
const { files, pkg } = build(ast, {}, { framework: "next" });
// files: GeneratedFile[] — source files
// pkg.outputDir: ".openstrux/build"
// pkg.metadata: package.json, tsconfig.json
// pkg.entrypoints: index.ts, schemas/index.ts, handlers/index.ts
```

## Dependency

Implements `openstrux-spec@0.5.x` with ADR-019. Any breaking spec change requires
a corresponding update here before merge.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
