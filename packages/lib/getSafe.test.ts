import { describe, expect, it } from "vitest";

import { getSafe } from "./getSafe";

describe("getSafe", () => {
  it("should safely retrieve nested object property", () => {
    const obj = { a: { b: { c: "hello" } } };
    expect(getSafe<string>(obj, ["a", "b", "c"])).toBe("hello");
  });

  it("should safely retrieve array element", () => {
    const obj = { users: [{ name: "Alice" }, { name: "Bob" }] };
    expect(getSafe<string>(obj, ["users", 1, "name"])).toBe("Bob");
  });

  it("should return undefined for non-existent path", () => {
    const obj = { a: { b: 1 } };
    expect(getSafe(obj, ["a", "x", "y"])).toBeUndefined();
  });

  it("should safely return undefined when path is null or undefined", () => {
    expect(getSafe({ a: 1 }, null)).toBeUndefined();
    expect(getSafe({ a: 1 }, undefined)).toBeUndefined();
  });
});
