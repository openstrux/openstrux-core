/**
 * ChainStep types for the Next.js adapter rod emitters.
 *
 * Spec reference: openstrux-spec/specs/modules/target-nextjs/rods.md §2
 */

import type { Panel } from "@openstrux/ast";

export interface ImportDecl {
  names: string[];
  from: string;
  typeOnly?: boolean;
}

export interface ChainStep {
  imports: ImportDecl[];
  statement: string;
  outputVar: string;
  outputType: string;
}

export interface ChainContext {
  panel: Panel;
  previousSteps: ChainStep[];
  inputVar: string;
  inputType: string;
}

export type RodStepEmitter = (rod: import("@openstrux/ast").Rod, ctx: ChainContext) => ChainStep;
