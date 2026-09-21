/**
 * Converts an iterable of key-value pairs into an object, grouping values with duplicate keys into an array.
 *
 * Similar to `Object.fromEntries()`, but preserves duplicate keys by converting their values
 * into arrays instead of overwriting earlier entries.
 *
 * Safely handles `null`, `undefined`, or empty iterables, and protects against prototype
 * pollution (`__proto__`, `constructor`) and own-property collisions (e.g. key `"hasOwnProperty"`).
 *
 * @param entries - An iterable of `[key, value]` tuples (e.g. `URLSearchParams.entries()`, `Map.entries()`, or arrays), or null/undefined.
 * @returns A record mapping keys to single string values or arrays of string values.
 *
 * @example
 * ```ts
 * fromEntriesWithDuplicateKeys([["a", "1"], ["b", "2"]]);
 * // => { a: "1", b: "2" }
 *
 * fromEntriesWithDuplicateKeys([["tag", "dev"], ["tag", "oss"]]);
 * // => { tag: ["dev", "oss"] }
 *
 * fromEntriesWithDuplicateKeys(null);
 * // => {}
 * ```
 */
export function fromEntriesWithDuplicateKeys(
  entries?: Iterable<readonly [string, string]> | null
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};

  if (!entries) {
    return result;
  }

  for (const [key, value] of entries) {
    // Guard against prototype pollution
    if (key === "__proto__" || key === "constructor") {
      continue;
    }

    if (Object.hasOwn(result, key)) {
      const currentValue = result[key];
      if (Array.isArray(currentValue)) {
        currentValue.push(value);
      } else {
        result[key] = [currentValue, value];
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}
