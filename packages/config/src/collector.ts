/**
 * Walk ancestor directories from a panel path to project root,
 * collecting strux.context files in order (project root → nearest dir).
 * CI-001
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseContextFile } from "./context-parser.js";
import type { ConfigDiagnostic, RawContextFile } from "./types.js";

const CONTEXT_FILENAME = "strux.context";
const MAX_ANCESTOR_DEPTH = 50; // safety limit

/**
 * Collect all strux.context files from project root to panelDir (inclusive).
 * Returns files in cascade order: [project-root, ..., panel-dir].
 * Nearest-wins on merge (panel-dir wins).
 */
export function collectContextFiles(
  panelPath: string,
  projectRoot?: string | undefined,
): {
  files: RawContextFile[];
  diagnostics: ConfigDiagnostic[];
} {
  const diagnostics: ConfigDiagnostic[] = [];
  const panelDir = dirname(resolve(panelPath));
  const root =
    projectRoot !== undefined
      ? resolve(projectRoot)
      : findProjectRoot(panelDir);

  const dirs: string[] = [];
  let current = panelDir;
  let depth = 0;

  while (depth < MAX_ANCESTOR_DEPTH) {
    dirs.push(current);
    if (current === root) break;
    const parent = dirname(current);
    if (parent === current) break; // filesystem root
    current = parent;
    depth++;
  }

  // Reverse so we go from root → panel dir (nearest wins on merge)
  dirs.reverse();

  const files: RawContextFile[] = [];
  for (const dir of dirs) {
    const contextPath = join(dir, CONTEXT_FILENAME);
    if (existsSync(contextPath)) {
      const source = readFileSync(contextPath, "utf-8");
      const { raw, diagnostics: pd } = parseContextFile(source, contextPath);
      files.push(raw);
      diagnostics.push(...pd);
    }
  }

  return { files, diagnostics };
}

function findProjectRoot(startDir: string): string {
  const markers = ["pnpm-workspace.yaml", "package.json", ".git"];
  let current = startDir;
  for (let i = 0; i < MAX_ANCESTOR_DEPTH; i++) {
    for (const marker of markers) {
      if (existsSync(join(current, marker))) return current;
    }
    const parent = dirname(current);
    if (parent === current) return startDir;
    current = parent;
  }
  return startDir;
}
