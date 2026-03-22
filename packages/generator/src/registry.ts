/**
 * Adapter registry — maps framework names to Adapter implementations.
 *
 * Spec reference: openstrux-spec/specs/generator/generator.md §3
 */

import type { Adapter } from "./types.js";
import { UnknownTargetError } from "./types.js";

const registry: Map<string, Adapter> = new Map();

/**
 * Register an adapter for a given framework name (e.g. "nextjs").
 * If a framework is already registered, it is replaced.
 */
export function registerAdapter(framework: string, adapter: Adapter): void {
  registry.set(framework, adapter);
}

/**
 * Retrieve the adapter for a given framework name.
 * Throws `UnknownTargetError` if no adapter is registered for that framework.
 */
export function getAdapter(framework: string): Adapter {
  const adapter = registry.get(framework);
  if (adapter === undefined) throw new UnknownTargetError(framework);
  return adapter;
}

/** Returns all registered framework names. */
export function listTargets(): string[] {
  return Array.from(registry.keys());
}
