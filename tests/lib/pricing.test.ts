import { describe, it, expect } from "vitest";
import { calcOnlineFee, calcOrderPrice, countSides, countSheets, generateToken, FALLBACK_RATES, type PriceBreakdownInput } from "@/lib/pricing";

const base: PriceBreakdownInput = {
  rates: FALLBACK_RATES,
  paperSize: "A4",
  printType: "bw",
  pages: 1,
  copies: 1,
  duplex: false,
  binding: "none",
  priority: false,
  duplexDiscountPercent: 0,
  bindingSpiralCharge: 30,
  bindingLaminationCharge: 5,
  priorityFeePercent: 0,
  gstEnabled: false,
  gstPercent: 18,
};
const price = (o: Partial<PriceBreakdownInput>) => calcOrderPrice({ ...base, ...o });

describe("countSides / countSheets", () => {
  it("rounds up pages-per-sheet", () => {
    expect(countSides(10, 4)).toBe(3);
    expect(countSides(8, 4)).toBe(2);
  });
  it("defaults and clamps bad input", () => {
    expect(countSides(5)).toBe(5);
    expect(countSides(5, 0)).toBe(5);
    expect(countSides(5, NaN)).toBe(5);
    expect(countSides(-3, 2)).toBe(0);
    expect(countSides(5, 2.9)).toBe(3);
  });
  it("duplex halves sheets (rounded up)", () => {
    expect(countSheets(5, 1, true)).toBe(3);
    expect(countSheets(5, 1, false)).toBe(5);
    expect(countSheets(8, 2, true)).toBe(2);
  });
});

describe("calcOrderPrice tiers", () => {
  it("0 pages is free", () => expect(price({ pages: 0 }).baseCost).toBe(0));
  it("1 page uses page1 rate", () => expect(price({ pages: 1 }).total).toBe(5));
  it("pages 2-10 use the middle rate", () => {
    expect(price({ pages: 2 }).baseCost).toBe(5 + 4);
    expect(price({ pages: 10 }).baseCost).toBe(5 + 9 * 4);
  });
  it("pages 11+ use the top rate", () => {
    expect(price({ pages: 11 }).baseCost).toBe(5 + 9 * 4 + 3);
    expect(price({ pages: 100 }).baseCost).toBe(5 + 9 * 4 + 90 * 3);
  });
  it("matches a naive per-page loop for every page count", () => {
    const rate = FALLBACK_RATES.A4.color;
    let sum = 0;
    for (let n = 1; n <= 60; n++) {
      sum += n === 1 ? rate.page1 : n <= 10 ? rate.page2to10 : rate.page11plus;
      expect(price({ printType: "color", pages: n }).baseCost).toBe(sum);
    }
  });
  it("uses paper size and colour rates", () => {
    expect(price({ paperSize: "A3", printType: "color", pages: 1 }).baseCost).toBe(18);
    expect(price({ paperSize: "Photo", pages: 1 }).baseCost).toBe(15);
  });
  it("multiplies by copies, treating 0 copies as 1 for base cost", () => {
    expect(price({ pages: 2, copies: 3 }).baseCost).toBe(27);
    expect(price({ pages: 2, copies: 0 }).baseCost).toBe(9);
  });
  it("stays instant for absurd page counts", () => {
    const t = Date.now();
    expect(price({ pages: 1e9 }).baseCost).toBeGreaterThan(0);
    expect(Date.now() - t).toBeLessThan(50);
  });
});

describe("calcOrderPrice extras", () => {
  it("applies pages-per-sheet before pricing", () => {
    const r = price({ pages: 8, pagesPerSheet: 4 });
    expect(r.sides).toBe(2);
    expect(r.baseCost).toBe(9);
  });
  it("applies duplex discount with rounding", () => {
    const r = price({ pages: 10, duplex: true, duplexDiscountPercent: 10 });
    expect(r.baseCost).toBe(41);
    expect(r.duplexDiscount).toBe(4); // 4.1 -> 4
    expect(r.subtotal).toBe(37);
    expect(r.sheets).toBe(5);
  });
  it("no discount when not duplex", () => expect(price({ pages: 10, duplexDiscountPercent: 50 }).duplexDiscount).toBe(0));
  it("spiral binding is per copy", () => expect(price({ binding: "spiral", copies: 2 }).bindingCharge).toBe(60));
  it("lamination is per sheet per copy", () => {
    expect(price({ binding: "lamination", pages: 4, copies: 2 }).bindingCharge).toBe(5 * 4 * 2);
    expect(price({ binding: "lamination", pages: 4, duplex: true }).bindingCharge).toBe(5 * 2);
  });
  it("priority fee and GST stack on the subtotal", () => {
    const r = price({ pages: 10, priority: true, priorityFeePercent: 20, gstEnabled: true, gstPercent: 18 });
    expect(r.subtotal).toBe(41);
    expect(r.priorityFee).toBe(8);
    expect(r.gstAmount).toBe(Math.round((49 * 18) / 100));
    expect(r.total).toBe(49 + r.gstAmount);
  });
  it("GST/priority ignored when disabled", () => {
    const r = price({ pages: 10, priority: false, priorityFeePercent: 50, gstEnabled: false });
    expect(r.total).toBe(41);
  });
  it("never goes negative with a 100%+ duplex discount", () => {
    expect(price({ pages: 3, duplex: true, duplexDiscountPercent: 150 }).subtotal).toBe(0);
  });
  it("total is always an integer", () => {
    const r = price({ pages: 7, copies: 3, duplex: true, duplexDiscountPercent: 13, priority: true, priorityFeePercent: 7, gstEnabled: true, gstPercent: 18 });
    expect(Number.isInteger(r.total)).toBe(true);
  });
});

describe("generateToken", () => {
  it("looks like a letter plus three digits", () => {
    for (let i = 0; i < 200; i++) expect(generateToken()).toMatch(/^[A-Z][1-9]\d{2}$/);
  });
});

describe("calcOnlineFee", () => {
  it("is zero when disabled, free, or 0%", () => {
    expect(calcOnlineFee(500, false, 2, 18)).toEqual({ fee: 0, gst: 0, total: 0 });
    expect(calcOnlineFee(0, true, 2, 18)).toEqual({ fee: 0, gst: 0, total: 0 });
    expect(calcOnlineFee(500, true, 0, 18)).toEqual({ fee: 0, gst: 0, total: 0 });
  });
  it("2% + 18% GST on the fee (Razorpay)", () => {
    expect(calcOnlineFee(500, true, 2, 18)).toEqual({ fee: 10, gst: 2, total: 12 }); // 1.8 -> 2
    expect(calcOnlineFee(1000, true, 2, 18)).toEqual({ fee: 20, gst: 4, total: 24 }); // 3.6 -> 4
  });
  it("rounds whole rupees and supports other rates", () => {
    expect(calcOnlineFee(100, true, 2, 18)).toEqual({ fee: 2, gst: 0, total: 2 });
    expect(calcOnlineFee(500, true, 1.5, 0)).toEqual({ fee: 8, gst: 0, total: 8 });
    expect(Number.isInteger(calcOnlineFee(333, true, 2.4, 18).total)).toBe(true);
  });
});

import { isOffered, offeredTypes, offeredSizes, nearestOffered } from "@/lib/pricing";

describe("availability", () => {
  it("everything is offered when nothing is set (older shops)", () => {
    expect(isOffered(undefined, "A3", "color")).toBe(true);
    expect(isOffered({}, "Photo", "bw")).toBe(true);
    expect(offeredTypes(null)).toEqual(["bw", "color"]);
    expect(offeredSizes(undefined, "bw")).toHaveLength(5);
  });
  it("only an explicit false hides a combination", () => {
    const a = { A3: { color: false }, Photo: { bw: false, color: false } };
    expect(isOffered(a, "A3", "color")).toBe(false);
    expect(isOffered(a, "A3", "bw")).toBe(true);
    expect(offeredSizes(a, "color")).toEqual(["A4", "Legal", "Letter"]);
    expect(offeredSizes(a, "bw")).toEqual(["A4", "A3", "Legal", "Letter"]);
  });
  it("a type counts as offered if any size has it", () => {
    const bwOnly = { A4: { color: false }, A3: { color: false }, Legal: { color: false }, Letter: { color: false }, Photo: { color: false } };
    expect(offeredTypes(bwOnly)).toEqual(["bw"]);
  });
  it("nearestOffered keeps a valid choice and otherwise falls back sensibly", () => {
    const a = { A4: { color: false }, A3: { bw: false }, Photo: { bw: false, color: false } };
    expect(nearestOffered(a, "A4", "bw")).toEqual({ paperSize: "A4", printType: "bw" });
    expect(nearestOffered(a, "Photo", "color")).toEqual({ paperSize: "A3", printType: "color" }); // A4 colour is off, A3 is the first colour size left
    expect(nearestOffered(a, "A3", "bw")).toEqual({ paperSize: "A4", printType: "bw" });
  });
  it("nearestOffered returns null when nothing is offered", () => {
    const none = Object.fromEntries(["A4", "A3", "Legal", "Letter", "Photo"].map((s) => [s, { bw: false, color: false }]));
    expect(nearestOffered(none, "A4", "bw")).toBeNull();
    expect(offeredTypes(none)).toEqual([]);
  });
});
