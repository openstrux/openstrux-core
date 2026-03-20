/**
 * Adapter registry — maps target names to Adapter implementations.
 *
 * Spec reference: openstrux-spec/rfcs/RFC-0001-typescript-target-adapter.md §Adapter Registry
 */

import type { Adapter } from "./types.js";
import { UnknownTargetError } from "./types.js";

const registry: Map<string, Adapter> = new Map();

/**
 * Register an adapter for a given target name.
 * If a target is already registered, it is replaced.
 */
export function registerAdapter(target: string, adapter: Adapter): void {
  registry.set(target, adapter);
}

/**
 * Retrieve the adapter for a given target name.
 * Throws `UnknownTargetError` if no adapter is registered for that target.
 */
export function getAdapter(target: string): Adapter {
  const adapter = registry.get(target);
  if (adapter === undefined) throw new UnknownTargetError(target);
  return adapter;
}

/** Returns all registered target names. */
export function listTargets(): string[] {
  return Array.from(registry.keys());
}
