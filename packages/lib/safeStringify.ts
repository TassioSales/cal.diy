/**
 * Creates a JSON replacer function that handles circular references, BigInts, and nested Errors.
 */
function getCircularReplacer(): (key: string, value: unknown) => unknown {
  const seen = new WeakSet();
  return (_key: string, value: unknown) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular]";
      }
      seen.add(value);
    }
    return value;
  };
}

/**
 * Safely serializes an unknown value into a JSON string.
 *
 * Guarantees a string return value for logging systems (such as Axiom or Winston),
 * preventing unhandled exceptions from circular references, BigInt values, or throwing getters.
 *
 * @param obj - The value to stringify.
 * @returns The JSON string representation of the value, or a fallback string if serialization fails.
 *
 * @example
 * ```ts
 * safeStringify({ a: 1, b: BigInt(42) }); // '{"a":1,"b":"42"}'
 *
 * const circular: any = { name: "test" };
 * circular.self = circular;
 * safeStringify(circular); // '{"name":"test","self":"[Circular]"}'
 *
 * safeStringify(new Error("Something failed")); // '"Error: Something failed\n..."'
 * ```
 */
export function safeStringify(obj: unknown): string {
  try {
    if (obj instanceof Error) {
      // Errors don't serialize well, so we extract the stack or message
      return JSON.stringify(obj.stack ?? obj.message);
    }
    const result = JSON.stringify(obj, getCircularReplacer());
    if (result !== undefined) {
      return result;
    }
    return String(obj);
  } catch {
    try {
      return String(obj);
    } catch {
      return "[Unserializable]";
    }
  }
}
