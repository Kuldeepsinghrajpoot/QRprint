import { describe, it, expect, vi, afterEach } from "vitest";
import { buildOrderFilter, zonedDayStart, addDays, todayKey } from "@/lib/orderFilter";

const sp = (q: string) => new URLSearchParams(q);

describe("zonedDayStart / addDays", () => {
  it("returns IST midnight as UTC", () => {
    expect(zonedDayStart("2026-11-10", "Asia/Kolkata").toISOString()).toBe("2026-11-09T18:30:00.000Z");
  });
  it("handles DST zones", () => {
    expect(zonedDayStart("2026-07-01", "America/New_York").toISOString()).toBe("2026-07-01T04:00:00.000Z");
    expect(zonedDayStart("2026-01-01", "America/New_York").toISOString()).toBe("2026-01-01T05:00:00.000Z");
  });
  it("addDays crosses month/year/leap boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(addDays("2026-11-10", -29)).toBe("2026-10-12");
  });
});

describe("buildOrderFilter", () => {
  afterEach(() => vi.useRealTimers());

  it("always scopes to the shop", () => {
    expect(buildOrderFilter("s1", sp(""))).toEqual({ shopId: "s1" });
  });
  it("accepts only known status/payment/method values", () => {
    const f = buildOrderFilter("s1", sp("status=ready&payment=paid&method=cash"));
    expect(f).toMatchObject({ printStatus: "ready", paymentStatus: "paid", paymentMethod: "cash" });
    const bad = buildOrderFilter("s1", sp("status=$ne&payment=x&method=bitcoin"));
    expect(bad).toEqual({ shopId: "s1" });
  });
  it("custom range is inclusive of the 'to' day", () => {
    const f = buildOrderFilter("s1", sp("range=custom&from=2026-11-01&to=2026-11-03")) as { createdAt: { $gte: Date; $lt: Date } };
    expect(f.createdAt.$gte.toISOString()).toBe("2026-10-31T18:30:00.000Z");
    expect(f.createdAt.$lt.toISOString()).toBe("2026-11-03T18:30:00.000Z");
  });
  it("ignores malformed custom dates", () => {
    expect(buildOrderFilter("s1", sp("range=custom&from=yesterday&to=2026-13"))).toEqual({ shopId: "s1" });
  });
  it("ignores from/to unless range=custom", () => {
    expect(buildOrderFilter("s1", sp("from=2026-11-01&to=2026-11-03"))).toEqual({ shopId: "s1" });
  });
  it("today / 7 / 30 are relative to the shop's today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T04:00:00Z")); // 09:30 IST on the 10th
    expect(todayKey("Asia/Kolkata")).toBe("2026-11-10");
    const t = buildOrderFilter("s1", sp("range=today")) as { createdAt: { $gte: Date; $lt: Date } };
    expect(t.createdAt.$gte.toISOString()).toBe("2026-11-09T18:30:00.000Z");
    expect(t.createdAt.$lt.toISOString()).toBe("2026-11-10T18:30:00.000Z");
    const w = buildOrderFilter("s1", sp("range=7")) as { createdAt: { $gte: Date } };
    expect(w.createdAt.$gte.toISOString()).toBe("2026-11-03T18:30:00.000Z"); // 4 Nov IST start
    const m = buildOrderFilter("s1", sp("range=30")) as { createdAt: { $gte: Date } };
    expect(m.createdAt.$gte.toISOString()).toBe("2026-10-11T18:30:00.000Z"); // 12 Oct IST start
  });
  it("search escapes regex characters and caps length", () => {
    const f = buildOrderFilter("s1", sp("q=" + encodeURIComponent("a.*(b"))) as { $or: Record<string, RegExp>[] };
    const re = f.$or[0].customerName;
    expect(re.test("a.*(b")).toBe(true);
    expect(re.test("aXXb")).toBe(false);
    expect(f.$or.map((o) => Object.keys(o)[0])).toEqual(["customerName", "customerPhone", "token"]);
    const long = buildOrderFilter("s1", sp("q=" + "x".repeat(200))) as { $or: Record<string, RegExp>[] };
    expect(long.$or[0].customerName.source.length).toBe(60);
  });
  it("blank search adds nothing", () => expect(buildOrderFilter("s1", sp("q=%20%20"))).toEqual({ shopId: "s1" }));
});
