/**
 * Parses `jsonString` and returns the parsed value only when it is a JSON object or array.
 * Every other outcome — malformed JSON, `null`, a primitive, or a non-string input — returns
 * `false`, which is the sole signal of failure. Nothing is logged: callers use this to probe
 * optional configuration (e.g. env vars), so a rejection is an expected result, not an incident.
 *
 * `T` is an unchecked assertion: the shape of the parsed value is never validated at runtime.
 * Pass a type argument only when the source is already trusted, and reach for a schema
 * validator (e.g. Zod) when it is not.
 */
export const validJson = <T = Record<string, unknown>>(jsonString: string | null | undefined): T | false => {
  if (typeof jsonString !== "string") {
    return false;
  }

  try {
    const parsed = JSON.parse(jsonString);
    if (parsed && typeof parsed === "object") {
      return parsed as T;
    }
  } catch {
    // Intentionally silent: an unparseable string is a normal negative result, reported via `false`.
  }

  return false;
};
