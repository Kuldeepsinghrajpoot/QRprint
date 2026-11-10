import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

const shopDoc = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock("@/lib/mongodb", () => ({ connectDB: vi.fn(async () => undefined) }));
vi.mock("@/models/Shop", () => ({
  PAYMENT_FIELDS: "x",
  Shop: { findOne: () => ({ select: () => ({ lean: async () => shopDoc.current }) }) },
}));

const rzpOrder = vi.hoisted(() => ({ fn: vi.fn() }));
// The Razorpay SDK talks over axios, not fetch, so its order lookup is stubbed; the signature logic stays real.
vi.mock("@/lib/razorpay", async (orig) => ({ ...(await orig<typeof import("@/lib/razorpay")>()), fetchRazorpayOrder: rzpOrder.fn }));

import { encryptSecret } from "@/lib/secretBox";
import { verifyRazorpaySignature, platformRazorpayCreds } from "@/lib/razorpay";
import { paytmSignature, paytmHost, defaultPaytmWebsite, createPaytmTxn, fetchPaytmStatus, refundPaytm, checkPaytmKeys } from "@/lib/payments/paytm";
import { createPhonePeOrder, fetchPhonePeStatus, refundPhonePe, checkPhonePeKeys, PhonePeError } from "@/lib/payments/phonepe";
import { isProvider, PROVIDERS } from "@/lib/payments/types";
import { activeProviderOf, getGateway, verifyPayment, refundOnlinePayment, type Gateway } from "@/lib/payments";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const mockFetch = (...responses: Response[]) => {
  const f = vi.fn();
  responses.forEach((r) => f.mockResolvedValueOnce(r));
  vi.stubGlobal("fetch", f);
  return f;
};

beforeEach(() => {
  shopDoc.current = null;
  vi.stubEnv("RAZORPAY_KEY_ID", "");
  vi.stubEnv("RAZORPAY_KEY_SECRET", "");
});

describe("provider helpers", () => {
  it("isProvider", () => {
    for (const p of PROVIDERS) expect(isProvider(p)).toBe(true);
    for (const v of ["stripe", "", null, undefined, 1, "RAZORPAY"]) expect(isProvider(v)).toBe(false);
  });
  it("activeProviderOf defaults to razorpay", () => {
    expect(activeProviderOf(null)).toBe("razorpay");
    expect(activeProviderOf({})).toBe("razorpay");
    expect(activeProviderOf({ paymentProvider: "paytm" })).toBe("paytm");
  });
});

describe("razorpay signature", () => {
  const creds = { keyId: "k", keySecret: "s3cret", source: "shop" as const };
  const sig = crypto.createHmac("sha256", "s3cret").update("order_1|pay_1").digest("hex");
  it("accepts a valid signature", () => expect(verifyRazorpaySignature(creds, { orderId: "order_1", paymentId: "pay_1", signature: sig })).toBe(true));
  it("rejects wrong, tampered, or different-length signatures", () => {
    expect(verifyRazorpaySignature(creds, { orderId: "order_1", paymentId: "pay_2", signature: sig })).toBe(false);
    expect(verifyRazorpaySignature(creds, { orderId: "order_1", paymentId: "pay_1", signature: "abc" })).toBe(false);
    expect(verifyRazorpaySignature({ ...creds, keySecret: "other" }, { orderId: "order_1", paymentId: "pay_1", signature: sig })).toBe(false);
  });
  it("platformRazorpayCreds needs both env vars", () => {
    expect(platformRazorpayCreds()).toBeNull();
    vi.stubEnv("RAZORPAY_KEY_ID", "id");
    expect(platformRazorpayCreds()).toBeNull();
    vi.stubEnv("RAZORPAY_KEY_SECRET", "sec");
    expect(platformRazorpayCreds()).toEqual({ keyId: "id", keySecret: "sec", source: "platform" });
  });
});

describe("paytm helpers", () => {
  it("signature is decryptable and contains sha256(body|salt)+salt", () => {
    const key = "0123456789abcdef";
    const body = '{"a":1}';
    const sig = paytmSignature(body, key);
    const d = crypto.createDecipheriv("aes-128-cbc", key, "@@@@&&&&####$$$$");
    const plain = d.update(sig, "base64", "binary") + d.final("binary");
    const salt = plain.slice(-4);
    expect(salt).toHaveLength(4);
    expect(plain.slice(0, -4)).toBe(crypto.createHash("sha256").update(`${body}|${salt}`).digest("hex"));
  });
  it("hosts and default website per mode, with env override", () => {
    expect(paytmHost("live")).toBe("https://secure.paytmpayments.com");
    expect(paytmHost("test")).toBe("https://securestage.paytmpayments.com");
    vi.stubEnv("PAYTM_LIVE_HOST", " https://securegw.paytm.in/// ");
    expect(paytmHost("live")).toBe("https://securegw.paytm.in");
    expect(defaultPaytmWebsite("live")).toBe("DEFAULT");
    expect(defaultPaytmWebsite("test")).toBe("WEBSTAGING");
  });
});

const ptm = { mid: "MID1", merchantKey: "0123456789abcdef", website: "WEB", mode: "test" as const };
const ppe = { clientId: "c", clientVersion: "1", clientSecret: "sec", mode: "test" as const };

describe("paytm API", () => {
  it("createPaytmTxn formats the amount and returns the token", async () => {
    const f = mockFetch(json({ body: { resultInfo: { resultStatus: "S" }, txnToken: "tok" } }));
    const r = await createPaytmTxn(ptm, { orderId: "qrp_1", amountRupees: 12.5, custId: "c1" });
    expect(r).toEqual({ txnToken: "tok", amount: "12.50", scriptUrl: "https://securestage.paytmpayments.com/merchantpgpui/checkoutjs/merchants/MID1.js" });
    const [url, init] = f.mock.calls[0];
    expect(url).toContain("/theia/api/v1/initiateTransaction?mid=MID1&orderId=qrp_1");
    expect(JSON.parse(init.body).body.txnAmount).toEqual({ value: "12.50", currency: "INR" });
    expect(JSON.parse(init.body).head.signature).toEqual(expect.any(String));
  });
  it("createPaytmTxn throws on failure", async () => {
    mockFetch(json({ body: { resultInfo: { resultStatus: "F", resultCode: "501", resultMsg: "bad" } } }));
    await expect(createPaytmTxn(ptm, { orderId: "x", amountRupees: 1, custId: "c" })).rejects.toThrow(/501/);
  });
  it.each([
    ["TXN_SUCCESS", "SUCCESS"],
    ["TXN_FAILURE", "FAILED"],
    ["PENDING", "PENDING"],
    ["WHAT", "UNKNOWN"],
  ])("fetchPaytmStatus maps %s -> %s", async (s, state) => {
    mockFetch(json({ body: { resultInfo: { resultStatus: s }, txnAmount: "10.10", txnId: "T1" } }));
    const r = await fetchPaytmStatus(ptm, "qrp_1");
    expect(r.state).toBe(state);
    expect(r.amountPaise).toBe(1010);
    expect(r.txnId).toBe("T1");
  });
  it("fetchPaytmStatus throws on 5xx and tolerates non-JSON", async () => {
    mockFetch(new Response("oops", { status: 502 }));
    await expect(fetchPaytmStatus(ptm, "x")).rejects.toThrow(/502/);
    mockFetch(new Response("<html>", { status: 200 }));
    expect((await fetchPaytmStatus(ptm, "x")).state).toBe("UNKNOWN");
  });
  it("refundPaytm accepts PENDING / TXN_SUCCESS, rejects others", async () => {
    const f = mockFetch(json({ body: { resultInfo: { resultStatus: "PENDING" } } }), json({ body: { resultInfo: { resultStatus: "TXN_SUCCESS" } } }), json({ body: { resultInfo: { resultStatus: "TXN_FAILURE" } } }));
    await expect(refundPaytm(ptm, { orderId: "o", txnId: "t", amountRupees: 5 })).resolves.toBeUndefined();
    await expect(refundPaytm(ptm, { orderId: "o", txnId: "t", amountRupees: 5 })).resolves.toBeUndefined();
    await expect(refundPaytm(ptm, { orderId: "o", txnId: "t", amountRupees: 5 })).rejects.toThrow(/refund failed/);
    const sent = JSON.parse(f.mock.calls[0][1].body).body;
    expect(sent).toMatchObject({ refId: "rfd_o", refundAmount: "5.00", txnType: "REFUND" });
  });
  it("checkPaytmKeys distinguishes bad keys, unreachable, and ok", async () => {
    mockFetch(json({ body: { resultInfo: { resultStatus: "F", resultCode: "330" } } }));
    expect((await checkPaytmKeys(ptm)).ok).toBe(false);
    mockFetch(json({}));
    expect(await checkPaytmKeys(ptm)).toMatchObject({ ok: false, reason: expect.stringContaining("Could not reach") });
    mockFetch(json({ body: { resultInfo: { resultStatus: "TXN_FAILURE", resultCode: "334" } } }));
    expect(await checkPaytmKeys(ptm)).toEqual({ ok: true });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("net")));
    expect((await checkPaytmKeys(ptm)).ok).toBe(false);
  });
});

const tokenOk = () => json({ access_token: "AT", expires_at: Math.floor(Date.now() / 1000) + 3600 });
let n = 0;
const uniq = () => ({ ...ppe, clientId: "c" + ++n }); // avoid the in-memory token cache across tests

describe("phonepe API", () => {
  it("createPhonePeOrder fetches a token then creates the order", async () => {
    const f = mockFetch(tokenOk(), json({ redirectUrl: "https://pay/x" }));
    const r = await createPhonePeOrder(uniq(), { merchantOrderId: "qrp_1", amountRupees: 49.99, redirectUrl: "https://app/" });
    expect(r).toEqual({ tokenUrl: "https://pay/x", amountPaise: 4999 });
    expect(f.mock.calls[0][0]).toContain("/oauth/token");
    expect(f.mock.calls[1][1].headers.Authorization).toBe("O-Bearer AT");
    expect(JSON.parse(f.mock.calls[1][1].body).amount).toBe(4999);
  });
  it("caches the token between calls", async () => {
    const c = uniq();
    const f = mockFetch(tokenOk(), json({ state: "PENDING" }), json({ state: "PENDING" }));
    await fetchPhonePeStatus(c, "a");
    await fetchPhonePeStatus(c, "b");
    expect(f).toHaveBeenCalledTimes(3);
  });
  it("retries once with a fresh token on 401", async () => {
    const f = mockFetch(tokenOk(), json({}, 401), tokenOk(), json({ state: "COMPLETED", amount: 100 }));
    expect((await fetchPhonePeStatus(uniq(), "a")).state).toBe("COMPLETED");
    expect(f).toHaveBeenCalledTimes(4);
  });
  it("create fails clearly", async () => {
    mockFetch(tokenOk(), json({ code: "BAD", message: "nope" }, 400));
    await expect(createPhonePeOrder(uniq(), { merchantOrderId: "a", amountRupees: 1, redirectUrl: "u" })).rejects.toThrow(/nope/);
  });
  it("token failure throws PhonePeError", async () => {
    mockFetch(json({ error: "invalid_client" }, 401));
    await expect(fetchPhonePeStatus(uniq(), "a")).rejects.toBeInstanceOf(PhonePeError);
  });
  it("status maps states, picks the completed attempt's transaction id", async () => {
    mockFetch(tokenOk(), json({ state: "COMPLETED", amount: 2500, paymentDetails: [{ state: "FAILED", transactionId: "bad" }, { state: "COMPLETED", transactionId: "good" }] }));
    expect(await fetchPhonePeStatus(uniq(), "a")).toEqual({ state: "COMPLETED", amountPaise: 2500, transactionId: "good" });
    mockFetch(tokenOk(), json({}, 404));
    expect((await fetchPhonePeStatus(uniq(), "a")).state).toBe("UNKNOWN");
    mockFetch(tokenOk(), json({ code: "X" }, 500));
    await expect(fetchPhonePeStatus(uniq(), "a")).rejects.toThrow(/500/);
  });
  it("refund uses a deterministic refund id and fails on FAILED", async () => {
    const f = mockFetch(tokenOk(), json({ state: "PENDING" }));
    await refundPhonePe(uniq(), { merchantOrderId: "qrp_9", amountRupees: 10 });
    expect(JSON.parse(f.mock.calls[1][1].body)).toEqual({ merchantRefundId: "rfd_qrp_9", originalMerchantOrderId: "qrp_9", amount: 1000 });
    mockFetch(tokenOk(), json({ state: "FAILED" }));
    await expect(refundPhonePe(uniq(), { merchantOrderId: "a", amountRupees: 1 })).rejects.toThrow(/refund failed/);
  });
  it("checkPhonePeKeys", async () => {
    mockFetch(tokenOk());
    expect(await checkPhonePeKeys(uniq())).toEqual({ ok: true });
    mockFetch(json({}, 401));
    expect(await checkPhonePeKeys(uniq())).toMatchObject({ ok: false, reason: expect.stringContaining("did not accept") });
    mockFetch(json({}, 503));
    expect(await checkPhonePeKeys(uniq())).toMatchObject({ ok: false, reason: expect.stringContaining("Could not reach") });
  });
});

describe("getGateway", () => {
  const rzpShop = () => ({ paymentProvider: "razorpay", razorpayKeyId: "rzp_k", razorpaySecretEnc: encryptSecret("rzp_s") });
  it("uses the shop's own razorpay keys", async () => {
    shopDoc.current = rzpShop();
    expect(await getGateway("s1")).toEqual({ provider: "razorpay", creds: { keyId: "rzp_k", keySecret: "rzp_s", source: "shop" } });
  });
  it("returns null when nothing is set up", async () => {
    expect(await getGateway("s1")).toBeNull();
    expect(await getGateway(null)).toBeNull();
  });
  it("falls back to platform razorpay only for razorpay shops", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "pid");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "psec");
    expect((await getGateway("s1"))?.provider).toBe("razorpay");
    shopDoc.current = { paymentProvider: "phonepe" };
    expect(await getGateway("s1")).toBeNull(); // never route a PhonePe shop's money to the platform account
  });
  it("platform keys are used for refunds only when the shop isn't on razorpay", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "pid");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "psec");
    shopDoc.current = { paymentProvider: "paytm" };
    expect(await getGateway("s1", "razorpay")).toBeNull();
    expect((await getGateway("s1", "razorpay", { forRefund: true }))?.provider).toBe("razorpay");
  });
  it("does not fall back when saved keys can't be decrypted", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "pid");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "psec");
    vi.spyOn(console, "error").mockImplementation(() => {});
    shopDoc.current = { paymentProvider: "razorpay", razorpayKeyId: "k", razorpaySecretEnc: "garbage" };
    expect(await getGateway("s1")).toBeNull();
  });
  it("builds phonepe and paytm gateways, defaulting mode/website", async () => {
    shopDoc.current = { paymentProvider: "phonepe", phonepeClientId: "c", phonepeClientVersion: "1", phonepeSecretEnc: encryptSecret("s") };
    expect(await getGateway("s1")).toEqual({ provider: "phonepe", creds: { clientId: "c", clientVersion: "1", clientSecret: "s", mode: "live" } });
    shopDoc.current = { paymentProvider: "paytm", paytmMid: "M", paytmKeyEnc: encryptSecret("k"), paytmMode: "test" };
    expect(await getGateway("s1")).toEqual({ provider: "paytm", creds: { mid: "M", merchantKey: "k", website: "WEBSTAGING", mode: "test" } });
    shopDoc.current = { paymentProvider: "paytm", paytmMid: "M", paytmKeyEnc: encryptSecret("k") };
    expect(await getGateway("s1")).toMatchObject({ creds: { website: "DEFAULT", mode: "live" } });
  });
  it("`want` overrides the active provider", async () => {
    shopDoc.current = { ...rzpShop(), paymentProvider: "paytm" };
    expect((await getGateway("s1", "razorpay"))?.provider).toBe("razorpay");
  });
});

describe("verifyPayment", () => {
  const rzp: Gateway = { provider: "razorpay", creds: { keyId: "k", keySecret: "s", source: "shop" } };
  const GOOD_ID = "qrp_1700000000000_abcdef0123";

  it("razorpay: rejects missing details and bad signatures before calling out", async () => {
    const f = mockFetch();
    expect(await verifyPayment(rzp, {}, 10)).toMatchObject({ ok: false, status: 400 });
    expect(await verifyPayment(rzp, { razorpayOrderId: "o", razorpayPaymentId: "p", razorpaySignature: "bad" }, 10)).toMatchObject({ ok: false, error: "Payment verification failed" });
    expect(f).not.toHaveBeenCalled();
  });
  it("razorpay: valid signature but wrong amount is refused; correct amount passes", async () => {
    const signature = crypto.createHmac("sha256", "s").update("order_1|pay_1").digest("hex");
    const proof = { razorpayOrderId: "order_1", razorpayPaymentId: "pay_1", razorpaySignature: signature };
    rzpOrder.fn.mockResolvedValueOnce({ amount: 100, currency: "INR" });
    expect(await verifyPayment(rzp, proof, 50)).toMatchObject({ ok: false, error: expect.stringContaining("amount") });
    rzpOrder.fn.mockResolvedValueOnce({ amount: 5000, currency: "USD" });
    expect((await verifyPayment(rzp, proof, 50)).ok).toBe(false);
    rzpOrder.fn.mockResolvedValueOnce({ amount: 5000, currency: "INR" });
    expect(await verifyPayment(rzp, proof, 50)).toEqual({ ok: true, fields: { paymentProvider: "razorpay", razorpayPaymentId: "pay_1" }, unique: { razorpayPaymentId: "pay_1" } });
  });
  it("rejects missing or malformed gateway order ids for phonepe/paytm", async () => {
    const gw: Gateway = { provider: "phonepe", creds: ppe };
    expect(await verifyPayment(gw, {}, 10)).toMatchObject({ ok: false, status: 400 });
    for (const id of ["../etc", "qrp_1_x", "other_1700000000000_abcdef0123"]) expect(await verifyPayment(gw, { gatewayOrderId: id }, 10)).toMatchObject({ ok: false, error: "Payment verification failed" });
  });
  it("phonepe: completed + right amount ok; wrong amount / failed refused", async () => {
    const gw: Gateway = { provider: "phonepe", creds: uniq() };
    mockFetch(tokenOk(), json({ state: "COMPLETED", amount: 1000, paymentDetails: [{ state: "COMPLETED", transactionId: "T" }] }));
    expect(await verifyPayment(gw, { gatewayOrderId: GOOD_ID }, 10)).toEqual({ ok: true, fields: { paymentProvider: "phonepe", gatewayOrderId: GOOD_ID, gatewayTxnId: "T" }, unique: { gatewayOrderId: GOOD_ID } });
    mockFetch(json({ state: "COMPLETED", amount: 100 }));
    expect(await verifyPayment(gw, { gatewayOrderId: GOOD_ID }, 10)).toMatchObject({ ok: false, status: 400 });
    mockFetch(json({ state: "FAILED" }));
    expect(await verifyPayment(gw, { gatewayOrderId: GOOD_ID }, 10)).toMatchObject({ ok: false, status: 402 });
  });
  it("paytm: success/amount/failed", async () => {
    const gw: Gateway = { provider: "paytm", creds: ptm };
    const ok = { body: { resultInfo: { resultStatus: "TXN_SUCCESS" }, txnAmount: "10.00", txnId: "TX" } };
    mockFetch(json(ok));
    expect(await verifyPayment(gw, { gatewayOrderId: GOOD_ID }, 10)).toMatchObject({ ok: true, fields: { paymentProvider: "paytm", gatewayTxnId: "TX" } });
    mockFetch(json({ body: { ...ok.body, txnAmount: "1.00" } }));
    expect(await verifyPayment(gw, { gatewayOrderId: GOOD_ID }, 10)).toMatchObject({ ok: false, status: 400 });
    mockFetch(json({ body: { resultInfo: { resultStatus: "TXN_FAILURE" } } }));
    expect(await verifyPayment(gw, { gatewayOrderId: GOOD_ID }, 10)).toMatchObject({ ok: false, status: 402 });
  });
  it("pending payments are re-checked, then reported as 409", async () => {
    vi.useFakeTimers();
    const gw: Gateway = { provider: "paytm", creds: ptm };
    const pending = () => json({ body: { resultInfo: { resultStatus: "PENDING" } } });
    const f = mockFetch(pending(), pending(), pending(), pending());
    const p = verifyPayment(gw, { gatewayOrderId: GOOD_ID }, 10);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await p).toMatchObject({ ok: false, status: 409 });
    expect(f).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });
  it("a pending payment that settles is accepted", async () => {
    vi.useFakeTimers();
    const gw: Gateway = { provider: "paytm", creds: ptm };
    mockFetch(json({ body: { resultInfo: { resultStatus: "PENDING" } } }), json({ body: { resultInfo: { resultStatus: "TXN_SUCCESS" }, txnAmount: "10.00", txnId: "T" } }));
    const p = verifyPayment(gw, { gatewayOrderId: GOOD_ID }, 10);
    await vi.advanceTimersByTimeAsync(2000);
    expect((await p).ok).toBe(true);
    vi.useRealTimers();
  });
  it("rounds the expected amount to paise safely", async () => {
    const gw: Gateway = { provider: "phonepe", creds: uniq() };
    mockFetch(tokenOk(), json({ state: "COMPLETED", amount: 1999 }));
    expect((await verifyPayment(gw, { gatewayOrderId: GOOD_ID }, 19.99)).ok).toBe(true);
  });
});

describe("refundOnlinePayment", () => {
  const order = { shopId: "s1", totalPrice: 20 };
  it("is unavailable without a payment reference", async () => {
    expect(await refundOnlinePayment({ ...order })).toBe("unavailable");
    expect(await refundOnlinePayment({ ...order, paymentProvider: "phonepe" })).toBe("unavailable");
    expect(await refundOnlinePayment({ ...order, paymentProvider: "paytm", gatewayOrderId: "o" })).toBe("unavailable"); // txn id missing
  });
  it("is unavailable when the gateway keys are no longer saved", async () => {
    expect(await refundOnlinePayment({ ...order, paymentProvider: "phonepe", gatewayOrderId: "o" })).toBe("unavailable");
  });
  it("refunds through the gateway that took the payment, even if the shop switched", async () => {
    shopDoc.current = { paymentProvider: "razorpay", paytmMid: "M", paytmKeyEnc: encryptSecret("0123456789abcdef"), paytmMode: "test" };
    const f = mockFetch(json({ body: { resultInfo: { resultStatus: "PENDING" } } }));
    expect(await refundOnlinePayment({ ...order, paymentProvider: "paytm", gatewayOrderId: "qrp_o", gatewayTxnId: "T" })).toBe("refunded");
    expect(f.mock.calls[0][0]).toContain("/refund/apply");
  });
  it("propagates gateway rejections", async () => {
    shopDoc.current = { paymentProvider: "paytm", paytmMid: "M", paytmKeyEnc: encryptSecret("0123456789abcdef") };
    mockFetch(json({ body: { resultInfo: { resultStatus: "TXN_FAILURE" } } }));
    await expect(refundOnlinePayment({ ...order, paymentProvider: "paytm", gatewayOrderId: "o", gatewayTxnId: "T" })).rejects.toThrow();
  });
});
