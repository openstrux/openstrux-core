/**
 * Unit tests for the expression lowerer.
 *
 * Verifies TypeScript output matches expected strings for each operator mapping.
 * Tests lowerExpr directly with manually constructed AST nodes.
 *
 * Design reference: openspec/changes/transform-expression-lowering/design.md §D3
 */

import { describe, expect, it } from "vitest";
import { lowerExpr } from "../adapters/nextjs/rods/expression-lowerer.js";
import type { LowerCtx } from "../adapters/nextjs/rods/expression-lowerer.js";
import type {
  CompareExpr,
  AndExpr,
  OrExpr,
  NotExpr,
  MembershipExpr,
  RangeExpr,
  FieldRefExpr,
  LiteralExpr,
  ArrayLitExpr,
  ArithmeticExpr,
  TernaryExpr,
  NullCoalesceExpr,
  MethodCallExpr,
  FnCallExpr,
} from "@openstrux/ast";

const CTX: LowerCtx = { rootVar: "item" };

// ---------------------------------------------------------------------------
// Helpers to build minimal AST nodes
// ---------------------------------------------------------------------------

function fieldRef(segments: string[]): FieldRefExpr {
  return { kind: "FieldRefExpr", field: { segments }, optional: false };
}

function strLit(value: string): LiteralExpr {
  return { kind: "LiteralExpr", value: { kind: "string", value } };
}

function numLit(value: number): LiteralExpr {
  return { kind: "LiteralExpr", value: { kind: "number", value } };
}

function boolLit(value: boolean): LiteralExpr {
  return { kind: "LiteralExpr", value: { kind: "bool", value } };
}

// ---------------------------------------------------------------------------
// CompareExpr: === / !== / > / >= / < / <=
// ---------------------------------------------------------------------------

describe("CompareExpr", () => {
  it("eq → ===", () => {
    const node: CompareExpr = {
      kind: "CompareExpr",
      field: { segments: ["status"] },
      op: "eq",
      value: { kind: "string", value: "active" },
    };
    expect(lowerExpr(node, CTX)).toBe('item.status === "active"');
  });

  it("ne → !==", () => {
    const node: CompareExpr = {
      kind: "CompareExpr",
      field: { segments: ["status"] },
      op: "ne",
      value: { kind: "string", value: "deleted" },
    };
    expect(lowerExpr(node, CTX)).toBe('item.status !== "deleted"');
  });

  it("gt → >", () => {
    const node: CompareExpr = {
      kind: "CompareExpr",
      field: { segments: ["score"] },
      op: "gt",
      value: { kind: "number", value: 50 },
    };
    expect(lowerExpr(node, CTX)).toBe("item.score > 50");
  });

  it("ge → >=", () => {
    const node: CompareExpr = {
      kind: "CompareExpr",
      field: { segments: ["score"] },
      op: "ge",
      value: { kind: "number", value: 70 },
    };
    expect(lowerExpr(node, CTX)).toBe("item.score >= 70");
  });

  it("lt → <", () => {
    const node: CompareExpr = {
      kind: "CompareExpr",
      field: { segments: ["age"] },
      op: "lt",
      value: { kind: "number", value: 18 },
    };
    expect(lowerExpr(node, CTX)).toBe("item.age < 18");
  });

  it("le → <=", () => {
    const node: CompareExpr = {
      kind: "CompareExpr",
      field: { segments: ["age"] },
      op: "le",
      value: { kind: "number", value: 65 },
    };
    expect(lowerExpr(node, CTX)).toBe("item.age <= 65");
  });

  it("null comparison: eq null → === null", () => {
    const node: CompareExpr = {
      kind: "CompareExpr",
      field: { segments: ["email"] },
      op: "eq",
      value: { kind: "null" },
    };
    expect(lowerExpr(node, CTX)).toBe("item.email === null");
  });

  it("ne null → !== null", () => {
    const node: CompareExpr = {
      kind: "CompareExpr",
      field: { segments: ["email"] },
      op: "ne",
      value: { kind: "null" },
    };
    expect(lowerExpr(node, CTX)).toBe("item.email !== null");
  });
});

// ---------------------------------------------------------------------------
// BoolNode: && / || / !
// ---------------------------------------------------------------------------

describe("AndExpr → &&", () => {
  it("two operands joined with &&", () => {
    const a: CompareExpr = { kind: "CompareExpr", field: { segments: ["status"] }, op: "eq", value: { kind: "string", value: "active" } };
    const b: CompareExpr = { kind: "CompareExpr", field: { segments: ["score"] }, op: "gt", value: { kind: "number", value: 0 } };
    const node: AndExpr = { kind: "AndExpr", operands: [a, b] };
    const result = lowerExpr(node, CTX);
    expect(result).toContain("&&");
    expect(result).toContain('item.status === "active"');
    expect(result).toContain("item.score > 0");
  });
});

describe("OrExpr → ||", () => {
  it("two operands joined with ||", () => {
    const a: CompareExpr = { kind: "CompareExpr", field: { segments: ["role"] }, op: "eq", value: { kind: "string", value: "admin" } };
    const b: CompareExpr = { kind: "CompareExpr", field: { segments: ["role"] }, op: "eq", value: { kind: "string", value: "editor" } };
    const node: OrExpr = { kind: "OrExpr", operands: [a, b] };
    const result = lowerExpr(node, CTX);
    expect(result).toContain("||");
  });
});

describe("NotExpr → !", () => {
  it("negates with !", () => {
    const inner: FieldRefExpr = { kind: "FieldRefExpr", field: { segments: ["active"] }, optional: false };
    const node: NotExpr = { kind: "NotExpr", operand: inner };
    const result = lowerExpr(node, CTX);
    expect(result).toContain("!");
    expect(result).toContain("active");
  });
});

// ---------------------------------------------------------------------------
// MembershipExpr → .includes()
// ---------------------------------------------------------------------------

describe("MembershipExpr → .includes()", () => {
  it("in list → .includes()", () => {
    const node: MembershipExpr = {
      kind: "MembershipExpr",
      field: { segments: ["status"] },
      negated: false,
      values: [{ kind: "string", value: "active" }, { kind: "string", value: "pending" }],
    };
    const result = lowerExpr(node, CTX);
    expect(result).toContain(".includes(");
    expect(result).not.toContain("!");
  });

  it("!in list → !array.includes()", () => {
    const node: MembershipExpr = {
      kind: "MembershipExpr",
      field: { segments: ["status"] },
      negated: true,
      values: [{ kind: "string", value: "deleted" }],
    };
    const result = lowerExpr(node, CTX);
    expect(result).toContain("!");
    expect(result).toContain(".includes(");
  });
});

// ---------------------------------------------------------------------------
// RangeExpr → >= low && <= high
// ---------------------------------------------------------------------------

describe("RangeExpr → >= low && <= high", () => {
  it("inclusive range emits both bounds", () => {
    const node: RangeExpr = {
      kind: "RangeExpr",
      field: { segments: ["score"] },
      low: { kind: "number", value: 0 },
      high: { kind: "number", value: 100 },
      halfOpen: false,
    };
    const result = lowerExpr(node, CTX);
    expect(result).toContain(">=");
    expect(result).toContain("<=");
    expect(result).toContain("0");
    expect(result).toContain("100");
    expect(result).toContain("&&");
  });

  it("half-open range emits >= and < (not <=)", () => {
    const node: RangeExpr = {
      kind: "RangeExpr",
      field: { segments: ["age"] },
      low: { kind: "number", value: 18 },
      high: { kind: "number", value: 65 },
      halfOpen: true,
    };
    const result = lowerExpr(node, CTX);
    expect(result).toContain(">=");
    expect(result).toContain("<");
    expect(result).not.toContain("<=");
  });
});

// ---------------------------------------------------------------------------
// FieldRef (dot path)
// ---------------------------------------------------------------------------

describe("FieldRefExpr → dot path", () => {
  it("single segment: item.field", () => {
    const node: FieldRefExpr = { kind: "FieldRefExpr", field: { segments: ["name"] }, optional: false };
    expect(lowerExpr(node, CTX)).toBe("item.name");
  });

  it("multi segment: item.address.city", () => {
    const node: FieldRefExpr = { kind: "FieldRefExpr", field: { segments: ["address", "city"] }, optional: false };
    expect(lowerExpr(node, CTX)).toBe("item.address.city");
  });

  it("optional chain: item.user?.email", () => {
    const node: FieldRefExpr = { kind: "FieldRefExpr", field: { segments: ["user", "email"] }, optional: true };
    expect(lowerExpr(node, CTX)).toContain("?.");
  });
});

// ---------------------------------------------------------------------------
// Literal values
// ---------------------------------------------------------------------------

describe("LiteralExpr", () => {
  it("string literal: JSON.stringify", () => {
    const node: LiteralExpr = { kind: "LiteralExpr", value: { kind: "string", value: "hello" } };
    expect(lowerExpr(node, CTX)).toBe('"hello"');
  });

  it("number literal", () => {
    const node: LiteralExpr = { kind: "LiteralExpr", value: { kind: "number", value: 42 } };
    expect(lowerExpr(node, CTX)).toBe("42");
  });

  it("bool literal true", () => {
    const node: LiteralExpr = { kind: "LiteralExpr", value: { kind: "bool", value: true } };
    expect(lowerExpr(node, CTX)).toBe("true");
  });

  it("null literal", () => {
    const node: LiteralExpr = { kind: "LiteralExpr", value: { kind: "null" } };
    expect(lowerExpr(node, CTX)).toBe("null");
  });

  it("env() literal: process.env[...]", () => {
    const node: LiteralExpr = { kind: "LiteralExpr", value: { kind: "env", varName: "AWS_REGION" } };
    expect(lowerExpr(node, CTX)).toContain('process.env["AWS_REGION"]');
  });
});

// ---------------------------------------------------------------------------
// ArrayLit
// ---------------------------------------------------------------------------

describe("ArrayLitExpr", () => {
  it("array of string literals: [\"a\", \"b\"]", () => {
    const node: ArrayLitExpr = {
      kind: "ArrayLitExpr",
      elements: [
        { kind: "LiteralExpr", value: { kind: "string", value: "active" } } as LiteralExpr,
        { kind: "LiteralExpr", value: { kind: "string", value: "pending" } } as LiteralExpr,
      ],
    };
    const result = lowerExpr(node, CTX);
    expect(result).toBe('["active", "pending"]');
  });
});

// ---------------------------------------------------------------------------
// ArithmeticExpr: + / - / * / / / %
// ---------------------------------------------------------------------------

describe("ArithmeticExpr", () => {
  it("+ lowers to +", () => {
    const node: ArithmeticExpr = {
      kind: "ArithmeticExpr",
      op: "add",
      left: fieldRef(["a"]),
      right: numLit(1),
    };
    const result = lowerExpr(node, CTX);
    expect(result).toContain("+");
  });

  it("* lowers to *", () => {
    const node: ArithmeticExpr = {
      kind: "ArithmeticExpr",
      op: "mul",
      left: fieldRef(["price"]),
      right: fieldRef(["qty"]),
    };
    const result = lowerExpr(node, CTX);
    expect(result).toContain("*");
  });

  it("% lowers to %", () => {
    const node: ArithmeticExpr = {
      kind: "ArithmeticExpr",
      op: "mod",
      left: fieldRef(["count"]),
      right: numLit(2),
    };
    const result = lowerExpr(node, CTX);
    expect(result).toContain("%");
  });
});

// ---------------------------------------------------------------------------
// TernaryExpr: ? :
// ---------------------------------------------------------------------------

describe("TernaryExpr → ? :", () => {
  it("emits condition ? then : else", () => {
    const node: TernaryExpr = {
      kind: "TernaryExpr",
      condition: fieldRef(["active"]),
      then: strLit("yes"),
      else: strLit("no"),
    };
    const result = lowerExpr(node, CTX);
    expect(result).toContain("?");
    expect(result).toContain(":");
    expect(result).toContain('"yes"');
    expect(result).toContain('"no"');
  });
});

// ---------------------------------------------------------------------------
// NullCoalesceExpr: ??
// ---------------------------------------------------------------------------

describe("NullCoalesceExpr → ??", () => {
  it("emits left ?? right", () => {
    const node: NullCoalesceExpr = {
      kind: "NullCoalesceExpr",
      left: fieldRef(["name"]),
      right: strLit("anonymous"),
    };
    const result = lowerExpr(node, CTX);
    expect(result).toContain("??");
    expect(result).toContain('"anonymous"');
  });
});

// ---------------------------------------------------------------------------
// MethodCallExpr: direct passthrough
// ---------------------------------------------------------------------------

describe("MethodCallExpr — direct passthrough", () => {
  it("startsWith passthrough", () => {
    const node: MethodCallExpr = {
      kind: "MethodCallExpr",
      receiver: fieldRef(["email"]),
      method: "startsWith",
      args: [strLit("admin")],
    };
    const result = lowerExpr(node, CTX);
    expect(result).toContain(".startsWith(");
    expect(result).toContain('"admin"');
  });

  it("includes passthrough", () => {
    const node: MethodCallExpr = {
      kind: "MethodCallExpr",
      receiver: fieldRef(["roles"]),
      method: "includes",
      args: [strLit("admin")],
    };
    const result = lowerExpr(node, CTX);
    expect(result).toContain(".includes(");
  });
});

// ---------------------------------------------------------------------------
// FnCallExpr: built-in dispatch
// ---------------------------------------------------------------------------

describe("FnCallExpr — built-in functions", () => {
  it("abs() lowers to Math.abs()", () => {
    const node: FnCallExpr = {
      kind: "FnCallExpr",
      fn: "abs",
      args: [fieldRef(["value"])],
    };
    const result = lowerExpr(node, CTX);
    expect(result).toContain("Math.abs(");
  });

  it("round() lowers to Math.round()", () => {
    const node: FnCallExpr = {
      kind: "FnCallExpr",
      fn: "round",
      args: [fieldRef(["score"])],
    };
    const result = lowerExpr(node, CTX);
    expect(result).toContain("Math.round(");
  });

  it("len() lowers to .length", () => {
    const node: FnCallExpr = {
      kind: "FnCallExpr",
      fn: "len",
      args: [fieldRef(["items"])],
    };
    const result = lowerExpr(node, CTX);
    expect(result).toContain(".length");
  });

  it("str() lowers to String()", () => {
    const node: FnCallExpr = {
      kind: "FnCallExpr",
      fn: "str",
      args: [fieldRef(["count"])],
    };
    const result = lowerExpr(node, CTX);
    expect(result).toContain("String(");
  });
});
