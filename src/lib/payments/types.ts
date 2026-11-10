/**
 * Shared by the server AND the customer's browser, so this file must stay free of server-only imports.
 * A shop uses exactly ONE of these gateways at a time (Settings -> Online payments).
 */
export type Provider = "razorpay" | "phonepe" | "paytm";
export type GatewayMode = "test" | "live";

export const PROVIDERS: readonly Provider[] = ["razorpay", "phonepe", "paytm"];

export const PROVIDER_LABEL: Record<Provider, string> = {
  razorpay: "Razorpay",
  phonepe: "PhonePe",
  paytm: "Paytm",
};

export const isProvider = (v: unknown): v is Provider => typeof v === "string" && (PROVIDERS as readonly string[]).includes(v);

/** What /api/payments/create hands the customer's browser so it can open the right payment window. */
export type PaymentIntent =
  | { provider: "razorpay"; keyId: string; razorpayOrderId: string; amount: number; currency: string }
  | { provider: "phonepe"; gatewayOrderId: string; tokenUrl: string; amount: number; currency: string }
  | { provider: "paytm"; gatewayOrderId: string; txnToken: string; mid: string; scriptUrl: string; amount: string; currency: string };

/** What the browser sends back to /api/orders after paying. The server re-checks every one of these with the gateway. */
export type PaymentProof = {
  paymentProvider?: Provider;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  gatewayOrderId?: string; // PhonePe / Paytm
};
