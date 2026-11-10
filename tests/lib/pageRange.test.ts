import { describe, it, expect } from "vitest";
import { parsePageRange, describePages } from "@/lib/pageRange";

describe("parsePageRange", () => {
  it("empty means every page", () => {
    expect(parsePageRange("", 3)).toEqual({ ok: true, pages: [1, 2, 3] });
    expect(parsePageRange("  ,, ", 2)).toEqual({ ok: true, pages: [1, 2] });
  });
  it("single pages, ranges and mixes", () => {
    expect(parsePageRange("2", 5)).toEqual({ ok: true, pages: [2] });
    expect(parsePageRange("1-3", 5)).toEqual({ ok: true, pages: [1, 2, 3] });
    expect(parsePageRange("1-3, 5", 5)).toEqual({ ok: true, pages: [1, 2, 3, 5] });
    expect(parsePageRange(" 2 – 3 ,5 ", 5)).toEqual({ ok: true, pages: [2, 3, 5] }); // spaces and an en dash
  });
  it("drops duplicates but keeps the typed order", () => {
    expect(parsePageRange("1-3, 2-4", 5)).toEqual({ ok: true, pages: [1, 2, 3, 4] });
    expect(parsePageRange("5,1", 5)).toEqual({ ok: true, pages: [5, 1] });
  });
  it("rejects pages past the end or before 1", () => {
    expect(parsePageRange("6", 5)).toMatchObject({ ok: false, error: expect.stringContaining("only 5 pages") });
    expect(parsePageRange("1-9", 5).ok).toBe(false);
    expect(parsePageRange("0", 5)).toMatchObject({ ok: false });
    expect(parsePageRange("1", 1)).toEqual({ ok: true, pages: [1] });
    expect(parsePageRange("2", 1)).toMatchObject({ ok: false, error: expect.stringContaining("only 1 page") });
  });
  it("rejects backwards ranges and junk", () => {
    expect(parsePageRange("5-2", 9)).toMatchObject({ ok: false, error: expect.stringContaining("2-5") });
    for (const bad of ["a", "1-", "-3", "1--3", "1.5", "1-2-3", "all"]) expect(parsePageRange(bad, 9).ok).toBe(false);
  });
  it("handles a huge range quickly within the file's page count", () => {
    const r = parsePageRange("1-2000", 2000);
    expect(r.ok && r.pages.length).toBe(2000);
  });
});

describe("describePages", () => {
  it("joins consecutive pages into ranges", () => {
    expect(describePages([1, 2, 3, 5, 6, 9])).toBe("1-3, 5-6, 9");
    expect(describePages([4])).toBe("4");
    expect(describePages([5, 1, 2])).toBe("1-2, 5");
    expect(describePages([])).toBe("");
  });
});
