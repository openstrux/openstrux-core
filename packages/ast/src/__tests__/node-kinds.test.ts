/**
 * Smoke test: assert that all expected node kind discriminants are present
 * in the AST type system.
 *
 * This test does not parse or execute code — it validates that the TypeScript
 * type system accepts the expected literal kind strings and that we can
 * construct representative node shapes.
 */
import { describe, it, expect } from "vitest";
import type {
  TypeRecord,
  TypeEnum,
  TypeUnion,
  Panel,
  Rod,
  AccessContext,
  PrimitiveType,
  ContainerType,
  ConstrainedNumberType,
  ConstrainedStringType,
  TypeRef,
  LitString,
  LitNumber,
  LitBool,
  LitNull,
  EnvRef,
  SecretRef,
  SourceRef,
  ArrayValue,
  ObjectValue,
  SnapEdge,
  SourceFile,
  TopLevelNodeKind,
} from "../index.js";

describe("AST node kinds", () => {
  it("TopLevelNodeKind covers all four top-level node types", () => {
    const kinds: TopLevelNodeKind[] = ["TypeRecord", "TypeEnum", "TypeUnion", "Panel"];
    expect(kinds).toHaveLength(4);
  });

  it("TypeRecord has expected shape", () => {
    const node: TypeRecord = {
      kind: "TypeRecord",
      name: "Proposal",
      fields: [
        { name: "id", type: { kind: "PrimitiveType", name: "string" } as PrimitiveType },
        { name: "title", type: { kind: "PrimitiveType", name: "string" } as PrimitiveType },
      ],
    };
    expect(node.kind).toBe("TypeRecord");
    expect(node.fields).toHaveLength(2);
  });

  it("TypeEnum has expected shape", () => {
    const node: TypeEnum = {
      kind: "TypeEnum",
      name: "ReviewStatus",
      variants: ["draft", "submitted", "approved", "rejected"],
    };
    expect(node.kind).toBe("TypeEnum");
    expect(node.variants).toHaveLength(4);
  });

  it("TypeUnion has expected shape", () => {
    const node: TypeUnion = {
      kind: "TypeUnion",
      name: "DataSource",
      variants: [
        { tag: "stream", type: { kind: "TypeRef", name: "StreamSource" } as TypeRef },
        { tag: "db", type: { kind: "TypeRef", name: "DbSource" } as TypeRef },
      ],
    };
    expect(node.kind).toBe("TypeUnion");
    expect(node.variants).toHaveLength(2);
  });

  it("AccessContext has expected shape with ts and evaluated fields", () => {
    const node: AccessContext = {
      kind: "AccessContext",
      ts: "2026-03-19T00:00:00Z",
      evaluated: false,
    };
    expect(node.kind).toBe("AccessContext");
    expect(node.evaluated).toBe(false);
  });

  it("Panel has expected shape with rods and access", () => {
    const access: AccessContext = { kind: "AccessContext" };
    const node: Panel = {
      kind: "Panel",
      name: "Intake",
      dp: { controller: "TestCo" },
      access,
      rods: [],
      snaps: [],
    };
    expect(node.kind).toBe("Panel");
    expect(node.rods).toHaveLength(0);
  });

  it("Rod has expected shape", () => {
    const node: Rod = {
      kind: "Rod",
      name: "intake",
      rodType: "receive",
      cfg: {},
      arg: {},
    };
    expect(node.kind).toBe("Rod");
    expect(node.rodType).toBe("receive");
  });

  it("SourceFile has types and panels arrays", () => {
    const sf: SourceFile = { types: [], panels: [] };
    expect(sf.types).toHaveLength(0);
    expect(sf.panels).toHaveLength(0);
  });

  it("all 18 basic rod types are representable", () => {
    const rodTypes: Rod["rodType"][] = [
      "read-data", "write-data",
      "receive", "respond", "call",
      "transform", "filter", "group", "aggregate", "merge", "join", "window",
      "guard", "store",
      "validate", "pseudonymize", "encrypt",
      "split",
    ];
    expect(rodTypes).toHaveLength(18);
  });

  it("value expression kinds are representable", () => {
    const litStr: LitString = { kind: "LitString", value: "hello" };
    const litNum: LitNumber = { kind: "LitNumber", value: 42 };
    const litBool: LitBool = { kind: "LitBool", value: true };
    const litNull: LitNull = { kind: "LitNull" };
    const envRef: EnvRef = { kind: "EnvRef", varName: "DB_HOST" };
    const secretRef: SecretRef = { kind: "SecretRef", fields: {} };
    const sourceRef: SourceRef = { kind: "SourceRef", alias: "production", overrides: {} };
    const arr: ArrayValue = { kind: "ArrayValue", elements: [litStr] };
    const obj: ObjectValue = { kind: "ObjectValue", fields: { x: litNum } };

    expect(litStr.kind).toBe("LitString");
    expect(litNum.kind).toBe("LitNumber");
    expect(litBool.kind).toBe("LitBool");
    expect(litNull.kind).toBe("LitNull");
    expect(envRef.kind).toBe("EnvRef");
    expect(secretRef.kind).toBe("SecretRef");
    expect(sourceRef.kind).toBe("SourceRef");
    expect(arr.kind).toBe("ArrayValue");
    expect(obj.kind).toBe("ObjectValue");
  });

  it("SnapEdge has from/to QualifiedKnot shape", () => {
    const snap: SnapEdge = {
      from: { rod: "db", dir: "out", knot: "rows" },
      to: { rod: "f", dir: "in", knot: "data" },
    };
    expect(snap.from.rod).toBe("db");
    expect(snap.to.dir).toBe("in");
  });

  it("type expression kinds are representable", () => {
    const primitive: PrimitiveType = { kind: "PrimitiveType", name: "string" };
    const container: ContainerType = {
      kind: "ContainerType",
      container: "Batch",
      typeArgs: [primitive],
    };
    const constNum: ConstrainedNumberType = { kind: "ConstrainedNumberType", min: 0, max: 100 };
    const constStr: ConstrainedStringType = {
      kind: "ConstrainedStringType",
      values: ["consent", "contract"],
    };
    const ref: TypeRef = { kind: "TypeRef", name: "DataSource" };

    expect(primitive.kind).toBe("PrimitiveType");
    expect(container.kind).toBe("ContainerType");
    expect(constNum.kind).toBe("ConstrainedNumberType");
    expect(constStr.kind).toBe("ConstrainedStringType");
    expect(ref.kind).toBe("TypeRef");
  });
});
