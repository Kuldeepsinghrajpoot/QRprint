import crypto from "crypto";
import type { GatewayMode } from "./types";

/**
 * Paytm Payment Gateway - JS Checkout, plain fetch + Node crypto, no SDK.
 * Flow: POST /theia/api/v1/initiateTransaction (gives a txnToken) -> browser opens Paytm's JS Checkout with that token ->
 * customer pays -> server asks Paytm for the transaction status (POST /v3/order/status) -> refund via /refund/apply.
 * Credentials (Paytm dashboard -> API Keys): Merchant ID (MID) + Merchant Key (16 characters) + Website name.
 */
export type PaytmCreds = { mid: string; merchantKey: string; website: string; mode: GatewayMode };

/** Paytm's own default "Website name" for each environment. */
export const defaultPaytmWebsite = (mode: GatewayMode) => (mode === "live" ? "DEFAULT" : "WEBSTAGING");

/**
 * New Paytm accounts use paytmpayments.com. Some older MIDs only work on the old paytm.in hosts, so the host can be
 * overridden with PAYTM_LIVE_HOST / PAYTM_TEST_HOST (for example https://securegw.paytm.in).
 */
export const paytmHost = (mode: GatewayMode): string =>
  (mode === "live" ? process.env.PAYTM_LIVE_HOST : process.env.PAYTM_TEST_HOST)?.trim().replace(/\/+$/, "") ||
  (mode === "live" ? "https://secure.paytmpayments.com" : "https://securestage.paytmpayments.com");

export class PaytmError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "PaytmError";
    this.code = code;
  }
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
};

/** Paytm wants rupee amounts as a string with two decimals, e.g. "12.50". */
const rupees = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

/**
 * Paytm's request signature ("checksum"), the same algorithm as their official `paytmchecksum` library:
 * AES-128-CBC encryption (key = the 16-character Merchant Key, fixed IV) of  sha256(body|salt) + salt,  with a random 4-character salt.
 * `body` is the exact JSON text that is sent as the request "body".
 */
const IV = "@@@@&&&&####$$$$";
export function paytmSignature(body: string, merchantKey: string): string {
  const salt = crypto.randomBytes(3).toString("base64"); // 3 bytes = exactly 4 base64 characters
  const hashed = crypto.createHash("sha256").update(`${body}|${salt}`).digest("hex") + salt;
  const cipher = crypto.createCipheriv("aes-128-cbc", merchantKey, IV);
  return cipher.update(hashed, "binary", "base64") + cipher.final("base64");
}

async function postSigned(c: PaytmCreds, path: string, body: Record<string, unknown>) {
  const bodyText = JSON.stringify(body);
  const signature = paytmSignature(bodyText, c.merchantKey);
  const res = await fetch(paytmHost(c.mode) + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // The signature is made over exactly this body text, so it is placed into the request as-is.
    body: `{"body":${bodyText},"head":{"signature":${JSON.stringify(signature)}}}`,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let reply: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object") reply = parsed as Record<string, unknown>;
  } catch {
    /* not JSON: callers see an empty body and treat it as a failure */
  }
  const replyBody = reply.body && typeof reply.body === "object" ? (reply.body as Record<string, unknown>) : {};
  return { httpStatus: res.status, body: replyBody };
}

const resultOf = (body: Record<string, unknown>) => {
  const r = body.resultInfo && typeof body.resultInfo === "object" ? (body.resultInfo as Record<string, unknown>) : {};
  return { status: str(r.resultStatus), code: str(r.resultCode), msg: str(r.resultMsg) };
};

/** Creates the Paytm transaction. The browser needs `txnToken` + the checkout script of this merchant. */
export async function createPaytmTxn(
  c: PaytmCreds,
  p: { orderId: string; amountRupees: number; custId: string }
): Promise<{ txnToken: string; amount: string; scriptUrl: string }> {
  const host = paytmHost(c.mode);
  const amount = rupees(p.amountRupees);
  const { httpStatus, body } = await postSigned(
    c,
    `/theia/api/v1/initiateTransaction?mid=${encodeURIComponent(c.mid)}&orderId=${encodeURIComponent(p.orderId)}`,
    {
      requestType: "Payment",
      mid: c.mid,
      websiteName: c.website,
      orderId: p.orderId,
      // Paytm requires one. The checkout runs with redirect turned off, so the customer is never sent here.
      callbackUrl: `${host}/theia/paytmCallback?ORDER_ID=${p.orderId}`,
      txnAmount: { value: amount, currency: "INR" },
      userInfo: { custId: p.custId },
    }
  );
  const txnToken = str(body.txnToken);
  const r = resultOf(body);
  if (r.status !== "S" || !txnToken) throw new PaytmError(`Paytm initiate transaction failed (HTTP ${httpStatus}): ${r.code || "?"} ${r.msg || ""}`.trim(), r.code);
  return { txnToken, amount, scriptUrl: `${host}/merchantpgpui/checkoutjs/merchants/${encodeURIComponent(c.mid)}.js` };
}

export type PaytmStatus = { state: "SUCCESS" | "FAILED" | "PENDING" | "UNKNOWN"; amountPaise?: number; txnId?: string; message?: string };

/**
 * The only trustworthy answer to "was this paid?" - asked server-to-server over HTTPS with our signed request.
 * (Paytm's reply is not taken from the browser, so there is nothing a customer could forge.)
 */
export async function fetchPaytmStatus(c: PaytmCreds, orderId: string): Promise<PaytmStatus> {
  const { httpStatus, body } = await postSigned(c, "/v3/order/status", { mid: c.mid, orderId });
  if (httpStatus >= 500) throw new PaytmError(`Paytm status check failed (HTTP ${httpStatus})`);
  const r = resultOf(body);
  const amount = num(body.txnAmount);
  return {
    state: r.status === "TXN_SUCCESS" ? "SUCCESS" : r.status === "TXN_FAILURE" ? "FAILED" : r.status === "PENDING" ? "PENDING" : "UNKNOWN",
    amountPaise: amount === undefined ? undefined : Math.round(amount * 100),
    txnId: str(body.txnId),
    message: r.msg,
  };
}

/** Full refund of a paid transaction. The refund id comes from the order id, so a repeated request is rejected by Paytm instead of refunding twice. */
export async function refundPaytm(c: PaytmCreds, p: { orderId: string; txnId: string; amountRupees: number }): Promise<void> {
  const { httpStatus, body } = await postSigned(c, "/refund/apply", {
    mid: c.mid,
    txnType: "REFUND",
    orderId: p.orderId,
    txnId: p.txnId,
    refId: `rfd_${p.orderId}`,
    refundAmount: rupees(p.amountRupees),
  });
  const r = resultOf(body);
  // Paytm answers PENDING when it has accepted the refund and is sending it to the bank.
  if (httpStatus >= 500 || (r.status !== "PENDING" && r.status !== "TXN_SUCCESS")) {
    throw new PaytmError(`Paytm refund failed (HTTP ${httpStatus}): ${r.status || "?"} ${r.code || ""} ${r.msg || ""}`.trim(), r.code);
  }
}

/**
 * Used when a shop saves its credentials. Paytm has no "test my keys" call, so a status lookup for an order that does not
 * exist is sent: Paytm answers "checksum mismatch" / "invalid MID" when MID or Merchant Key is wrong, and "no such order" when both are right.
 */
export async function checkPaytmKeys(c: PaytmCreds): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const { body } = await postSigned(c, "/v3/order/status", { mid: c.mid, orderId: `qrp_keycheck_${Date.now()}` });
    const code = resultOf(body).code;
    if (code === "330" || code === "335" || code === "305") {
      return {
        ok: false,
        reason: "Paytm did not accept this Merchant ID / Merchant Key pair. Copy both from the same mode (Test or Live) in your Paytm dashboard -> API Keys.",
      };
    }
    if (!code && !resultOf(body).status) return { ok: false, reason: "Could not reach Paytm to check the keys. Try again in a moment." };
    return { ok: true };
  } catch {
    return { ok: false, reason: "Could not reach Paytm to check the keys. Try again in a moment." };
  }
}
