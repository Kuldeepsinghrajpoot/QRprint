import { describe, it, expect, vi } from "vitest";
import { generateOtp, hashOtp, otpMatches } from "@/lib/otp";
import { encryptSecret, decryptSecret, encryptionKeyProblem } from "@/lib/secretBox";
import { newCancelKey, hashCancelKey, cancelKeyMatches } from "@/lib/cancelKey";
import { newAgentKey, hashAgentKey, newShopId, customerUrl } from "@/lib/shop";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

vi.mock("@/models/Shop", () => ({ Shop: {} }));

describe("otp", () => {
  it("generates 6-digit numeric codes", () => {
    for (let i = 0; i < 100; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });
  it("matches only the right email+code", () => {
    const h = hashOtp("A@x.com", "123456");
    expect(otpMatches("a@x.com", "123456", h)).toBe(true); // email is case-insensitive
    expect(otpMatches("a@x.com", "123457", h)).toBe(false);
    expect(otpMatches("b@x.com", "123456", h)).toBe(false);
  });
  it("does not throw on a malformed stored hash", () => {
    expect(otpMatches("a@x.com", "123456", "zz")).toBe(false);
    expect(otpMatches("a@x.com", "123456", "")).toBe(false);
  });
});

describe("secretBox", () => {
  it("round-trips, including unicode", () => {
    for (const s of ["rzp_secret", "", "pässwörd-🔑"]) expect(decryptSecret(encryptSecret(s))).toBe(s);
  });
  it("uses a fresh IV each time", () => expect(encryptSecret("x")).not.toBe(encryptSecret("x")));
  it("returns null for empty, garbage, or tampered values", () => {
    expect(decryptSecret(null)).toBeNull();
    expect(decryptSecret(undefined)).toBeNull();
    expect(decryptSecret("not.valid")).toBeNull();
    const [iv, tag, enc] = encryptSecret("secret").split(".");
    const flipped = Buffer.from(enc, "base64");
    flipped[0] ^= 1;
    expect(decryptSecret([iv, tag, flipped.toString("base64")].join("."))).toBeNull();
  });
  it("returns null when the key changed", () => {
    vi.stubEnv("SECRET_ENCRYPTION_KEY", "key-one");
    const packed = encryptSecret("secret");
    vi.stubEnv("SECRET_ENCRYPTION_KEY", "key-two");
    expect(decryptSecret(packed)).toBeNull();
  });
  it("refuses weak keys in production only", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "short");
    vi.stubEnv("SECRET_ENCRYPTION_KEY", "");
    expect(encryptionKeyProblem()).toMatch(/SECRET_ENCRYPTION_KEY/);
    expect(() => encryptSecret("x")).toThrow();
    vi.stubEnv("SECRET_ENCRYPTION_KEY", "x".repeat(40));
    expect(encryptionKeyProblem()).toBeNull();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SECRET_ENCRYPTION_KEY", "");
    expect(encryptionKeyProblem()).toBeNull();
  });
});

describe("cancelKey", () => {
  it("matches the key it was hashed from", () => {
    const k = newCancelKey();
    expect(k).toMatch(/^[a-f0-9]{32}$/);
    expect(cancelKeyMatches(k, hashCancelKey(k))).toBe(true);
  });
  it("rejects wrong, missing keys", () => {
    const h = hashCancelKey(newCancelKey());
    expect(cancelKeyMatches(newCancelKey(), h)).toBe(false);
    expect(cancelKeyMatches(undefined, h)).toBe(false);
    expect(cancelKeyMatches("abc", undefined)).toBe(false);
    expect(cancelKeyMatches("", "")).toBe(false);
  });
});

describe("shop keys & urls", () => {
  it("agent keys are prefixed and hash is whitespace-insensitive", () => {
    const k = newAgentKey();
    expect(k).toMatch(/^qpa_[a-f0-9]{48}$/);
    expect(hashAgentKey(`  ${k}\n`)).toBe(hashAgentKey(k));
    expect(hashAgentKey(k)).not.toBe(hashAgentKey(newAgentKey()));
  });
  it("shop ids are 12 hex chars", () => expect(newShopId()).toMatch(/^[a-f0-9]{12}$/));
  it("customerUrl falls back to app url + slug or id", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test/");
    expect(customerUrl("abc123", "ravi")).toBe("https://app.test/ravi");
    expect(customerUrl("abc123", null)).toBe("https://app.test/abc123");
  });
});

describe("rateLimit", () => {
  it("allows up to the limit then blocks, counting down remaining", () => {
    const key = "k-" + Math.random();
    expect(rateLimit(key, 3, 1000)).toEqual({ ok: true, remaining: 2 });
    expect(rateLimit(key, 3, 1000)).toEqual({ ok: true, remaining: 1 });
    expect(rateLimit(key, 3, 1000)).toEqual({ ok: true, remaining: 0 });
    expect(rateLimit(key, 3, 1000)).toEqual({ ok: false, remaining: 0 });
  });
  it("keys are independent and the window resets", () => {
    vi.useFakeTimers();
    const a = "a-" + Math.random();
    rateLimit(a, 1, 1000);
    expect(rateLimit(a, 1, 1000).ok).toBe(false);
    expect(rateLimit("b-" + Math.random(), 1, 1000).ok).toBe(true);
    vi.advanceTimersByTime(1001);
    expect(rateLimit(a, 1, 1000).ok).toBe(true);
    vi.useRealTimers();
  });
  it("getClientIp prefers x-real-ip, then first x-forwarded-for", () => {
    const r = (h: Record<string, string>) => new Request("http://x", { headers: h });
    expect(getClientIp(r({ "x-real-ip": " 1.1.1.1 ", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(getClientIp(r({ "x-forwarded-for": "2.2.2.2, 3.3.3.3" }))).toBe("2.2.2.2");
    expect(getClientIp(r({}))).toBe("unknown");
  });
});
