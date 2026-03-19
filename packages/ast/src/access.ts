/**
 * AccessContext IR types — principal, intent, scope, and authz result.
 *
 * Spec reference: openstrux-spec/specs/core/access-context.strux
 *                 openstrux-spec/specs/core/ir.md §AccessContext in the IR
 *                 openstrux-spec/specs/core/semantics.md §AccessContext Evaluation
 */

import type { NodeBase } from "./common.js";
import type { ValueExpr } from "./values.js";

// ---------------------------------------------------------------------------
// Principal — who is calling
// ---------------------------------------------------------------------------

export interface Principal {
  readonly id: string;
  readonly kind: PrincipalKind;
  readonly roles: readonly string[];
  readonly groups: readonly string[];
  readonly attrs: Record<string, ValueExpr>;
  readonly authMethod: AuthMethod;
  readonly sessionId?: string | undefined;
}

export type BasicPrincipalKind = "human" | "service" | "system";
export type PrincipalKind = BasicPrincipalKind | (string & {});

export type BasicAuthMethod =
  | "oauth2"
  | "api_key"
  | "mtls"
  | "service_account"
  | "anonymous";
export type AuthMethod = BasicAuthMethod | (string & {});

// ---------------------------------------------------------------------------
// Intent — why are they calling
// ---------------------------------------------------------------------------

export interface Intent {
  readonly purpose: string;
  readonly basis: DpBasis;
  readonly operation: IntentOp;
  readonly urgency: Urgency;
  readonly traceId?: string | undefined;
  readonly metadata?: Record<string, ValueExpr> | undefined;
}

/** GDPR Article 6 lawful bases. Other jurisdictions may add more. */
export type GdprDpBasis =
  | "consent"
  | "contract"
  | "legitimate_interest"
  | "legal_obligation"
  | "vital_interest"
  | "public_task";

/** Lawful basis for processing — GDPR builtins get autocomplete; custom bases allowed. */
export type DpBasis = GdprDpBasis | (string & {});

export type BasicIntentOp =
  | "read"
  | "write"
  | "delete"
  | "transform"
  | "export"
  | "audit";
export type IntentOp = BasicIntentOp | (string & {});

export type BasicUrgency = "routine" | "priority" | "critical";
export type Urgency = BasicUrgency | (string & {});

// ---------------------------------------------------------------------------
// Scope — what are they allowed to access
// ---------------------------------------------------------------------------

export interface Scope {
  readonly resources: readonly ResourceGrant[];
  readonly fieldMask?: readonly string[] | undefined;
  readonly rowFilter?: string | undefined;
  readonly maxRows?: number | undefined;
  readonly timeWindow?: TimeWindow | undefined;
  readonly deny?: readonly string[] | undefined;
}

export interface ResourceGrant {
  readonly resource: string;
  readonly actions: readonly string[];
  /** Conditional access constraints (e.g., { env: "production" }). */
  readonly conditions?: Record<string, string> | undefined;
}

export interface TimeWindow {
  readonly from?: string | undefined;
  readonly to?: string | undefined;
}

// ---------------------------------------------------------------------------
// AccessContext — the full resolved context (panel-level)
// ---------------------------------------------------------------------------

export interface AccessContext extends NodeBase {
  readonly kind: "AccessContext";
  readonly principal?: Principal | undefined;
  readonly intent?: Intent | undefined;
  readonly scope?: Scope | undefined;
  readonly policyRef?: string | undefined;
  /** Request timestamp — WHEN the access occurred. */
  readonly ts?: string | undefined;
  /** Whether policy evaluation has been performed. */
  readonly evaluated?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// AuthzResult — output of guard rod evaluation
// ---------------------------------------------------------------------------

export type AuthzResult = AuthzAllow | AuthzDeny;

export interface AuthzAllow extends NodeBase {
  readonly kind: "AuthzAllow";
  readonly scope: Scope;
  readonly policyRef?: string | undefined;
  readonly expires?: string | undefined;
}

export interface AuthzDeny extends NodeBase {
  readonly kind: "AuthzDeny";
  readonly reason: string;
  readonly code: string;
  readonly policyRef?: string | undefined;
}
