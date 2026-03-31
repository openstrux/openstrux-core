/**
 * Rod signature table — all 18 basic rod types.
 * Sourced from openstrux-spec/specs/modules/rods/overview.md
 *
 * Each signature defines the container kind of the primary in/out knots
 * for snap chain compatibility checking.
 */

export type ContainerKind = "Stream" | "Single" | "Batch" | "none";

export interface RodSignature {
  readonly rodType: string;
  /** Primary input container kind (null = source rod, no data input) */
  readonly inKind: ContainerKind | null;
  /** Primary output container kind (null = sink rod, no data output) */
  readonly outKind: ContainerKind | null;
  /** Category for documentation */
  readonly category: string;
}

export const ROD_SIGNATURES: ReadonlyMap<string, RodSignature> = new Map([
  // I/O — Data
  [
    "read-data",
    {
      rodType: "read-data",
      inKind: null,
      outKind: "Stream",
      category: "io-data",
    },
  ],
  [
    "write-data",
    {
      rodType: "write-data",
      inKind: "Stream",
      outKind: null,
      category: "io-data",
    },
  ],
  // I/O — Service
  [
    "receive",
    {
      rodType: "receive",
      inKind: null,
      outKind: "Single",
      category: "io-service",
    },
  ],
  [
    "respond",
    {
      rodType: "respond",
      inKind: "Single",
      outKind: "Single",
      category: "io-service",
    },
  ],
  [
    "call",
    {
      rodType: "call",
      inKind: "Single",
      outKind: "Single",
      category: "io-service",
    },
  ],
  // Computation
  [
    "transform",
    {
      rodType: "transform",
      inKind: "Stream",
      outKind: "Stream",
      category: "computation",
    },
  ],
  [
    "filter",
    {
      rodType: "filter",
      inKind: "Stream",
      outKind: "Stream",
      category: "computation",
    },
  ],
  [
    "group",
    {
      rodType: "group",
      inKind: "Stream",
      outKind: "Stream",
      category: "computation",
    },
  ],
  [
    "aggregate",
    {
      rodType: "aggregate",
      inKind: "Stream",
      outKind: "Single",
      category: "computation",
    },
  ],
  [
    "merge",
    {
      rodType: "merge",
      inKind: "Stream",
      outKind: "Stream",
      category: "computation",
    },
  ],
  [
    "join",
    {
      rodType: "join",
      inKind: "Stream",
      outKind: "Stream",
      category: "computation",
    },
  ],
  [
    "window",
    {
      rodType: "window",
      inKind: "Stream",
      outKind: "Stream",
      category: "computation",
    },
  ],
  // Control
  [
    "guard",
    {
      rodType: "guard",
      inKind: "Stream",
      outKind: "Stream",
      category: "control",
    },
  ],
  [
    "store",
    {
      rodType: "store",
      inKind: "Single",
      outKind: "Single",
      category: "control",
    },
  ],
  // Compliance
  [
    "validate",
    {
      rodType: "validate",
      inKind: "Stream",
      outKind: "Stream",
      category: "compliance",
    },
  ],
  [
    "pseudonymize",
    {
      rodType: "pseudonymize",
      inKind: "Stream",
      outKind: "Stream",
      category: "compliance",
    },
  ],
  [
    "encrypt",
    {
      rodType: "encrypt",
      inKind: "Stream",
      outKind: "Stream",
      category: "compliance",
    },
  ],
  // Topology
  [
    "split",
    {
      rodType: "split",
      inKind: "Stream",
      outKind: "Stream",
      category: "topology",
    },
  ],
  // Standard rods (spec: modules/rods/standard/)
  [
    "private-data",
    {
      rodType: "private-data",
      inKind: "Stream",
      outKind: "Stream",
      category: "standard-privacy",
    },
  ],
]);

export function getRodSignature(rodType: string): RodSignature | undefined {
  return ROD_SIGNATURES.get(rodType);
}

/**
 * Check if two container kinds are compatible for snap connections.
 * Null inKind means rod is a source (no data input needed).
 * Null outKind means rod is a sink (no data output).
 */
export function areContainerKindsCompatible(
  out: ContainerKind | null,
  into: ContainerKind | null,
): boolean {
  if (out === null || into === null) return true; // source/sink rods are always OK
  // Single can flow into Single or Stream (broadcast)
  if (out === "Single" && into === "Stream") return true;
  return out === into;
}
