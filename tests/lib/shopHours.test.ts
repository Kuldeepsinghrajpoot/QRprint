import { describe, it, expect } from "vitest";
import { shopOpenStatus, fmtTime } from "@/lib/shopHours";

// 2026-11-09 is a Monday. IST = UTC+5:30.
const ist = (iso: string) => new Date(`${iso}+05:30`);
const cfg = { openingHoursEnabled: true, openTime: "09:00", closeTime: "21:00", timezone: "Asia/Kolkata" };

describe("fmtTime", () => {
  it.each([
    ["00:00", "12:00 AM"],
    ["09:05", "9:05 AM"],
    ["12:00", "12:00 PM"],
    ["21:00", "9:00 PM"],
    ["23:59", "11:59 PM"],
  ])("%s -> %s", (i, o) => expect(fmtTime(i)).toBe(o));
  it("treats missing/invalid as midnight", () => {
    expect(fmtTime(undefined)).toBe("12:00 AM");
    expect(fmtTime("abc")).toBe("12:00 AM");
  });
});

describe("shopOpenStatus", () => {
  it("is always open when the feature is off", () => {
    expect(shopOpenStatus({ openingHoursEnabled: false, openTime: "09:00", closeTime: "10:00" }, ist("2026-11-09T03:00:00"))).toEqual({ open: true, message: "" });
  });
  it("open inside hours, closed at/after closing and before opening", () => {
    expect(shopOpenStatus(cfg, ist("2026-11-09T09:00:00")).open).toBe(true);
    expect(shopOpenStatus(cfg, ist("2026-11-09T20:59:00")).open).toBe(true);
    expect(shopOpenStatus(cfg, ist("2026-11-09T21:00:00")).open).toBe(false);
    expect(shopOpenStatus(cfg, ist("2026-11-09T08:59:00")).open).toBe(false);
  });
  it("closed message lists hours and days", () => {
    const r = shopOpenStatus({ ...cfg, openDays: [1, 2, 3] }, ist("2026-11-09T22:00:00"));
    expect(r.message).toContain("9:00 AM to 9:00 PM");
    expect(r.message).toContain("Mon, Tue, Wed");
    expect(shopOpenStatus(cfg, ist("2026-11-09T22:00:00")).message).toContain("every day");
  });
  it("respects open days", () => {
    const c = { ...cfg, openDays: [1] }; // Monday only
    expect(shopOpenStatus(c, ist("2026-11-09T12:00:00")).open).toBe(true);
    expect(shopOpenStatus(c, ist("2026-11-10T12:00:00")).open).toBe(false);
  });
  it("same open and close time means all day on open days", () => {
    const c = { ...cfg, openTime: "00:00", closeTime: "00:00", openDays: [1] };
    expect(shopOpenStatus(c, ist("2026-11-09T03:00:00")).open).toBe(true);
    expect(shopOpenStatus(c, ist("2026-11-10T03:00:00")).open).toBe(false);
  });
  it("handles hours that run past midnight", () => {
    const c = { ...cfg, openTime: "18:00", closeTime: "02:00", openDays: [1] }; // Monday evening
    expect(shopOpenStatus(c, ist("2026-11-09T19:00:00")).open).toBe(true); // Mon 19:00
    expect(shopOpenStatus(c, ist("2026-11-10T01:00:00")).open).toBe(true); // Tue 01:00 (Monday's shift)
    expect(shopOpenStatus(c, ist("2026-11-10T03:00:00")).open).toBe(false);
    expect(shopOpenStatus(c, ist("2026-11-10T19:00:00")).open).toBe(false); // Tue evening not an open day
  });
  it("evaluates in the shop's own timezone", () => {
    const now = new Date("2026-11-09T08:00:00Z"); // 13:30 IST (open), 00:00 in Los Angeles (closed)
    expect(shopOpenStatus(cfg, now).open).toBe(true);
    expect(shopOpenStatus({ ...cfg, timezone: "America/Los_Angeles" }, now).open).toBe(false);
  });
  it("falls back to Asia/Kolkata for an invalid timezone", () => {
    expect(shopOpenStatus({ ...cfg, timezone: "Not/AZone" }, ist("2026-11-09T12:00:00")).open).toBe(true);
  });
  it("uses defaults 9-21 when times are missing", () => {
    const c = { openingHoursEnabled: true };
    expect(shopOpenStatus(c, ist("2026-11-09T12:00:00")).open).toBe(true);
    expect(shopOpenStatus(c, ist("2026-11-09T22:00:00")).open).toBe(false);
  });
});
