import crypto from "crypto";
import { connectDB } from "@/lib/mongodb";
import { Shop, PAYMENT_FIELDS, type IShop } from "@/models/Shop";
import { decryptSecret } from "@/lib/secretBox";
import {
  type RzpCreds,
  platformRazorpayCreds,
  createRazorpayOrder,
  verifyRazorpaySignature,
  fetchRazorpayOrder,
  refundRazorpayPayment,
} from "@/lib/razorpay";
import { type PhonePeCreds, createPhonePeOrder, fetchPhonePeStatus, refundPhonePe } from "./phonepe";
import { type PaytmCreds, createPaytmTxn, fetchPaytmStatus, refundPaytm } from "./paytm";
import type { PaymentIntent, PaymentProof, Provider } from "./types";

/**
 * Online payments for a shop. A shop can keep keys for several gateways saved, but customers pay through exactly ONE:
 * the shop's `paymentProvider` (Settings -> Online payments). Everything that takes, checks or refunds money goes through here,
 * so the rest of the app does not care which gateway is active.
 */
export type Gateway =
  | { provider: "razorpay"; creds: RzpCreds }
  | { provider: "phonepe"; creds: PhonePeCreds }
  | { provider: "paytm"; creds: PaytmCreds };

type ShopPay = Pick<
  IShop,
  | "paymentProvider"
  | "razorpayKeyId"
  | "razorpaySecretEnc"
  | "phonepeClientId"
  | "phonepeClientVersion"
  | "phonepeSecretEnc"
  | "phonepeMode"
  | "paytmMid"
  | "paytmKeyEnc"
  | "paytmWebsite"
  | "paytmMode"
>;

/** The gateway a shop's customers pay through right now. Shops that never chose one keep the original behaviour: Razorpay. */
export const activeProviderOf = (shop: Pick<IShop, "paymentProvider"> | null | undefined): Provider => shop?.paymentProvider || "razorpay";

type Own = { state: "none" } | { state: "broken" } | { state: "ok"; gateway: Gateway };
const NONE: Own = { state: "none" };
const BROKEN: Own = { state: "broken" };

/** The keys the shop saved for one gateway. "broken" = saved, but cannot be decrypted (encryption key changed / missing). */
function ownGateway(shop: ShopPay | null, provider: Provider): Own {
  if (!shop) return NONE;
  if (provider === "razorpay") {
    if (!shop.razorpayKeyId || !shop.razorpaySecretEnc) return NONE;
    const secret = decryptSecret(shop.razorpaySecretEnc);
    return secret ? { state: "ok", gateway: { provider, creds: { keyId: shop.razorpayKeyId, keySecret: secret, source: "shop" } } } : BROKEN;
  }
  if (provider === "phonepe") {
    if (!shop.phonepeClientId || !shop.phonepeClientVersion || !shop.phonepeSecretEnc) return NONE;
    const secret = decryptSecret(shop.phonepeSecretEnc);
    return secret
      ? {
          state: "ok",
          gateway: { provider, creds: { clientId: shop.phonepeClientId, clientVersion: shop.phonepeClientVersion, clientSecret: secret, mode: shop.phonepeMode || "live" } },
        }
      : BROKEN;
  }
  if (!shop.paytmMid || !shop.paytmKeyEnc) return NONE;
  const key = decryptSecret(shop.paytmKeyEnc);
  const mode = shop.paytmMode || "live";
  return key
    ? { state: "ok", gateway: { provider: "paytm", creds: { mid: shop.paytmMid, merchantKey: key, website: shop.paytmWebsite || (mode === "live" ? "DEFAULT" : "WEBSTAGING"), mode } } }
    : BROKEN;
}

/**
 * Which keys to use. null = online payments are not set up (or cannot be used safely).
 *  - No `want`: the shop's active gateway.
 *  - `want`: a specific gateway - used to refund through the gateway that took the payment, or to confirm a payment that was
 *    started just before the shop switched gateways.
 * The platform Razorpay account (env) is only a fallback for a shop that uses Razorpay and has no keys of its own.
 * It is never used for a shop that picked another gateway - that would send its customers' money to the wrong account.
 */
export async function getGateway(
  shopId: string | null | undefined,
  want?: Provider,
  opts: { forRefund?: boolean } = {}
): Promise<Gateway | null> {
  let shop: ShopPay | null = null;
  if (shopId) {
    await connectDB();
    shop = (await Shop.findOne({ shopId }).select(PAYMENT_FIELDS).lean()) as ShopPay | null;
  }
  const active = activeProviderOf(shop);
  const provider = want ?? active;

  const own = ownGateway(shop, provider);
  if (own.state === "ok") return own.gateway;
  if (own.state === "broken") {
    // Do NOT quietly switch to another account: that would send this shop's customers' money to the wrong place.
    console.error(`[payments] shop ${shopId}: saved ${provider} keys cannot be decrypted - online payment disabled for this shop`);
    return null;
  }

  if (provider === "razorpay" && (provider === active || opts.forRefund)) {
    const platform = platformRazorpayCreds();
    if (platform) return { provider: "razorpay", creds: platform };
  }
  return null;
}

/** Our own id for one PhonePe / Paytm payment. The prefix + random part make it impossible to guess or to confuse with the shop's other orders. */
const newGatewayOrderId = () => `qrp_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`;
const GATEWAY_ORDER_ID = /^qrp_[0-9]{10,16}_[a-f0-9]{10}$/;

/** Starts a payment with the shop's active gateway. */
export async function createPayment(gw: Gateway, amountRupees: number, o: { receipt: string; origin: string }): Promise<PaymentIntent> {
  if (gw.provider === "razorpay") {
    const order = await createRazorpayOrder(gw.creds, amountRupees, o.receipt);
    return { provider: "razorpay", keyId: gw.creds.keyId, razorpayOrderId: order.id, amount: Number(order.amount), currency: String(order.currency) };
  }
  if (gw.provider === "phonepe") {
    const gatewayOrderId = newGatewayOrderId();
    const r = await createPhonePeOrder(gw.creds, { merchantOrderId: gatewayOrderId, amountRupees, redirectUrl: `${o.origin}/` });
    return { provider: "phonepe", gatewayOrderId, tokenUrl: r.tokenUrl, amount: r.amountPaise, currency: "INR" };
  }
  const gatewayOrderId = newGatewayOrderId();
  const r = await createPaytmTxn(gw.creds, { orderId: gatewayOrderId, amountRupees, custId: `cust_${crypto.randomBytes(6).toString("hex")}` });
  return { provider: "paytm", gatewayOrderId, txnToken: r.txnToken, mid: gw.creds.mid, scriptUrl: r.scriptUrl, amount: r.amount, currency: "INR" };
}

/** Payment details stored on the order. */
export type PaidFields = { paymentProvider: Provider; razorpayPaymentId?: string; gatewayOrderId?: string; gatewayTxnId?: string };

export type VerifyResult =
  | { ok: true; fields: PaidFields; unique: Record<string, string> } // `unique`: an Order with this value means the payment was already used
  | { ok: false; status: number; error: string };

const fail = (status: number, error: string): VerifyResult => ({ ok: false, status, error });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** UPI can take a few seconds to settle after the checkout window closes: look again a few times before giving up. */
async function settled<T extends { state: string }>(read: () => Promise<T>): Promise<T> {
  let s = await read();
  for (let i = 0; i < 3 && s.state === "PENDING"; i++) {
    await sleep(1500);
    s = await read();
  }
  return s;
}

/**
 * Confirms with the gateway itself that the customer really paid the right amount. Nothing the browser says is trusted:
 * the amount is compared with the price the SERVER calculated, so a Rs 1 payment can never buy a bigger order.
 */
export async function verifyPayment(gw: Gateway, proof: PaymentProof, expectedTotalRupees: number): Promise<VerifyResult> {
  const expectedPaise = Math.round(expectedTotalRupees * 100);

  if (gw.provider === "razorpay") {
    if (!proof.razorpayOrderId || !proof.razorpayPaymentId || !proof.razorpaySignature) return fail(400, "Missing payment verification details");
    const valid = verifyRazorpaySignature(gw.creds, { orderId: proof.razorpayOrderId, paymentId: proof.razorpayPaymentId, signature: proof.razorpaySignature });
    if (!valid) return fail(400, "Payment verification failed");
    // The signature only proves "this payment belongs to this Razorpay order", not that the amount was right.
    const rzpOrder = await fetchRazorpayOrder(gw.creds, proof.razorpayOrderId);
    if (Number(rzpOrder.amount) !== expectedPaise || rzpOrder.currency !== "INR") return fail(400, "Payment amount does not match the order total");
    return {
      ok: true,
      fields: { paymentProvider: "razorpay", razorpayPaymentId: proof.razorpayPaymentId },
      unique: { razorpayPaymentId: proof.razorpayPaymentId },
    };
  }

  const id = proof.gatewayOrderId;
  if (!id) return fail(400, "Missing payment verification details");
  if (!GATEWAY_ORDER_ID.test(id)) return fail(400, "Payment verification failed");

  if (gw.provider === "phonepe") {
    const st = await settled(() => fetchPhonePeStatus(gw.creds, id));
    if (st.state === "PENDING") return fail(409, "Your payment is still being confirmed by PhonePe. Please wait a minute and ask the shop to check before paying again.");
    if (st.state !== "COMPLETED") return fail(402, "The PhonePe payment was not completed. You have not been charged for this order.");
    if (st.amountPaise !== expectedPaise) return fail(400, "Payment amount does not match the order total");
    return { ok: true, fields: { paymentProvider: "phonepe", gatewayOrderId: id, gatewayTxnId: st.transactionId }, unique: { gatewayOrderId: id } };
  }

  const st = await settled(() => fetchPaytmStatus(gw.creds, id));
  if (st.state === "PENDING") return fail(409, "Your payment is still being confirmed by Paytm. Please wait a minute and ask the shop to check before paying again.");
  if (st.state !== "SUCCESS") return fail(402, "The Paytm payment was not completed. You have not been charged for this order.");
  if (st.amountPaise !== expectedPaise) return fail(400, "Payment amount does not match the order total");
  return { ok: true, fields: { paymentProvider: "paytm", gatewayOrderId: id, gatewayTxnId: st.txnId }, unique: { gatewayOrderId: id } };
}

export type RefundableOrder = {
  shopId: string;
  totalPrice: number;
  paymentProvider?: Provider;
  razorpayPaymentId?: string;
  gatewayOrderId?: string;
  gatewayTxnId?: string;
};

/**
 * Refunds an online payment in full, through the gateway that TOOK it (even if the shop has switched gateways since).
 *  - "refunded": the gateway accepted the refund.
 *  - "unavailable": nothing to refund through (no payment reference, or the keys for that gateway are no longer saved).
 * Throws if the gateway itself rejects the refund - the callers keep the cancellation and tell the shop to refund by hand.
 */
export async function refundOnlinePayment(order: RefundableOrder): Promise<"refunded" | "unavailable"> {
  const provider: Provider = order.paymentProvider ?? "razorpay"; // orders from before PhonePe/Paytm existed were all Razorpay
  const hasRef = provider === "razorpay" ? !!order.razorpayPaymentId : provider === "phonepe" ? !!order.gatewayOrderId : !!(order.gatewayOrderId && order.gatewayTxnId);
  if (!hasRef) return "unavailable";
  const gw = await getGateway(order.shopId, provider, { forRefund: true });
  if (!gw) return "unavailable";

  if (gw.provider === "razorpay") await refundRazorpayPayment(gw.creds, order.razorpayPaymentId!);
  else if (gw.provider === "phonepe") await refundPhonePe(gw.creds, { merchantOrderId: order.gatewayOrderId!, amountRupees: order.totalPrice });
  else await refundPaytm(gw.creds, { orderId: order.gatewayOrderId!, txnId: order.gatewayTxnId!, amountRupees: order.totalPrice });
  return "refunded";
}
