import type { PaymentIntent, PaymentProof } from "./types";

/**
 * Customer's browser only: opens the payment window of whichever gateway the shop uses, and resolves with what the
 * server needs to confirm the payment. The server never trusts this - it asks the gateway itself (see verifyPayment).
 */
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
    PhonePeCheckout?: {
      transact: (o: { tokenUrl: string; type: "IFRAME" | "REDIRECT"; callback?: (response: string) => void }) => void;
      closePage?: () => void;
    };
    Paytm?: {
      CheckoutJS: {
        onLoad: (fn: () => void) => void;
        init: (config: Record<string, unknown>) => Promise<unknown>;
        invoke: () => void;
        close: () => void;
      };
    };
  }
}

const PAYMENT_CANCELLED = "Payment cancelled";
const scripts = new Map<string, Promise<void>>();

function loadScript(src: string, crossOrigin = false): Promise<void> {
  let p = scripts.get(src);
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src;
      el.async = true;
      if (crossOrigin) el.crossOrigin = "anonymous";
      el.onload = () => resolve();
      el.onerror = () => {
        scripts.delete(src); // let the next attempt try again
        reject(new Error("Could not load the payment window. Check your internet and try again."));
      };
      document.head.appendChild(el);
    });
    scripts.set(src, p);
  }
  return p;
}

export type PayContext = { shopName: string; description: string; name: string; phone?: string };

async function payWithRazorpay(i: Extract<PaymentIntent, { provider: "razorpay" }>, ctx: PayContext): Promise<PaymentProof> {
  if (!window.Razorpay) await loadScript("https://checkout.razorpay.com/v1/checkout.js");
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("Could not load the payment window. Check your internet and try again.");
  return new Promise<PaymentProof>((resolve, reject) => {
    const rzp = new Razorpay({
      key: i.keyId,
      amount: i.amount,
      currency: i.currency,
      order_id: i.razorpayOrderId,
      name: ctx.shopName,
      description: ctx.description,
      prefill: { name: ctx.name, contact: ctx.phone || undefined },
      theme: { color: "#2563eb" },
      handler: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
        resolve({
          paymentProvider: "razorpay",
          razorpayOrderId: r.razorpay_order_id,
          razorpayPaymentId: r.razorpay_payment_id,
          razorpaySignature: r.razorpay_signature,
        }),
      modal: { ondismiss: () => reject(new Error(PAYMENT_CANCELLED)) },
    });
    rzp.open();
  });
}

async function payWithPhonePe(i: Extract<PaymentIntent, { provider: "phonepe" }>): Promise<PaymentProof> {
  await loadScript("https://mercury.phonepe.com/web/bundle/checkout.js");
  const checkout = window.PhonePeCheckout;
  if (!checkout) throw new Error("Could not load the payment window. Check your internet and try again.");
  return new Promise<PaymentProof>((resolve, reject) => {
    checkout.transact({
      tokenUrl: i.tokenUrl,
      type: "IFRAME",
      callback: (response: string) => {
        if (response === "USER_CANCEL") return reject(new Error(PAYMENT_CANCELLED));
        // "CONCLUDED" only means the window finished - it can be a success OR a failure. The server asks PhonePe which one.
        try {
          checkout.closePage?.();
        } catch {
          /* already closed */
        }
        resolve({ paymentProvider: "phonepe", gatewayOrderId: i.gatewayOrderId });
      },
    });
  });
}

async function payWithPaytm(i: Extract<PaymentIntent, { provider: "paytm" }>): Promise<PaymentProof> {
  await loadScript(i.scriptUrl, true);
  const checkout = window.Paytm?.CheckoutJS;
  if (!checkout) throw new Error("Could not load the payment window. Check your internet and try again.");
  return new Promise<PaymentProof>((resolve, reject) => {
    checkout.onLoad(() => {
      checkout
        .init({
          root: "",
          flow: "DEFAULT",
          data: { orderId: i.gatewayOrderId, token: i.txnToken, tokenType: "TXN_TOKEN", amount: i.amount },
          merchant: { redirect: false }, // keep the customer on this page: the result arrives in transactionStatus below
          handler: {
            notifyMerchant: (eventName: string) => {
              if (eventName === "APP_CLOSED") reject(new Error(PAYMENT_CANCELLED));
            },
            transactionStatus: (data: { STATUS?: string; RESPMSG?: string }) => {
              try {
                checkout.close();
              } catch {
                /* already closed */
              }
              // Only a hint for the screen. The server asks Paytm itself before the order is accepted.
              if (data?.STATUS === "TXN_SUCCESS") resolve({ paymentProvider: "paytm", gatewayOrderId: i.gatewayOrderId });
              else reject(new Error(data?.RESPMSG || "The payment was not completed."));
            },
          },
        })
        .then(() => checkout.invoke())
        .catch((e: unknown) => reject(e instanceof Error ? e : new Error("Could not open the Paytm payment window.")));
    });
  });
}

/** Opens the payment window for the gateway the server chose and resolves once the customer has paid (rejects if they cancel or it fails). */
export function runOnlinePayment(intent: PaymentIntent, ctx: PayContext): Promise<PaymentProof> {
  if (intent.provider === "razorpay") return payWithRazorpay(intent, ctx);
  if (intent.provider === "phonepe") return payWithPhonePe(intent);
  return payWithPaytm(intent);
}
