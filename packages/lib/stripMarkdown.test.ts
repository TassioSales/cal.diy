import { describe, expect, it } from "vitest";

import { stripMarkdown } from "./stripMarkdown";

describe("stripMarkdown", () => {
  it("should strip markdown headers, bold, italics, and links", () => {
    const md = "# Title\n\nThis is **bold** and *italic* with a [link](https://example.com).";
    const result = stripMarkdown(md);
    expect(result).toBe("Title\n\nThis is bold and italic with a link.");
  });

  it("should safely handle null input", () => {
    expect(stripMarkdown(null)).toBe("");
  });

  it("should safely handle undefined input", () => {
    expect(stripMarkdown(undefined)).toBe("");
  });

  it("should safely handle empty string", () => {
    expect(stripMarkdown("")).toBe("");
  });
});
