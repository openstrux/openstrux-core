/**
 * Chain composer — walks a panel's rod sequence, calls step emitters in order,
 * and assembles a complete handler function.
 *
 * Spec reference: openstrux-spec/specs/modules/target-nextjs/rods.md §3
 */

import type { Rod, Panel } from "@openstrux/ast";
import type { GeneratedFile } from "../../types.js";
import type { ChainStep, ImportDecl } from "./rods/index.js";
import { dispatchRodStep, getStepHelper } from "./rods/index.js";
import { FILE_HEADER } from "./constants.js";

// ---------------------------------------------------------------------------
// HTTP method helper
//
// The receive rod's cfg.trigger can arrive in several shapes depending on
// parser version and shorthand expansion:
//
// 1. ObjectValue with Record fields: { kind: "ObjectValue", fields: { method: LitString } }
//    — current parser output (v0.6)
// 2. ObjectValue with Array fields:  { kind: "ObjectValue", fields: [{ key, value }] }
//    — legacy parser variant
// 3. Flat object with direct method:  { method: "GET" }
//    — synthetic AST from tests
// 4. Nested config sub-object:        { config: { method: LitString } }
//    — context-resolved trigger
//
// All paths normalise to uppercase method string, defaulting to "GET".
// ---------------------------------------------------------------------------

function httpMethod(rod: Rod): string {
  const trigger = rod.cfg["trigger"];
  if (trigger === undefined || typeof trigger !== "object") return "GET";

  const t = trigger as unknown as Record<string, unknown>;

  // Path 1: direct string (synthetic test AST)
  if (typeof t["method"] === "string") return t["method"].toUpperCase();

  // Path 2: ObjectValue with Record-shaped fields (current parser)
  if (t["kind"] === "ObjectValue" && typeof t["fields"] === "object" && t["fields"] !== null && !Array.isArray(t["fields"])) {
    const fields = t["fields"] as Record<string, unknown>;
    const mv = fields["method"] as Record<string, unknown> | undefined;
    if (mv?.["kind"] === "LitString" && typeof mv["value"] === "string") {
      return (mv["value"] as string).toUpperCase();
    }
  }

  // Path 3: ObjectValue with Array-shaped fields (legacy parser)
  if (t["kind"] === "ObjectValue" && Array.isArray(t["fields"])) {
    for (const entry of t["fields"] as Array<Record<string, unknown>>) {
      if (entry["key"] === "method" && entry["value"] && typeof entry["value"] === "object") {
        const mv = entry["value"] as Record<string, unknown>;
        if (mv["kind"] === "LitString" && typeof mv["value"] === "string") {
          return (mv["value"] as string).toUpperCase();
        }
      }
    }
  }

  // Path 4: nested config sub-object (context-resolved)
  const config = t["config"] as Record<string, unknown> | undefined;
  if (config !== undefined) {
    const m = config["method"] as Record<string, unknown> | undefined;
    if (m?.["kind"] === "LitString" && typeof m["value"] === "string") {
      return (m["value"] as string).toUpperCase();
    }
  }

  return "GET";
}

// ---------------------------------------------------------------------------
// Import deduplication
// ---------------------------------------------------------------------------

function mergeImports(all: ImportDecl[]): ImportDecl[] {
  const map = new Map<string, Set<string>>();
  for (const decl of all) {
    const existing = map.get(decl.from);
    if (existing === undefined) {
      map.set(decl.from, new Set(decl.names));
    } else {
      for (const n of decl.names) existing.add(n);
    }
  }
  return Array.from(map.entries()).map(([from, names]) => ({
    names: Array.from(names).sort(),
    from,
  }));
}

function renderImports(imports: ImportDecl[]): string {
  return imports
    .map(d => `import { ${d.names.join(", ")} } from "${d.from}";`)
    .join("\n");
}

// ---------------------------------------------------------------------------
// composeHandler — the main chain composition function
// ---------------------------------------------------------------------------

export function composeHandler(panelName: string, rods: Rod[], panel: Panel): GeneratedFile {
  const receiveRod = rods.find(r => r.rodType === "receive");
  const method = receiveRod ? httpMethod(receiveRod) : "GET";

  // Run all step emitters, tracking [rod, step] pairs
  const rodSteps: Array<{ rod: Rod; step: ChainStep }> = [];
  let currentVar  = "req";
  let currentType = "NextRequest";

  for (const rod of rods) {
    const ctx = {
      panel,
      previousSteps: rodSteps.map(rs => rs.step),
      inputVar:  currentVar,
      inputType: currentType,
    };
    const step = dispatchRodStep(rod, ctx);
    rodSteps.push({ rod, step });
    if (step.outputVar !== "(returned)") {
      currentVar  = step.outputVar;
      currentType = step.outputType;
    }
  }

  // Collect all imports (NextRequest/NextResponse always included)
  const allImports: ImportDecl[] = [
    { names: ["NextRequest", "NextResponse"], from: "next/server" },
    ...rodSteps.flatMap(rs => rs.step.imports),
  ];
  const mergedImports = mergeImports(allImports);

  // Collect preamble functions (transform, guard, and any other rod that sets _helperFn)
  const preambles: string[] = [];
  for (const { step } of rodSteps) {
    const helper = getStepHelper(step);
    if (helper !== undefined) preambles.push(helper);
  }

  // Build handler body — each rod's statement is indented; receive is always first
  const bodyLines: string[] = [];
  for (const { rod, step } of rodSteps) {
    // receive: the statement is already "const body = await req.json();" — put it first
    if (rod.rodType === "receive") {
      bodyLines.unshift(`  ${step.statement}`);
      continue;
    }
    // respond: keep as-is (will contain return statement)
    for (const line of step.statement.split("\n")) {
      bodyLines.push(`  ${line}`);
    }
  }

  // Auto-append return if no explicit respond step
  const hasReturn = rodSteps.some(rs => rs.step.outputVar === "(returned)");
  if (!hasReturn) {
    const statusCode = method === "POST" ? 201 : 200;
    bodyLines.push(`  return NextResponse.json(${currentVar}, { status: ${statusCode} });`);
  }

  const preambleBlock = preambles.length > 0 ? "\n" + preambles.join("\n\n") + "\n" : "";
  const importBlock = renderImports(mergedImports);

  const content = [
    FILE_HEADER,
    importBlock,
    preambleBlock,
    `export async function ${method}(req: NextRequest): Promise<NextResponse> {`,
    bodyLines.join("\n"),
    `}`,
    ``,
  ].join("\n");

  return { path: `handlers/${panelName}.ts`, content, lang: "typescript" };
}
