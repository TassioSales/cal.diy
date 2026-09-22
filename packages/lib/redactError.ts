import logger from "@calcom/lib/logger";
import { IS_PRODUCTION } from "./constants";
import { safeStringify } from "./safeStringify";

const log = logger.getSubLogger({ prefix: [`[redactError]`] });

function shouldRedact(error: Error): boolean {
  const n = error.name || "";
  let code = "";
  if ("code" in error && typeof (error as { code?: unknown }).code === "string") {
    code = (error as { code: string }).code;
  }
  return /Prisma/i.test(n) || code.startsWith("P");
}

/**
 * Redacts sensitive database errors (such as Prisma errors) in production environments
 * to prevent leaking internal database schema, connection strings, or query details to end users,
 * while safely serializing and logging the full error details to server logs.
 *
 * @param error - The error or unknown value caught in server handlers.
 * @returns A generic safe Error if redacted in production, or the original error/value otherwise.
 */
export const redactError = <T extends Error | unknown>(error: T): T | Error => {
  if (!(error instanceof Error)) {
    return error;
  }
  log.debug("Type of Error: ", error.constructor);
  if (shouldRedact(error) && IS_PRODUCTION) {
    log.error("Error: ", safeStringify(error));
    return new Error("An error occurred while querying the database.");
  }
  return error;
};

export default redactError;
