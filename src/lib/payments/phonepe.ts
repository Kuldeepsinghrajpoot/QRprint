import crypto from "crypto";
import type { GatewayMode } from "./types";

/**
 * PhonePe Payment Gateway - Standard Checkout API (V2), plain fetch, no SDK.
 * Flow: OAuth token -> POST /checkout/v2/pay (gives a checkout URL the browser opens in an iframe) ->
 * customer pays -> server asks PhonePe for the order status (GET /checkout/v2/order/{id}/status) -> refund via /payments/v2/refund.
 * The credentials are the V2 ones from the PhonePe dashboard (Developer Settings): Client ID, Client Secret, Client Version.
 */
export type PhonePeCreds = { clientId: string; clientVersion: string; clientSecret: string; mode: GatewayMode };

const URLS: Record<GatewayMode, { token: string; api: string }> = {
  test: {
    token: "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token",
    api: "https://api-preprod.phonepe.com/apis/pg-sandbox",
  },
  live: {
    token: "https://api.phonepe.com/apis/identity-manager/v1/oauth/token",
    api: "https://api.phonepe.com/apis/pg",
  },
};

export class PhonePeError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "PhonePeError";
    this.status = status;
    this.code = code;
  }
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
};

async function send(url: string, init: RequestInit): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
  } catch {
    /* PhonePe answered with something that is not JSON - treated as an error by the callers via the status code */
  }
  return { status: res.status, data };
}

// The access token lasts a while; keep it in memory so we do not ask for a new one on every payment.
const tokens = new Map<string, { value: string; expiresAt: number }>();
const tokenKey = (c: PhonePeCreds) =>
  [c.mode, c.clientId, c.clientVersion, crypto.createHash("sha256").update(c.clientSecret).digest("hex").slice(0, 16)].join("|");

async function accessToken(c: PhonePeCreds, fresh = false): Promise<string> {
  const key = tokenKey(c);
  const hit = tokens.get(key);
  if (!fresh && hit && hit.expiresAt - 60_000 > Date.now()) return hit.value;

  const { status, data } = await send(URLS[c.mode].token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_version: c.clientVersion,
      client_secret: c.clientSecret,
      grant_type: "client_credentials",
    }).toString(),
  });
  const token = str(data.access_token);
  if (status !== 200 || !token) throw new PhonePeError(`PhonePe token request failed (HTTP ${status})`, status, str(data.code) || str(data.error));
  const expiresAtSec = num(data.expires_at); // epoch seconds
  tokens.set(key, { value: token, expiresAt: expiresAtSec ? expiresAtSec * 1000 : Date.now() + 5 * 60_000 });
  return token;
}

/** Calls a PhonePe API with the OAuth token; one automatic retry with a fresh token if PhonePe says the token is no longer valid. */
async function authed(c: PhonePeCreds, path: string, init: RequestInit) {
  const run = async (fresh: boolean) =>
    send(URLS[c.mode].api + path, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `O-Bearer ${await accessToken(c, fresh)}` },
    });
  let res = await run(false);
  if (res.status === 401) res = await run(true);
  return res;
}

const detail = (data: Record<string, unknown>) => str(data.message) || str(data.code) || "no detail";

/** Creates the PhonePe order. `tokenUrl` is what the browser's PhonePe checkout window opens. */
export async function createPhonePeOrder(
  c: PhonePeCreds,
  p: { merchantOrderId: string; amountRupees: number; redirectUrl: string }
): Promise<{ tokenUrl: string; amountPaise: number }> {
  const amountPaise = Math.round(p.amountRupees * 100);
  const { status, data } = await authed(c, "/checkout/v2/pay", {
    method: "POST",
    body: JSON.stringify({
      merchantOrderId: p.merchantOrderId,
      amount: amountPaise,
      expireAfter: 1200, // the checkout page stays valid for 20 minutes
      paymentFlow: { type: "PG_CHECKOUT", merchantUrls: { redirectUrl: p.redirectUrl } },
    }),
  });
  const tokenUrl = str(data.redirectUrl);
  if (status !== 200 || !tokenUrl) throw new PhonePeError(`PhonePe create payment failed (HTTP ${status}): ${detail(data)}`, status, str(data.code));
  return { tokenUrl, amountPaise };
}

export type PhonePeStatus = { state: "COMPLETED" | "FAILED" | "PENDING" | "UNKNOWN"; amountPaise?: number; transactionId?: string };

/** The only trustworthy answer to "was this paid?" - asked server-to-server, never taken from the browser. */
export async function fetchPhonePeStatus(c: PhonePeCreds, merchantOrderId: string): Promise<PhonePeStatus> {
  const { status, data } = await authed(c, `/checkout/v2/order/${encodeURIComponent(merchantOrderId)}/status`, { method: "GET" });
  if (status >= 500) throw new PhonePeError(`PhonePe status check failed (HTTP ${status}): ${detail(data)}`, status, str(data.code));
  if (status !== 200) return { state: "UNKNOWN" }; // e.g. no such order
  const s = str(data.state);
  const attempts = Array.isArray(data.paymentDetails) ? (data.paymentDetails as Record<string, unknown>[]) : [];
  const paidAttempt = attempts.find((a) => a?.state === "COMPLETED");
  return {
    state: s === "COMPLETED" || s === "FAILED" || s === "PENDING" ? s : "UNKNOWN",
    amountPaise: num(data.amount),
    transactionId: str(paidAttempt?.transactionId),
  };
}

/**
 * Full refund of a paid order. The refund id is derived from the order id, so asking twice can never refund twice
 * (PhonePe rejects a repeated refund id).
 */
export async function refundPhonePe(c: PhonePeCreds, p: { merchantOrderId: string; amountRupees: number }): Promise<void> {
  const { status, data } = await authed(c, "/payments/v2/refund", {
    method: "POST",
    body: JSON.stringify({
      merchantRefundId: `rfd_${p.merchantOrderId}`,
      originalMerchantOrderId: p.merchantOrderId,
      amount: Math.round(p.amountRupees * 100),
    }),
  });
  const state = str(data.state); // PENDING / CONFIRMED / COMPLETED are all fine: PhonePe accepted the refund
  if (status !== 200 || state === "FAILED") throw new PhonePeError(`PhonePe refund failed (HTTP ${status}): ${detail(data)}`, status, str(data.code));
}

/** Used when a shop saves its credentials: PhonePe only hands out a token if Client ID + Secret + Version are right. */
export async function checkPhonePeKeys(c: PhonePeCreds): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await accessToken(c, true);
    return { ok: true };
  } catch (err) {
    if (err instanceof PhonePeError && (err.status === 400 || err.status === 401 || err.status === 403)) {
      return {
        ok: false,
        reason: "PhonePe did not accept these credentials. Check the Client ID, Client Secret and Client Version, and that Test / Live matches the credentials you copied.",
      };
    }
    return { ok: false, reason: "Could not reach PhonePe to check the credentials. Try again in a moment." };
  }
}
