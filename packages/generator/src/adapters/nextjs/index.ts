/**
 * Next.js target adapter — implements RFC-0001 + ADR-019 for Next.js/Prisma/Zod.
 *
 * Spec reference: openstrux-spec/specs/modules/target-nextjs/generator.md
 *                 openstrux-spec/specs/modules/target-nextjs/rods.md
 */

import type { TypeRecord } from "@openstrux/ast";
import type { Panel, Rod } from "@openstrux/ast";
import type {
  Adapter,
  GeneratedFile,
  Manifest,
  PackageOutput,
  ResolvedOptions,
  TopLevelNode,
} from "../../types.js";
import { emitRecord, emitEnum, emitUnion, emitZodSchema, emitPrismaSchema } from "../ts-base/index.js";
import { composeHandler } from "./chain.js";

import { FILE_HEADER } from "./constants.js";

// ---------------------------------------------------------------------------
// guard file emitter
// ---------------------------------------------------------------------------

function emitGuardFile(panel: Panel, _guardRod: Rod): GeneratedFile {
  const panelName = panel.name;
  const access = panel.access as unknown as Record<string, unknown>;
  const intent = access?.["intent"] as Record<string, unknown> | undefined;
  const purpose = intent ? String(intent["purpose"] ?? "") : "";
  const operation = intent ? String(intent["operation"] ?? "") : "";

  const pascal = panelName
    .split(/[-_]/)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");

  const content = `${FILE_HEADER}
import { NextRequest, NextResponse } from "next/server";
import type { AccessContext } from "@openstrux/runtime";

export interface ${pascal}AccessContext extends AccessContext {
  purpose: "${purpose}";
  operation: "${operation}";
}

export async function withGuard(
  req: NextRequest,
  handler: (req: NextRequest, ctx: ${pascal}AccessContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const ctx = {} as ${pascal}AccessContext;
  return handler(req, ctx);
}
`;
  return { path: `guards/${panelName}.guard.ts`, content, lang: "typescript" };
}

// ---------------------------------------------------------------------------
// Prisma singleton utility (always emitted when Prisma is used)
// ---------------------------------------------------------------------------

const PRISMA_UTIL: GeneratedFile = {
  path: "lib/prisma.ts",
  lang: "typescript",
  content: `${FILE_HEADER}
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
`,
};

// ---------------------------------------------------------------------------
// emit() — produce all source files from AST
// ---------------------------------------------------------------------------

function emit(
  ast: TopLevelNode[],
  _manifest: Manifest,
  _options: ResolvedOptions
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const prismaBlocks: string[] = [];
  let hasPrisma = false;

  const enumNames = new Set<string>();
  for (const node of ast) {
    if (node.kind === "TypeEnum") enumNames.add(node.name);
  }

  const recordMap = new Map<string, TypeRecord>();
  for (const node of ast) {
    if (node.kind === "TypeRecord") recordMap.set(node.name, node);
  }

  // 1. @type nodes
  for (const node of ast) {
    switch (node.kind) {
      case "TypeRecord": files.push(emitRecord(node, enumNames, prismaBlocks)); break;
      case "TypeEnum":   files.push(emitEnum(node, prismaBlocks));             break;
      case "TypeUnion":  files.push(emitUnion(node));                          break;
    }
  }

  // 2. @panel nodes
  for (const node of ast) {
    if (node.kind !== "Panel") continue;
    const panel = node as Panel;
    const rods = panel.rods as Rod[];

    const guardRod    = rods.find(r => r.rodType === "guard");
    const validateRods = rods.filter(r => r.rodType === "validate");
    const hasWrite    = rods.some(r => r.rodType === "write-data" || r.rodType === "store");
    const hasRead     = rods.some(r => r.rodType === "read-data");

    // Handler file (chain-composed)
    const routeRodTypes = new Set(["receive", "respond", "store", "write-data", "read-data", "call", "split", "transform", "filter", "validate", "guard", "pseudonymize", "encrypt", "group", "aggregate", "merge", "join", "window"]);
    if (rods.some(r => routeRodTypes.has(r.rodType))) {
      files.push(composeHandler(panel.name, rods, panel));
    }

    // Guard file
    if (guardRod !== undefined) {
      files.push(emitGuardFile(panel, guardRod));
    }

    // Zod schema files
    for (const rod of validateRods) {
      const schemaCfg = rod.cfg["schema"] as unknown as Record<string, unknown> | undefined;
      if (schemaCfg?.["kind"] === "TypeRef" && typeof schemaCfg["name"] === "string") {
        const typeName = schemaCfg["name"] as string;
        const record = recordMap.get(typeName);
        if (record !== undefined) {
          files.push(emitZodSchema(typeName, record, enumNames));
        }
      }
    }

    if (hasWrite || hasRead) hasPrisma = true;
  }

  // 3. Prisma schema + client utility
  if (prismaBlocks.length > 0) {
    files.push(emitPrismaSchema(prismaBlocks));
  }
  if (hasPrisma) {
    files.push(PRISMA_UTIL);
  }

  // 4. Summary log
  emitSummary(ast);

  return files;
}

// ---------------------------------------------------------------------------
// package() — produce ecosystem metadata and barrel exports
// ---------------------------------------------------------------------------

function pkg(files: GeneratedFile[]): PackageOutput {
  const typePaths   = files.filter(f => f.path.startsWith("types/")).map(f => f.path);
  const schemaPaths = files.filter(f => f.path.startsWith("schemas/") && !f.path.endsWith("index.ts")).map(f => f.path);
  const handlerPaths = files.filter(f => f.path.startsWith("handlers/") && !f.path.endsWith("index.ts")).map(f => f.path);

  // Root index.ts — enums get value exports, all others get type exports, sorted by name
  const allRootExports = typePaths.map(p => {
    const name = p.replace("types/", "").replace(".ts", "");
    const isEnum = files.find(f => f.path === p)?.content.includes("export enum ");
    const keyword = isEnum === true ? "" : "type ";
    return { name, line: `export ${keyword}{ ${name} } from "./${p.replace(".ts", ".js")}";` };
  });
  allRootExports.sort((a, b) => a.name.localeCompare(b.name));

  const rootIndex: GeneratedFile = {
    path: "index.ts",
    lang: "typescript",
    content: `${FILE_HEADER}\n${allRootExports.map(e => e.line).join("\n")}\n`,
  };

  // schemas/index.ts
  const schemaExports = schemaPaths.flatMap(p => {
    const name = p.replace("schemas/", "").replace(".schema.ts", "");
    return [
      `export { ${name}Schema } from "./${name}.schema.js";`,
      `export type { ${name}Input } from "./${name}.schema.js";`,
    ];
  });
  const schemasIndex: GeneratedFile = {
    path: "schemas/index.ts",
    lang: "typescript",
    content: `${FILE_HEADER}\n${schemaExports.join("\n")}\n`,
  };

  // handlers/index.ts
  const handlerExports = handlerPaths.map(p => {
    const panelName = p.replace("handlers/", "").replace(".ts", "");
    const camel = panelName.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    return `export { POST as ${camel} } from "./${panelName}.js";`;
  });
  const handlersIndex: GeneratedFile = {
    path: "handlers/index.ts",
    lang: "typescript",
    content: `${FILE_HEADER}\n${handlerExports.join("\n")}\n`,
  };

  // package.json
  const packageJson: GeneratedFile = {
    path: "package.json",
    lang: "json",
    content: JSON.stringify({
      name: "@openstrux/build",
      version: "0.0.0",
      private: true,
      type: "module",
      exports: {
        ".":          { types: "./index.ts" },
        "./schemas":  { types: "./schemas/index.ts" },
        "./handlers": { types: "./handlers/index.ts" },
      },
    }, null, 2) + "\n",
  };

  // tsconfig.json
  const tsconfigJson: GeneratedFile = {
    path: "tsconfig.json",
    lang: "json",
    content: JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        declaration: true,
        composite: true,
        outDir: "./dist",
      },
    }, null, 2) + "\n",
  };

  return {
    outputDir: ".openstrux/build",
    metadata: [packageJson, tsconfigJson],
    entrypoints: [rootIndex, schemasIndex, handlersIndex],
  };
}

// ---------------------------------------------------------------------------
// Generator summary
// ---------------------------------------------------------------------------

function emitSummary(ast: TopLevelNode[]): void {
  let rodCount = 0;

  for (const node of ast) {
    if (node.kind !== "Panel") continue;
    const panel = node as Panel;
    const rods = panel.rods as Rod[];
    for (const rod of rods) {
      void rod;
      rodCount++;
    }
  }

  if (rodCount === 0) return;
  console.log(
    `[openstrux-generator] Summary: ${rodCount} rod(s) emitted`
  );
}

// ---------------------------------------------------------------------------
// Export adapter
// ---------------------------------------------------------------------------

export const NextJsAdapter: Adapter = {
  name: "nextjs",
  emit,
  package: pkg,
};
