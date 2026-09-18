import { describe, expect, it } from "vitest";

import { extractBaseEmail } from "./extract-base-email";

describe("extractBaseEmail", () => {
  it("should extract base email with plus alias", () => {
    expect(extractBaseEmail("user+tag@example.com")).toBe("user@example.com");
  });

  it("should extract base email with multiple plus aliases", () => {
    expect(extractBaseEmail("user+tag+extra@example.com")).toBe("user@example.com");
  });

  it("should return unchanged email when no plus tag is present", () => {
    expect(extractBaseEmail("user@example.com")).toBe("user@example.com");
  });

  it("should handle domain with special characters safely", () => {
    expect(extractBaseEmail("user+test@sub.domain.co.uk")).toBe("user@sub.domain.co.uk");
  });

  it("should safely return invalid email without crash", () => {
    expect(extractBaseEmail("invalidemail")).toBe("invalidemail");
    expect(extractBaseEmail("")).toBe("");
  });
});
