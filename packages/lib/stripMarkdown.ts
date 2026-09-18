import removeMd from "remove-markdown";

/**
 * Safely strips Markdown formatting from a string, returning plain text.
 * Handles null or undefined inputs safely by returning an empty string.
 *
 * @param md - The Markdown string to strip.
 * @returns Plain text without Markdown formatting.
 */
export function stripMarkdown(md?: string | null): string {
  if (!md) {
    return "";
  }
  return removeMd(md);
}
