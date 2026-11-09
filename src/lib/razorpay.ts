import Razorpay from "razorpay";
import crypto from "crypto";
import { connectDB } from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { decryptSecret } from "@/lib/secretBox";

/** The Razorpay account used for one payment: the shop's own keys, or (if it has none) the platform keys from env. */
export type RzpCreds = { keyId: string; keySecret: string; source: "shop" | "platform" };

const platformCreds = (): RzpCreds | null =>
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? { keyId: process.env.RAZORPAY_KEY_ID, keySecret: process.env.RAZORPAY_KEY_SECRET, source: "platform" }
    : null;

/** Looks up which Razorpay keys to use for a shop. null = online payments are not set up. */
export async function getRazorpayCreds(shopId: string | null | undefined): Promise<RzpCreds | null> {
  if (shopId) {
    await connectDB();
    const shop = await Shop.findOne({ shopId }).select("razorpayKeyId razorpaySecretEnc").lean();
    if (shop?.razorpayKeyId && shop?.razorpaySecretEnc) {
      const secret = decryptSecret(shop.razorpaySecretEnc);
      if (secret) return { keyId: shop.razorpayKeyId, keySecret: secret, source: "shop" };
      // The shop set up its own keys but they cannot be read (encryption key changed / missing). Do NOT quietly
      // switch to the platform account: that would send this shop's customers' money to the wrong place.
      console.error(`[razorpay] shop ${shopId}: saved keys cannot be decrypted - online payment disabled for this shop`);
      return null;
    }
  }
  return platformCreds();
}

export const clientFor = (c: RzpCreds) => new Razorpay({ key_id: c.keyId, key_secret: c.keySecret });

/** Creates a Razorpay order for the given rupee amount (converted to paise). */
export async function createRazorpayOrder(creds: RzpCreds, amountInRupees: number, receipt: string) {
  return clientFor(creds).orders.create({
    amount: Math.round(amountInRupees * 100),
    currency: "INR",
    receipt,
  });
}

/** Verifies the checkout signature returned by Razorpay after a successful payment. */
export function verifyRazorpaySignature(
  creds: RzpCreds,
  params: { orderId: string; paymentId: string; signature: string }
): boolean {
  const expected = crypto.createHmac("sha256", creds.keySecret).update(`${params.orderId}|${params.paymentId}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(params.signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Issues a full refund for a captured payment — used by the order-cancellation window. */
export async function refundRazorpayPayment(creds: RzpCreds, paymentId: string): Promise<void> {
  await clientFor(creds).payments.refund(paymentId, {});
}

/**
 * Fetches a Razorpay order so the server can check the amount the customer
 * actually paid against the price IT calculated (never trust the client's amount).
 */
export async function fetchRazorpayOrder(creds: RzpCreds, orderId: string) {
  return clientFor(creds).orders.fetch(orderId);
}

/** Cheap call used when a shop saves its keys: Razorpay answers 401 if the Key ID / Secret pair is wrong. */
export async function checkRazorpayKeys(keyId: string, keySecret: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await new Razorpay({ key_id: keyId, key_secret: keySecret }).orders.all({ count: 1 });
    return { ok: true };
  } catch (err) {
    const e = err as { statusCode?: number; error?: { description?: string } };
    if (e?.statusCode === 401) return { ok: false, reason: "Razorpay did not accept these keys. Check the Key ID and Key Secret (copy both from the same mode: Test or Live)." };
    return { ok: false, reason: e?.error?.description || "Could not reach Razorpay to check the keys. Try again in a moment." };
  }
}
