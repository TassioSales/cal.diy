/**
 * Wraps `fetch` with a timeout and combines caller-provided AbortSignals.
 *
 * Ensures that if the caller passes their own `options.signal` (e.g. from an HTTP request or user cancellation),
 * the request is aborted if EITHER the timeout expires OR the external signal is aborted.
 * Also cleans up the timeout timer upon completion and prevents event loop hangs using `unref()` where available.
 *
 * @param url - The URL, URL object, or Request object to fetch.
 * @param options - Standard fetch RequestInit options, including headers, method, body, and optional `signal`.
 * @param timeoutMs - The timeout in milliseconds after which the request is aborted. Defaults to 5000ms.
 * @returns A promise that resolves to the Response object.
 *
 * @example
 * ```ts
 * // Simple usage with a 5-second timeout
 * const res = await fetchWithTimeout("https://api.example.com/data", {}, 5000);
 *
 * // Combined with caller's own cancellation signal
 * const controller = new AbortController();
 * const res = await fetchWithTimeout(
 *   "https://api.example.com/data",
 *   { signal: controller.signal },
 *   10000
 * );
 * ```
 */
export async function fetchWithTimeout(
  url: string | URL | Request,
  options: RequestInit = {},
  timeoutMs: number = 5000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout((): void => controller.abort(), timeoutMs);

  // Avoid keeping the Node.js event loop alive unnecessarily
  if (typeof timer.unref === "function") {
    timer.unref();
  }

  let signal: AbortSignal = controller.signal;

  if (options.signal) {
    if (typeof AbortSignal.any === "function") {
      signal = AbortSignal.any([controller.signal, options.signal]);
    } else {
      const combined = new AbortController();
      const onAbort = (): void => combined.abort();

      if (options.signal.aborted || controller.signal.aborted) {
        combined.abort();
      } else {
        options.signal.addEventListener("abort", onAbort, { once: true });
        controller.signal.addEventListener("abort", onAbort, { once: true });
      }
      signal = combined.signal;
    }
  }

  try {
    const response = await fetch(url, {
      ...options,
      signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}
