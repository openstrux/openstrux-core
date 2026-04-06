/**
 * Shared config extraction utilities for rod emitters.
 *
 * These type-guarded helpers replace the `as unknown as` casts previously
 * duplicated across individual rod emitters (call, transform, group, etc.).
 */

import type { Rod } from "@openstrux/ast";

/**
 * Extract a string value from a rod's cfg map.
 * Handles LitString AST nodes and plain string values.
 */
export function getCfgString(rod: Rod, key: string): string | undefined {
  const val = rod.cfg[key] as unknown as Record<string, unknown> | undefined;
  if (val === undefined) return undefined;
  if (val["kind"] === "LitString" && typeof val["value"] === "string") return val["value"] as string;
  if (typeof val === "string") return val;
  return undefined;
}

/**
 * Extract a number value from a rod's cfg map.
 * Handles LitNumber AST nodes and plain number values.
 */
export function getCfgNumber(rod: Rod, key: string): number | undefined {
  const val = rod.cfg[key] as unknown as Record<string, unknown> | undefined;
  if (val === undefined) return undefined;
  if (val["kind"] === "LitNumber" && typeof val["value"] === "number") return val["value"] as number;
  if (typeof val === "number") return val;
  return undefined;
}

/**
 * Extract a boolean value from a rod's cfg map.
 * Handles LitBool AST nodes and plain boolean values.
 */
export function getCfgBool(rod: Rod, key: string): boolean | undefined {
  const val = rod.cfg[key] as unknown as Record<string, unknown> | undefined;
  if (val === undefined) return undefined;
  if (val["kind"] === "LitBool" && typeof val["value"] === "boolean") return val["value"] as boolean;
  if (typeof val === "boolean") return val;
  return undefined;
}

/**
 * Extract a type name from a rod's cfg map.
 * Handles TypeRef AST nodes and resolvedType strings.
 */
export function getCfgTypeName(rod: Rod, key: string): string | undefined {
  const val = rod.cfg[key] as unknown as Record<string, unknown> | undefined;
  if (val === undefined) return undefined;
  if (val["kind"] === "TypeRef" && typeof val["name"] === "string") return val["name"] as string;
  if (typeof val["resolvedType"] === "string") return val["resolvedType"] as string;
  return undefined;
}
