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
  FieldAnnotation,
  FieldDecl,
  NarrowedUnion,
  PkDefault,
  PrimitiveType,
  ReferentialAction,
  TypeBlockAnnotation,
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

// Expression AST nodes (v0.6.0 — C-family grammar)
export type {
  AggCall,
  AggFn,
  AggregationExpr,
  AndExpr,
  ArithmeticExpr,
  ArithOp,
  ArrayLitExpr,
  BasicAggFn,
  BasicPolicyEngine,
  CompareExpr,
  CompareOp,
  ComputedField,
  ComputedGroupKey,
  CustomAggregation,
  CustomFilter,
  CustomGroupKey,
  CustomJoinCond,
  CustomSort,
  ExcludeField,
  Expression,
  ExternalPolicyRef,
  FieldGroupKey,
  FieldRefExpr,
  FilterExpr,
  FnCallExpr,
  FunctionRef,
  GeneralExpr,
  GroupKeyEntry,
  GroupKeyExpr,
  GuardPolicyExpr,
  JoinCondExpr,
  KafkaFilter,
  KeyMatch,
  LambdaExpr,
  LiteralExpr,
  MembershipExpr,
  MethodCallExpr,
  MongoFilter,
  NotExpr,
  NullCoalesceExpr,
  OrExpr,
  PolicyEngine,
  PortableAggregation,
  PortableFilter,
  PortableGroupKey,
  PortableJoinCond,
  PortablePolicy,
  PortableProjection,
  PortableSort,
  ProjectionEntry,
  ProjectionExpr,
  RangeExpr,
  RouteEntry,
  ScalarExpr,
  ScalarValue,
  SelectAll,
  SelectField,
  SortExpr,
  SortField,
  SplitRoutesExpr,
  SqlAggregation,
  SqlFilter,
  SqlSort,
  TernaryExpr,
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

// Privacy constants
export {
  ENCRYPTION_FORCING_SENSITIVITIES,
  EXPANSION_SUFFIX,
  FRAMEWORK_PATH,
  GDPR_BASIS,
  MANIFEST_PRIVACY,
  PRIVACY_DIAG,
  PRIVACY_TYPE,
  PRIVATE_DATA_KNOT,
  PSEUDO_ALGO,
  ROD_TYPE,
  SENSITIVITY,
  SPECIAL_CATEGORY_ALLOWED_BASES,
  STANDARD_DATA_TYPE,
} from "./privacy-constants.js";
export type {
  FrameworkPath,
  GdprBasisValue,
  PrivacyDiagCode,
  PseudoAlgo,
  RodTypeKey,
  SensitivityValue,
} from "./privacy-constants.js";

// Privacy types (private-data standard rod)
export type {
  BdsgConfig,
  CrossBorderTransfer,
  DataCategory,
  EmployeeCategory,
  FieldClassification,
  GdprBaseConfig,
  GdprBasis,
  PrivacyAuditRecord,
  PrivacyFrameworkConfig,
  PrivacyFrameworkPath,
  PrivateDataWrapper,
  ProcessingMetadata,
  ResolvedPrivacyFramework,
  RetentionBasis,
  RetentionPolicy,
  Sensitivity,
  TransferMechanism,
} from "./privacy.js";

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
