import { describe, it, expect } from "vitest";
import { registerAdapter, getAdapter, listTargets } from "../registry.js";
import { UnknownTargetError } from "../types.js";
import type { Adapter, GeneratedFile } from "../types.js";

const stubAdapter: Adapter = {
  name: "stub",
  emit: () => [],
  package: () => ({ outputDir: ".openstrux/build", metadata: [], entrypoints: [] }),
};

const anotherAdapter: Adapter = {
  name: "another",
  emit: (): GeneratedFile[] => [
    { path: "test.ts", content: "export {};", lang: "typescript" },
  ],
  package: () => ({ outputDir: ".openstrux/build", metadata: [], entrypoints: [] }),
};

describe("adapter registry", () => {
  it("registers an adapter and retrieves it", () => {
    registerAdapter("test-target", stubAdapter);
    expect(getAdapter("test-target")).toBe(stubAdapter);
  });

  it("overwrites an existing adapter when re-registered", () => {
    registerAdapter("test-target", stubAdapter);
    registerAdapter("test-target", anotherAdapter);
    expect(getAdapter("test-target")).toBe(anotherAdapter);
  });

  it("throws UnknownTargetError for an unregistered target", () => {
    expect(() => getAdapter("does-not-exist")).toThrow(UnknownTargetError);
    expect(() => getAdapter("does-not-exist")).toThrow(
      'No adapter registered for target: "does-not-exist"'
    );
  });

  it("UnknownTargetError has correct name", () => {
    try {
      getAdapter("missing");
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownTargetError);
      expect((e as UnknownTargetError).name).toBe("UnknownTargetError");
    }
  });

  it("listTargets returns registered target names", () => {
    registerAdapter("alpha", stubAdapter);
    registerAdapter("beta", stubAdapter);
    expect(listTargets()).toContain("alpha");
    expect(listTargets()).toContain("beta");
  });
});
