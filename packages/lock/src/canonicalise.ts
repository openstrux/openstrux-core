/**
 * Source canonicaliser — produces a stable textual form of a .strux source file.
 *
 * Canonical form (RFC-0001 Annex A):
 *   1. Line comments stripped (`//` to end of line, excluding inside strings)
 *   2. @cert blocks stripped (excluded from hash input to avoid circular dependency)
 *   3. Source split into top-level declarations (@type, @panel) by tracking brace depth
 *   4. Whitespace within each declaration normalised (collapsed to single spaces)
 *   5. Declarations sorted alphabetically by name
 *   6. Joined with a single newline
 *
 * The resulting string is then SHA-256 hashed to produce `contentHash`.
 *
 * Shared between @openstrux/lock and @openstrux/manifest to avoid duplication.
 */

import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Deterministic string comparison (byte-order, locale-independent)
// ---------------------------------------------------------------------------

function byteCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Step 1: strip line comments
// ---------------------------------------------------------------------------

export function stripLineComments(source: string): string {
  return source
    .split("\n")
    .map((line) => {
      // Find first // not inside a string literal
      let inString = false;
      for (let i = 0; i < line.length - 1; i++) {
        const ch = line[i]!;
        // Skip escaped characters inside strings
        if (inString && ch === "\\" && i + 1 < line.length) {
          i++;
          continue;
        }
        if (ch === '"') inString = !inString;
        if (!inString && ch === "/" && line[i + 1] === "/") {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Step 2: strip @cert blocks
// ---------------------------------------------------------------------------

export function stripCertBlocks(source: string): string {
  let result = "";
  let i = 0;
  while (i < source.length) {
    // Detect @cert keyword (with word boundary check)
    if (
      source[i] === "@" &&
      source.slice(i, i + 5) === "@cert" &&
      (i + 5 >= source.length || /\s|[{]/.test(source[i + 5]!))
    ) {
      // Advance past @cert
      i += 5;
      // Skip any whitespace before the opening brace
      while (i < source.length && source[i] !== "{") i++;
      // Skip brace-delimited block
      if (i < source.length && source[i] === "{") {
        let depth = 0;
        while (i < source.length) {
          if (source[i] === "{") depth++;
          else if (source[i] === "}") {
            depth--;
            if (depth === 0) {
              i++;
              break;
            }
          }
          i++;
        }
      }
    } else {
      result += source[i];
      i++;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Step 3: split into top-level declarations
// ---------------------------------------------------------------------------

export function splitDeclarations(source: string): string[] {
  const lines = source.split("\n");
  const decls: string[] = [];
  let current: string[] = [];
  let depth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // A new top-level declaration starts when:
    //  - we are at brace depth 0
    //  - the line begins with @type or @panel
    if (depth === 0 && (trimmed.startsWith("@type") || trimmed.startsWith("@panel"))) {
      if (current.length > 0) {
        const text = current.join("\n").trim();
        if (text.length > 0) decls.push(text);
      }
      current = [line];
    } else {
      current.push(line);
    }

    // Update brace depth, tracking strings to avoid counting braces inside them
    let inString = false;
    for (let ci = 0; ci < line.length; ci++) {
      const ch = line[ci]!;
      if (inString && ch === "\\" && ci + 1 < line.length) {
        ci++;
        continue;
      }
      if (ch === '"') inString = !inString;
      if (!inString) {
        if (ch === "{") depth++;
        else if (ch === "}") depth = Math.max(0, depth - 1);
      }
    }
  }

  if (current.length > 0) {
    const text = current.join("\n").trim();
    if (text.length > 0) decls.push(text);
  }

  return decls;
}

// ---------------------------------------------------------------------------
// Step 4: extract declaration name for sorting
// ---------------------------------------------------------------------------

export function getDeclName(decl: string): string {
  // Match "@type Name" or "@panel Name"
  const m = decl.match(/@(?:type|panel)\s+(\S+)/);
  return m?.[1] ?? decl;
}

// ---------------------------------------------------------------------------
// Step 5: normalise whitespace within a declaration
// ---------------------------------------------------------------------------

export function normaliseWhitespace(decl: string): string {
  return decl.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Produce the canonical form of a .strux source file.
 *
 * The canonical form is stable across:
 * - Different declaration order (declarations are sorted alphabetically)
 * - Whitespace changes (collapsed to single spaces)
 * - Comment additions/removals (comments stripped)
 * - @cert block presence/absence (@cert blocks stripped)
 */
export function canonicalise(source: string): string {
  const noComments = stripLineComments(source);
  const noCert = stripCertBlocks(noComments);
  const decls = splitDeclarations(noCert);
  const normalised = decls.map(normaliseWhitespace);
  const sorted = [...normalised].sort((a, b) =>
    byteCompare(getDeclName(a), getDeclName(b))
  );
  return sorted.join("\n");
}

/**
 * Compute the SHA-256 content hash of a .strux source file.
 * Input is first canonicalised; the hash is returned as a lowercase hex string.
 */
export function computeContentHash(source: string): string {
  const canonical = canonicalise(source);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
