import { describe, expect, it } from "vitest";

import { contructEmailFromPhoneNumber } from "./contructEmailFromPhoneNumber";

describe("contructEmailFromPhoneNumber", () => {
  it("should construct sms email from clean phone number", () => {
    expect(contructEmailFromPhoneNumber("+12025550123")).toBe("12025550123@sms.cal.com");
  });

  it("should strip spaces, dashes, and parentheses from phone number", () => {
    expect(contructEmailFromPhoneNumber("+1 (202) 555-0123")).toBe("12025550123@sms.cal.com");
  });

  it("should handle phone number without plus sign", () => {
    expect(contructEmailFromPhoneNumber("12025550123")).toBe("12025550123@sms.cal.com");
  });

  it("should safely handle empty or non-string input", () => {
    expect(contructEmailFromPhoneNumber("")).toBe("@sms.cal.com");
  });
});
