import { afterEach, describe, expect, it, vi } from "vitest";

import { validJson } from "./jsonUtils";

describe("validJson", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("valid JSON objects and arrays", () => {
    it("returns the parsed object for a flat object", () => {
      expect(validJson('{"a":1,"b":"two"}')).toEqual({ a: 1, b: "two" });
    });

    it("returns the parsed object for a nested object", () => {
      expect(validJson('{"web":{"client_id":"id","redirect_uris":["https://cal.com/cb"]}}')).toEqual({
        web: { client_id: "id", redirect_uris: ["https://cal.com/cb"] },
      });
    });

    it("returns the parsed value for an empty object", () => {
      expect(validJson("{}")).toEqual({});
    });

    it("returns the parsed value for an array", () => {
      expect(validJson("[1,2,3]")).toEqual([1, 2, 3]);
    });

    it("returns the parsed value for an empty array", () => {
      expect(validJson("[]")).toEqual([]);
    });

    it("preserves nulls nested inside an object", () => {
      expect(validJson('{"a":null}')).toEqual({ a: null });
    });

    it("tolerates surrounding whitespace", () => {
      expect(validJson('  \n\t{"a":1}  ')).toEqual({ a: 1 });
    });

    it("handles unicode and escaped characters", () => {
      expect(validJson('{"name":"Ol\\u00e1 \\"mundo\\""}')).toEqual({ name: 'Olá "mundo"' });
    });

    it("does not pollute Object.prototype for a __proto__ key", () => {
      const parsed = validJson('{"__proto__":{"polluted":true}}');

      expect(parsed).not.toBe(false);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
  });

  describe("JSON primitives are rejected", () => {
    it.each([
      ["null", "null"],
      ["a number", "123"],
      ["a negative number", "-1.5"],
      ["a quoted string", '"hello"'],
      ["true", "true"],
      ["false", "false"],
    ])("returns false for %s", (_label, input) => {
      expect(validJson(input)).toBe(false);
    });
  });

  describe("malformed input", () => {
    it.each([
      ["an empty string", ""],
      ["whitespace only", "   "],
      ["an unterminated object", '{"a":1'],
      ["a trailing comma", '{"a":1,}'],
      ["single-quoted keys", "{'a':1}"],
      ["unquoted keys", "{a:1}"],
      ["a bare word", "not json"],
      ["undefined as text", "undefined"],
      ["NaN as text", "NaN"],
    ])("returns false for %s", (_label, input) => {
      expect(validJson(input)).toBe(false);
    });
  });

  describe("non-string input", () => {
    it.each([
      ["null", null],
      ["undefined", undefined],
    ])("returns false for %s", (_label, input) => {
      expect(validJson(input)).toBe(false);
    });

    it.each([
      ["a number", 123],
      ["a boolean", true],
      ["an object", { a: 1 }],
      ["an array", [1, 2]],
      ["a function", (): undefined => undefined],
      ["a Date", new Date()],
      ["a RegExp", /abc/],
    ])("returns false for %s passed from untyped code", (_label, input) => {
      expect(validJson(input as unknown as string)).toBe(false);
    });

    it("returns false for a String object rather than a string primitive", () => {
      expect(validJson(new String('{"a":1}') as unknown as string)).toBe(false);
    });
  });

  describe("logging", () => {
    it("never writes to the console for invalid JSON", () => {
      const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
      const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      validJson("{ broken");
      validJson("");
      validJson(undefined);
      validJson(123 as unknown as string);

      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe("typing", () => {
    it("defaults to Record<string, unknown> without a type argument", () => {
      const parsed = validJson('{"a":1}');

      expect(parsed).not.toBe(false);
      if (parsed !== false) {
        expect(parsed.a).toBe(1);
      }
    });

    it("narrows to the supplied type argument", () => {
      type GoogleCredentials = { web: { client_id: string } };
      const parsed = validJson<GoogleCredentials>('{"web":{"client_id":"abc"}}');

      expect(parsed).not.toBe(false);
      if (parsed !== false) {
        expect(parsed.web.client_id).toBe("abc");
      }
    });
  });

  describe("call-site compatibility", () => {
    it("coerces to a boolean the same way existing callers rely on", () => {
      expect(!!validJson('{"web":{}}')).toBe(true);
      expect(!!validJson("not json")).toBe(false);
      expect(!!validJson(undefined)).toBe(false);
    });

    it("returns a value referentially independent from the input string", () => {
      const input = '{"a":{"b":1}}';

      expect(validJson(input)).not.toBe(validJson(input));
    });
  });
});
