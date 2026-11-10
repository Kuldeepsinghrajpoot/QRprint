import { describe, it, expect, vi, beforeEach } from "vitest";

async function load(template = "https://{slug}.qr.example.in") {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SHOP_URL_TEMPLATE", template);
  return import("@/lib/shopUrl");
}

describe("slugify", () => {
  it.each([
    ["Ravi's Xerox & Prints!", "ravis-xerox-prints"],
    ["  Café  Déjà  ", "cafe-deja"],
    ["---a---b---", "a-b"],
    ["UPPER Case 123", "upper-case-123"],
    ["!!!", ""],
  ])("%j -> %j", async (i, o) => expect((await load()).slugify(i)).toBe(o));
  it("caps at 30 chars with no trailing hyphen", async () => {
    const s = (await load()).slugify("a".repeat(29) + " bbbb");
    expect(s.length).toBeLessThanOrEqual(30);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("validateSlug", () => {
  it("accepts good slugs", async () => expect((await load()).validateSlug("ravi-xerox")).toBeNull());
  it.each(["ab", "a".repeat(31), "Ravi", "-ab", "ab-", "a--b", "a_b", "admin", "api", "pricing"])("rejects %s", async (s) =>
    expect((await load()).validateSlug(s)).toEqual(expect.any(String))
  );
});

describe("sub-address handling", () => {
  beforeEach(() => vi.resetModules());
  it("builds a shop url from the template", async () => {
    const m = await load();
    expect(m.shopUrlForSlug("ravi")).toBe("https://ravi.qr.example.in");
  });
  it("returns empty without a template", async () => {
    const m = await load("");
    expect(m.shopUrlForSlug("ravi")).toBe("");
    expect(m.slugFromHostname("ravi.qr.example.in")).toBe("");
  });
  it("extracts the slug from a hostname", async () => {
    const m = await load();
    expect(m.slugFromHostname("ravi-xerox.qr.example.in")).toBe("ravi-xerox");
    expect(m.slugFromHostname("RAVI.qr.example.in:3000")).toBe("ravi");
    expect(m.isShopHost("ravi.qr.example.in")).toBe(true);
  });
  it("ignores main host, other hosts, reserved and nested subdomains", async () => {
    const m = await load();
    for (const h of ["qr.example.in", "other.com", "admin.qr.example.in", "a.b.qr.example.in", "evilqr.example.in"]) expect(m.slugFromHostname(h)).toBe("");
  });
  it("works with a localhost template", async () => {
    const m = await load("http://{slug}.qr.localhost:3000");
    expect(m.slugFromHostname("ravi.qr.localhost:3000")).toBe("ravi");
  });
});
