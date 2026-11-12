import { describe, expect, it } from "vitest";
import { isValidMobileNumber } from "@/lib/mobileNumber";

describe("isValidMobileNumber", () => {
  it.each(["9876543210", "+91 98765-43210"])("accepts %s", (phone) => {
    expect(isValidMobileNumber(phone)).toBe(true);
  });

  it.each(["", "12345", "abcdefghij", "987654321012345678901"])("rejects %s", (phone) => {
    expect(isValidMobileNumber(phone)).toBe(false);
  });
});
