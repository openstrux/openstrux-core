/**
 * @openstrux/ast — Typed AST/IR node definitions for OpenStrux v0.5.
 *
 * This package defines the intermediate representation that all OpenStrux
 * tooling operates on. The IR is produced by the parser after normalization
 * and consumed by the validator and emitters.
 *
 * Spec reference: openstrux-spec/specs/core/ir.md
 */

// Common types
export type {
  BasicContainerKind,
  BasicPrimitiveTypeName,
  BasicRodType,
  ContainerKind,
  FieldPath,
  KnotDir,
  NodeBase,
  PrimitiveTypeName,
  RodType,
  SourceLocation,
  SourceSpan,
  TopLevelNodeKind,
  TypePath,
} from "./common.js";

// Type system nodes
export type {
  ConstrainedNumberType,
  ConstrainedStringType,
  ContainerType,
  FieldDecl,
  NarrowedUnion,
  PrimitiveType,
  TypeDef,
  TypeEnum,
  TypeExpr,
  TypeRecord,
  TypeRef,
  TypeUnion,
  UnionVariant,
} from "./types.js";

// Value expressions
export type {
  ArrayValue,
  EnvRef,
  ExpressionValue,
  LitBool,
  LitNull,
  LitNumber,
  LitString,
  ObjectValue,
  SecretRef,
  SourceRef,
  TypePathValue,
  ValueExpr,
} from "./values.js";

// Expression AST nodes
export type {
  AggCall,
  AggFn,
  AggregationExpr,
  AndExpr,
  ArithmeticExpr,
  ArithOp,
  BetweenExpr,
  CaseWhenBranch,
  CaseWhenExpr,
  CoalesceExpr,
  CompareExpr,
  CompareOp,
  ComputedField,
  ContextCompare,
  ContextDomain,
  ExcludeField,
  ExistsExpr,
  Expression,
  ExternalPolicyRef,
  FieldGroupKey,
  FieldRefExpr,
  FilterExpr,
  FunctionGroupKey,
  FunctionRef,
  GroupKeyEntry,
  GroupKeyExpr,
  GuardPolicyExpr,
  HasCheck,
  InListExpr,
  IsNullExpr,
  JoinCondExpr,
  KafkaFilter,
  KeyMatch,
  LikeExpr,
  LiteralExpr,
  MongoFilter,
  NotExpr,
  OrExpr,
  PolicyAnd,
  PolicyOr,
  PortableAggregation,
  PortableFilter,
  PortableGroupKey,
  PortableJoinCond,
  PortablePolicy,
  PortableProjection,
  PortableSort,
  ProjectionEntry,
  ProjectionExpr,
  RouteEntry,
  ScalarExpr,
  ScalarValue,
  SelectAll,
  SelectField,
  SortExpr,
  SortField,
  SplitRoutesExpr,
  SqlAggregation,
  BasicAggFn,
  BasicPolicyEngine,
  CustomAggregation,
  CustomFilter,
  CustomGroupKey,
  CustomJoinCond,
  CustomSort,
  PolicyEngine,
  SqlFilter,
  SqlSort,
} from "./expressions.js";

// AccessContext types
export type {
  AccessContext,
  AuthMethod,
  AuthzAllow,
  AuthzDeny,
  AuthzResult,
  BasicAuthMethod,
  BasicIntentOp,
  BasicPrincipalKind,
  BasicUrgency,
  DpBasis,
  GdprDpBasis,
  Intent,
  IntentOp,
  Principal,
  PrincipalKind,
  ResourceGrant,
  Scope,
  TimeWindow,
  Urgency,
} from "./access.js";

// Panel and Rod nodes
export type {
  ArgValue,
  CertMetadata,
  CfgValue,
  DpMetadata,
  NamedSource,
  OpsConfig,
  Panel,
  QualifiedKnot,
  ResolvedContext,
  Rod,
  SnapEdge,
} from "./panel.js";

// ---------------------------------------------------------------------------
// Source file — top-level container for all declarations in a .strux file
// ---------------------------------------------------------------------------

import type { TypeDef } from "./types.js";
import type { Panel } from "./panel.js";

export interface SourceFile {
  readonly types: readonly TypeDef[];
  readonly panels: readonly Panel[];
}
