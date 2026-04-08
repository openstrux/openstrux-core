/**
 * @openstrux/parser — public API
 */

// Parser entry point
export { parse, Parser } from "./parser.js";

// Types
export type {
  Diagnostic,
  EnumNode,
  FieldDecl,
  KnotValue,
  NodeLoc,
  PanelAccessNode,
  PanelNode,
  ParseBlockAnnotation,
  ParseFieldAnnotation,
  ParsePkDefault,
  ParseReferentialAction,
  ParseResult,
  ParseTypeExpr,
  RecordNode,
  RodNode,
  StruxNode,
  UnionNode,
  UnionVariantDecl,
} from "./types.js";

export { PRIMITIVE_TYPES } from "./types.js";

// Lexer (for tooling that needs raw tokens)
export { tokenize, TokenType } from "./lexer.js";
export type { Token } from "./lexer.js";

// Synonym normalizer
export { normalizeSynonyms } from "./synonym-normalizer.js";
export type { NormalizeResult } from "./synonym-normalizer.js";
