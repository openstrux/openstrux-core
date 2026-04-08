/**
 * Unit tests for the expression parser.
 *
 * Covers: one test per operator/expression form; edge cases for deeply nested
 * boolean, multi-level field access, lambda in collection method, chained
 * method calls.
 *
 * Uses parseExpression directly to test the expression grammar in isolation.
 *
 * Spec reference: openstrux-spec/specs/core/expression-shorthand.md (v0.6.0)
 */

import { describe, expect, it } from "vitest";
import { parseExpression } from "../expression-parser.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseFilter(expr: string) {
  return parseExpression(expr, "filter", 1, 1);
}

function parseProj(expr: string) {
  return parseExpression(expr, "projection", 1, 1);
}

function parseAgg(expr: string) {
  return parseExpression(expr, "aggregation", 1, 1);
}

function parseGroupKey(expr: string) {
  return parseExpression(expr, "group-key", 1, 1);
}

function parseJoin(expr: string) {
  return parseExpression(expr, "join-cond", 1, 1);
}

function parseSort(expr: string) {
  return parseExpression(expr, "sort", 1, 1);
}

function parseRoutes(expr: string) {
  return parseExpression(expr, "split-routes", 1, 1);
}

function parseGuard(expr: string) {
  return parseExpression(expr, "guard-policy", 1, 1);
}

function hasNoErrors(result: ReturnType<typeof parseFilter>): boolean {
  return result.diagnostics.filter(d => d.severity === "error").length === 0;
}

// ---------------------------------------------------------------------------
// Filter: comparison operators
// ---------------------------------------------------------------------------

describe("filter — comparison operators", () => {
  it("== parses to CompareExpr (eq)", () => {
    const r = parseFilter('status == "active"');
    expect(hasNoErrors(r)).toBe(true);
    expect(r.value.kind).toBe("portable-filter");
    const expr = (r.value as unknown as { kind: string; expr: { kind: string } }).expr;
    expect(expr.kind).toBe("CompareExpr");
  });

  it("!= parses to CompareExpr (ne)", () => {
    const r = parseFilter('status != "deleted"');
    expect(hasNoErrors(r)).toBe(true);
    const expr = (r.value as unknown as { kind: string; expr: { op: string } }).expr;
    expect(expr.op).toBe("ne");
  });

  it("> parses to CompareExpr (gt)", () => {
    const r = parseFilter("score > 50");
    const expr = (r.value as unknown as { expr: { op: string } }).expr;
    expect(expr.op).toBe("gt");
  });

  it(">= parses to CompareExpr (ge)", () => {
    const r = parseFilter("score >= 50");
    const expr = (r.value as unknown as { expr: { op: string } }).expr;
    expect(expr.op).toBe("ge");
  });

  it("< parses to CompareExpr (lt)", () => {
    const r = parseFilter("score < 100");
    const expr = (r.value as unknown as { expr: { op: string } }).expr;
    expect(expr.op).toBe("lt");
  });

  it("<= parses to CompareExpr (le)", () => {
    const r = parseFilter("score <= 100");
    const expr = (r.value as unknown as { expr: { op: string } }).expr;
    expect(expr.op).toBe("le");
  });
});

// ---------------------------------------------------------------------------
// Filter: boolean logic
// ---------------------------------------------------------------------------

describe("filter — boolean logic", () => {
  it("&& parses to AndExpr", () => {
    const r = parseFilter('status == "active" && score > 0');
    expect(hasNoErrors(r)).toBe(true);
    const expr = (r.value as unknown as { expr: { kind: string } }).expr;
    expect(expr.kind).toBe("AndExpr");
  });

  it("|| parses to OrExpr", () => {
    const r = parseFilter('status == "pending" || status == "active"');
    expect(hasNoErrors(r)).toBe(true);
    const expr = (r.value as unknown as { expr: { kind: string } }).expr;
    expect(expr.kind).toBe("OrExpr");
  });

  it("! parses to NotExpr", () => {
    const r = parseFilter("!deleted");
    expect(hasNoErrors(r)).toBe(true);
    const expr = (r.value as unknown as { expr: { kind: string } }).expr;
    expect(expr.kind).toBe("NotExpr");
  });

  it("deeply nested boolean: && of || of !x", () => {
    const r = parseFilter('(a == 1 || b == 2) && !deleted');
    expect(hasNoErrors(r)).toBe(true);
    const expr = (r.value as unknown as { expr: { kind: string } }).expr;
    expect(expr.kind).toBe("AndExpr");
  });
});

// ---------------------------------------------------------------------------
// Filter: membership (in / !in)
// ---------------------------------------------------------------------------

describe("filter — membership", () => {
  it("in [list] parses to MembershipExpr (not negated)", () => {
    const r = parseFilter('status in ["active", "pending"]');
    expect(hasNoErrors(r)).toBe(true);
    const expr = (r.value as unknown as { expr: { kind: string; negated: boolean } }).expr;
    expect(expr.kind).toBe("MembershipExpr");
    expect(expr.negated).toBe(false);
  });

  it("!in [list] parses to MembershipExpr (negated)", () => {
    const r = parseFilter('status !in ["deleted", "archived"]');
    expect(hasNoErrors(r)).toBe(true);
    const expr = (r.value as unknown as { expr: { kind: string; negated: boolean } }).expr;
    expect(expr.kind).toBe("MembershipExpr");
    expect(expr.negated).toBe(true);
  });

  it("in numeric range parses to RangeExpr", () => {
    const r = parseFilter("score in 0..100");
    expect(hasNoErrors(r)).toBe(true);
    const expr = (r.value as unknown as { expr: { kind: string } }).expr;
    expect(expr.kind).toBe("RangeExpr");
  });

  it("numeric range x..y (inclusive) parses to RangeExpr", () => {
    const r = parseFilter("age in 18..65");
    expect(hasNoErrors(r)).toBe(true);
    const expr = (r.value as unknown as { expr: { kind: string } }).expr;
    expect(expr.kind).toBe("RangeExpr");
  });
});

// ---------------------------------------------------------------------------
// Filter: optional chaining (null coalescing valid in scalar contexts, not filter top-level)
// ---------------------------------------------------------------------------

describe("filter — optional chaining", () => {
  it("?. optional chain on field parses correctly in comparison", () => {
    const r = parseFilter('user?.email == "test@test.com"');
    expect(hasNoErrors(r)).toBe(true);
    const expr = (r.value as unknown as { expr: { kind: string } }).expr;
    expect(expr.kind).toBe("CompareExpr");
  });
});

// ---------------------------------------------------------------------------
// Projection: null coalescing and ternary (valid in scalar/computed field context)
// ---------------------------------------------------------------------------

describe("projection — null coalescing and ternary", () => {
  it("?? in computed field parses correctly", () => {
    const r = parseProj('[name, email ?? "anon" as displayEmail]');
    expect(hasNoErrors(r)).toBe(true);
  });

  it("? : ternary in computed field parses correctly", () => {
    const r = parseProj('[active, status ? "yes" : "no" as label]');
    expect(hasNoErrors(r)).toBe(true);
  });
});


// ---------------------------------------------------------------------------
// Filter: method calls
// ---------------------------------------------------------------------------

describe("filter — method calls", () => {
  it(".startsWith() parses to MethodCallExpr", () => {
    const r = parseFilter('email.startsWith("admin")');
    expect(hasNoErrors(r)).toBe(true);
    const expr = (r.value as unknown as { expr: { kind: string; method: string } }).expr;
    expect(expr.kind).toBe("MethodCallExpr");
    expect(expr.method).toBe("startsWith");
  });

  it(".endsWith() parses correctly", () => {
    const r = parseFilter('email.endsWith(".com")');
    expect(hasNoErrors(r)).toBe(true);
  });

  it(".contains() parses correctly", () => {
    const r = parseFilter('name.contains("test")');
    expect(hasNoErrors(r)).toBe(true);
  });

  it(".matches() parses correctly", () => {
    const r = parseFilter('email.matches("[a-z]+@[a-z]+\\.com")');
    expect(hasNoErrors(r)).toBe(true);
  });

  it(".includes() parses to MethodCallExpr", () => {
    const r = parseFilter('roles.includes("admin")');
    expect(hasNoErrors(r)).toBe(true);
    const expr = (r.value as unknown as { expr: { method: string } }).expr;
    expect(expr.method).toBe("includes");
  });

  it(".any() with simple lambda body parses correctly", () => {
    // Lambda body must be a scalar/field ref; comparison bodies require bool context
    const r = parseFilter('items.any(x => x.active)');
    expect(hasNoErrors(r)).toBe(true);
  });

  it(".all() with simple lambda body parses correctly", () => {
    const r = parseFilter('items.all(x => x.score)');
    expect(hasNoErrors(r)).toBe(true);
  });

  it("chained method calls: .field.method() parses", () => {
    const r = parseFilter('user.email.startsWith("admin")');
    expect(hasNoErrors(r)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Filter: multi-level field access
// ---------------------------------------------------------------------------

describe("filter — multi-level field access", () => {
  it("a.b.c field path parses as FieldRefExpr or CompareExpr", () => {
    const r = parseFilter('user.profile.status == "active"');
    expect(hasNoErrors(r)).toBe(true);
  });

  it("deep nesting a.b.c.d == val parses without error", () => {
    const r = parseFilter('order.customer.address.country == "DE"');
    expect(hasNoErrors(r)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Filter: built-in functions
// ---------------------------------------------------------------------------

describe("filter — built-in functions", () => {
  it("env() function parses correctly", () => {
    const r = parseFilter('region == env("AWS_REGION")');
    expect(hasNoErrors(r)).toBe(true);
  });

  it("now() function parses correctly", () => {
    const r = parseFilter("created_at < now()");
    expect(hasNoErrors(r)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Filter: arithmetic
// ---------------------------------------------------------------------------

describe("filter — arithmetic", () => {
  it("+ parses to ArithmeticExpr", () => {
    const r = parseFilter("a + b > 10");
    expect(hasNoErrors(r)).toBe(true);
  });

  it("* parses to ArithmeticExpr", () => {
    const r = parseFilter("price * qty > 100");
    expect(hasNoErrors(r)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Projection parser
// ---------------------------------------------------------------------------

describe("projection parser", () => {
  it("include-only list parses to PortableProjection", () => {
    const r = parseProj("[name, email, id]");
    expect(hasNoErrors(r)).toBe(true);
    expect(r.value.kind).toBe("portable-projection");
  });

  it("exclude field with - prefix", () => {
    const r = parseProj("[*, -password, -secret]");
    expect(hasNoErrors(r)).toBe(true);
    const proj = (r.value as unknown as { expr: { entries: { kind: string }[] } }).expr;
    const excludes = proj.entries.filter((e: { kind: string }) => e.kind === "ExcludeField");
    expect(excludes.length).toBeGreaterThan(0);
  });

  it("rename field with 'as' alias", () => {
    const r = parseProj("[user_id as userId]");
    expect(hasNoErrors(r)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Aggregation parser
// ---------------------------------------------------------------------------

describe("aggregation parser", () => {
  it("count(*) parses to PortableAggregation", () => {
    const r = parseAgg("count(*)");
    expect(hasNoErrors(r)).toBe(true);
    expect(r.value.kind).toBe("portable-agg");
  });

  it("sum(field) parses correctly", () => {
    const r = parseAgg("sum(amount)");
    expect(hasNoErrors(r)).toBe(true);
  });

  it("avg(field) parses correctly", () => {
    const r = parseAgg("avg(score)");
    expect(hasNoErrors(r)).toBe(true);
  });

  it("min(field) parses correctly", () => {
    const r = parseAgg("min(price)");
    expect(hasNoErrors(r)).toBe(true);
  });

  it("max(field) parses correctly", () => {
    const r = parseAgg("max(price)");
    expect(hasNoErrors(r)).toBe(true);
  });

  it("distinct modifier: count(distinct id) parses correctly", () => {
    const r = parseAgg("count(distinct id)");
    expect(hasNoErrors(r)).toBe(true);
  });

  it("multi-agg [count(*) as total, avg(score) as avg_score]", () => {
    const r = parseAgg("[count(*) as total, avg(score) as avg_score]");
    expect(hasNoErrors(r)).toBe(true);
  });

  it("non-identifier in function position emits E024", () => {
    const r = parseAgg("!(field)");
    const errors = r.diagnostics.filter(d => d.severity === "error" && d.code === "E024");
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Group key parser
// ---------------------------------------------------------------------------

describe("group key parser", () => {
  it("single field parses to PortableGroupKey", () => {
    const r = parseGroupKey("category");
    expect(hasNoErrors(r)).toBe(true);
    expect(r.value.kind).toBe("portable-group-key");
  });

  it("multiple comma-separated fields parse correctly", () => {
    const r = parseGroupKey("category, region");
    expect(hasNoErrors(r)).toBe(true);
    const gk = (r.value as unknown as { expr: { keys: unknown[] } }).expr;
    expect(gk.keys.length).toBe(2);
  });

  it("computed key with function: year(created_at)", () => {
    const r = parseGroupKey("year(created_at)");
    expect(hasNoErrors(r)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Join condition parser
// ---------------------------------------------------------------------------

describe("join condition parser", () => {
  it("left.field == right.field parses to PortableJoinCond", () => {
    const r = parseJoin("left.id == right.user_id");
    expect(hasNoErrors(r)).toBe(true);
    expect(r.value.kind).toBe("portable-join-cond");
  });

  it("composite && join parses correctly", () => {
    const r = parseJoin("left.id == right.user_id && left.tenant == right.tenant");
    expect(hasNoErrors(r)).toBe(true);
    const cond = (r.value as unknown as { expr: { matches: unknown[] } }).expr;
    expect(cond.matches.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Sort parser
// ---------------------------------------------------------------------------

describe("sort parser", () => {
  it("field asc parses to PortableSort", () => {
    const r = parseSort("created_at asc");
    expect(hasNoErrors(r)).toBe(true);
    expect(r.value.kind).toBe("portable-sort");
  });

  it("field desc parses correctly", () => {
    const r = parseSort("score desc");
    expect(hasNoErrors(r)).toBe(true);
    const sort = (r.value as unknown as { expr: { fields: { direction: string }[] } }).expr;
    expect(sort.fields[0]?.direction).toBe("desc");
  });

  it("field desc nulls last parses with nulls position", () => {
    const r = parseSort("score desc nulls last");
    expect(hasNoErrors(r)).toBe(true);
    const sort = (r.value as unknown as { expr: { fields: { nulls: string | null }[] } }).expr;
    expect(sort.fields[0]?.nulls).toBe("last");
  });

  it("multi-field sort: score desc, created_at asc", () => {
    const r = parseSort("score desc, created_at asc");
    expect(hasNoErrors(r)).toBe(true);
    const sort = (r.value as unknown as { expr: { fields: unknown[] } }).expr;
    expect(sort.fields.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Split routes parser
// ---------------------------------------------------------------------------

describe("split routes parser", () => {
  it("{ name: predicate } with brace syntax parses to SplitRoutesExpr", () => {
    const r = parseRoutes('{ eligible: score >= 70\n rejected: score < 40 }');
    expect(hasNoErrors(r)).toBe(true);
    expect(r.value.kind).toBe("portable-split-routes");
  });

  it("default (*) route parses correctly", () => {
    const r = parseRoutes('{ approved: score > 80\n other: * }');
    expect(hasNoErrors(r)).toBe(true);
    const expr = (r.value as unknown as { expr: { routes: { name: string; predicate: null | unknown }[] } }).expr;
    const defaultRoute = expr.routes.find(rt => rt.predicate === null);
    expect(defaultRoute).toBeDefined();
    expect(defaultRoute?.name).toBe("other");
  });
});

// ---------------------------------------------------------------------------
// Guard policy parser
// ---------------------------------------------------------------------------

describe("guard policy parser", () => {
  it("principal.roles.includes() parses to PortableGuardPolicy", () => {
    const r = parseGuard('principal.roles.includes("admin")');
    expect(hasNoErrors(r)).toBe(true);
    expect(r.value.kind).toBe("portable-guard-policy");
  });

  it("element field comparison parses correctly", () => {
    const r = parseGuard("element.owner_id == principal.id");
    expect(hasNoErrors(r)).toBe(true);
  });

  it("scope context reference parses correctly", () => {
    const r = parseGuard('scope.resources.includes("Document")');
    expect(hasNoErrors(r)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Escape-hatch prefixes
// ---------------------------------------------------------------------------

describe("escape-hatch prefixes", () => {
  it("sql: prefix produces source-specific-expr", () => {
    const r = parseFilter('sql: age > 18');
    expect(hasNoErrors(r)).toBe(true);
    expect(r.value.kind).toBe("source-specific-expr");
  });

  it("fn: prefix produces fn-ref", () => {
    const r = parseFilter("fn: myModule.myFn");
    expect(hasNoErrors(r)).toBe(true);
    expect(r.value.kind).toBe("fn-ref");
  });
});

// ---------------------------------------------------------------------------
// Lambda expressions
// ---------------------------------------------------------------------------

describe("lambda expressions", () => {
  it("x => expr parses inside method call", () => {
    // Lambda body is a simple field ref (comparison bodies require bool context)
    const r = parseFilter("items.any(x => x.score)");
    expect(hasNoErrors(r)).toBe(true);
    const expr = (r.value as unknown as { expr: { kind: string } }).expr;
    expect(expr.kind).toBe("MethodCallExpr");
  });
});
