/**
 * @openstrux/config — types for strux.context resolution
 */
import type { KnotValue } from "@openstrux/parser";
export type { ResolvedContext, NamedSource, DpMetadata, OpsConfig } from "@openstrux/ast";

export interface ConfigDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly file?: string | undefined;
  readonly line?: number | undefined;
  readonly col?: number | undefined;
}

export interface RawNamedEndpoint {
  readonly name: string;
  readonly config: Record<string, KnotValue>;
  readonly line?: number | undefined;
  readonly col?: number | undefined;
}

export interface RawContextFile {
  readonly path: string;
  readonly dp: Record<string, KnotValue>;
  readonly access: Record<string, KnotValue>;
  readonly ops: Record<string, KnotValue>;
  readonly sec: Record<string, KnotValue>;
  readonly sources: Record<string, RawNamedEndpoint>;
  readonly targets: Record<string, RawNamedEndpoint>;
  readonly hasCert: boolean;
  readonly certLine?: number | undefined;
}

export interface ContextResolutionResult {
  readonly dp: Record<string, KnotValue>;
  readonly access: Record<string, KnotValue>;
  readonly ops: Record<string, KnotValue>;
  readonly sec: Record<string, KnotValue>;
  readonly sources: Record<string, RawNamedEndpoint>;
  readonly targets: Record<string, RawNamedEndpoint>;
  readonly diagnostics: ConfigDiagnostic[];
}
