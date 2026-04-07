/**
 * `strux init` command.
 *
 * 1. Detect installed stack from package.json
 * 2. Match against available adapter manifests
 * 3. Prompt user confirmation
 * 4. Write strux.config.yaml
 * 5. Configure tsconfig.json path aliases for @openstrux/build
 * 6. Add .openstrux/ to .gitignore
 * 7. Write starter .strux file
 * 8. Run strux build
 *
 * Spec reference: openstrux-spec/specs/generator/generator.md §5 / ADR-019 §5
 */

import {
  readFileSync, writeFileSync, existsSync, appendFileSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";

/**
 * Strip single-line `//` comments from JSON text (JSONC-safe parsing).
 * Only strips comments outside string literals, handling `\"` escapes.
 */
function stripJsoncComments(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      let inString = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inString) {
          if (ch === "\\" && i + 1 < line.length) { i++; continue; }
          if (ch === '"') inString = false;
        } else {
          if (ch === '"') { inString = true; continue; }
          if (ch === "/" && line[i + 1] === "/") return line.slice(0, i);
        }
      }
      return line;
    })
    .join("\n");
}
import { createInterface } from "node:readline";
import { BUNDLED_MANIFESTS } from "@openstrux/generator";
import { runBuild } from "./build.js";

// ---------------------------------------------------------------------------
// Stack detection
// ---------------------------------------------------------------------------

interface DetectedStack {
  framework:  string | null;
  orm:        string | null;
  validation: string | null;
  base:       string | null;
  runtime:    string;
}

function detectStack(projectRoot: string): DetectedStack {
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) {
    return { framework: null, orm: null, validation: null, base: null, runtime: "node" };
  }

  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;
  const deps = {
    ...((pkg["dependencies"] as Record<string, string> | undefined) ?? {}),
    ...((pkg["devDependencies"] as Record<string, string> | undefined) ?? {}),
  };

  const resolve_version = (name: string): string | null => {
    const raw = deps[name];
    if (!raw) return null;
    return raw.replace(/^[~^>=<]+/, "");
  };

  const nextVer    = resolve_version("next");
  const prismaVer  = resolve_version("prisma") ?? resolve_version("@prisma/client");
  const zodVer     = resolve_version("zod");
  const tsVer      = resolve_version("typescript");

  return {
    framework:  nextVer    ? `next@${nextVer}`    : null,
    orm:        prismaVer  ? `prisma@${prismaVer}` : null,
    validation: zodVer     ? `zod@${zodVer}`       : null,
    base:       tsVer      ? `typescript@${tsVer}` : null,
    runtime:    "node@>=20",
  };
}

// ---------------------------------------------------------------------------
// Config writing
// ---------------------------------------------------------------------------

function writeStruxConfig(projectRoot: string, stack: DetectedStack): void {
  const lines = [`target:`];
  lines.push(`  base: ${stack.base ?? "typescript@~5.5"}`);
  if (stack.framework) lines.push(`  framework: ${stack.framework}`);
  if (stack.orm)       lines.push(`  orm: ${stack.orm}`);
  if (stack.validation) lines.push(`  validation: ${stack.validation}`);
  lines.push(`  runtime: ${stack.runtime}`);
  lines.push("");
  writeFileSync(join(projectRoot, "strux.config.yaml"), lines.join("\n"), "utf-8");
}

// ---------------------------------------------------------------------------
// tsconfig.json path aliases
// ---------------------------------------------------------------------------

function configureTsconfig(projectRoot: string): void {
  const tsconfigPath = join(projectRoot, "tsconfig.json");
  if (!existsSync(tsconfigPath)) {
    console.warn("strux init: tsconfig.json not found — skipping path alias configuration");
    return;
  }

  let tsconfig: Record<string, unknown>;
  try {
    tsconfig = JSON.parse(stripJsoncComments(readFileSync(tsconfigPath, "utf-8"))) as Record<string, unknown>;
  } catch {
    console.warn("strux init: could not parse tsconfig.json — skipping path alias configuration");
    return;
  }

  const compilerOptions = (tsconfig["compilerOptions"] as Record<string, unknown> | undefined) ?? {};
  const existingPaths = (compilerOptions["paths"] as Record<string, string[]> | undefined) ?? {};

  existingPaths["@openstrux/build"] = [".openstrux/build"];
  existingPaths["@openstrux/build/*"] = [".openstrux/build/*"];
  compilerOptions["paths"] = existingPaths;
  tsconfig["compilerOptions"] = compilerOptions;

  writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + "\n", "utf-8");
}

// ---------------------------------------------------------------------------
// .gitignore
// ---------------------------------------------------------------------------

function addToGitignore(projectRoot: string): void {
  const gitignorePath = join(projectRoot, ".gitignore");
  const entry = ".openstrux/";

  if (existsSync(gitignorePath)) {
    const contents = readFileSync(gitignorePath, "utf-8");
    if (contents.includes(entry)) return;
    appendFileSync(gitignorePath, `\n${entry}\n`, "utf-8");
  } else {
    writeFileSync(gitignorePath, `${entry}\n`, "utf-8");
  }
}

// ---------------------------------------------------------------------------
// Starter .strux file
// ---------------------------------------------------------------------------

const STARTER_STRUX = `// starter.strux — generated by strux init

@type HealthCheck {
  status: string
  timestamp: date
}

@panel health {
  @access { purpose: "monitoring", operation: "read" }
  check = receive {
    trigger: http { method: "GET", path: "/health" }
  }
  respond-ok = respond {
    schema: HealthCheck
  }
}
`;

function writeStarterFile(projectRoot: string): void {
  const dir = join(projectRoot, "src", "strux");
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, "starter.strux");
  if (!existsSync(filePath)) {
    writeFileSync(filePath, STARTER_STRUX, "utf-8");
  }
}

// ---------------------------------------------------------------------------
// Prompt helper
// ---------------------------------------------------------------------------

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function runInit(projectRoot: string = process.cwd()): Promise<void> {
  const stack = detectStack(projectRoot);
  const manifest = BUNDLED_MANIFESTS[0];

  console.log("\n  Detected stack:");
  if (stack.framework)  console.log(`    framework:  ${stack.framework}`);
  if (stack.orm)        console.log(`    orm:        ${stack.orm}`);
  if (stack.validation) console.log(`    validation: ${stack.validation}`);
  if (stack.base)       console.log(`    base:       ${stack.base}`);
  console.log(`    runtime:    ${stack.runtime}`);

  if (stack.framework && manifest) {
    console.log(`\n  Adapter: ${manifest.name}@${manifest.version}`);
  } else {
    console.log(`\n  Warning: no compatible adapter found for detected stack.`);
    console.log(`  Available adapters: ${BUNDLED_MANIFESTS.map(m => m.name).join(", ")}`);
  }

  const answer = await prompt("\n  Proceed with detected stack? [Y/n] ");
  if (answer.toLowerCase() === "n") {
    console.log("  Aborted.");
    return;
  }

  writeStruxConfig(projectRoot, stack);
  console.log("  ✓ Wrote strux.config.yaml");

  configureTsconfig(projectRoot);
  console.log("  ✓ Configured tsconfig.json paths for @openstrux/build");

  addToGitignore(projectRoot);
  console.log("  ✓ Added .openstrux/ to .gitignore");

  writeStarterFile(projectRoot);
  console.log("  ✓ Wrote src/strux/starter.strux");

  await runBuild(projectRoot);
}
