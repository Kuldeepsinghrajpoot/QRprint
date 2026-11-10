import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * One print shop = one account. Everything (printers, orders, computers, pricing, customers) is stored with
 * the shop's `shopId`, so shops never see each other's data.
 */
export interface IShop extends Document {
  shopId: string; // random public id used in the customer QR link (?shop=...)
  name: string;
  slug?: string; // the shop's sub-address: <slug>.qr.lexicalsoftware.in
  oldSlugs?: string[]; // earlier names — they keep opening this shop, so printed QR codes never break
  agentKeyHash?: string; // sha256 of the Print Agent key — the key itself is shown once and never stored
  agentKeyHint: string; // last 4 characters, so the owner can tell which key is active
  razorpayKeyId?: string; // this shop's own Razorpay Key ID (public, like rzp_live_xxx)
  razorpaySecretEnc?: string; // the Key Secret, encrypted (AES-256-GCM) - never returned to the browser
  razorpaySecretHint?: string; // last 4 characters of the secret, so the owner can recognise it
  // The ONE gateway customers pay through. Keys for the other gateways can stay saved, but only this one is used for
  // new payments. Empty = the original behaviour (Razorpay: the shop's own keys, or the platform keys).
  paymentProvider?: "razorpay" | "phonepe" | "paytm";
  phonepeClientId?: string; // PhonePe PG (V2) credentials: Client ID + Client Version are not secret, the Client Secret is
  phonepeClientVersion?: string;
  phonepeSecretEnc?: string; // Client Secret, encrypted (AES-256-GCM) - never returned to the browser
  phonepeSecretHint?: string;
  phonepeMode?: "test" | "live";
  paytmMid?: string; // Paytm Merchant ID (not secret)
  paytmKeyEnc?: string; // Paytm Merchant Key, encrypted (AES-256-GCM) - never returned to the browser
  paytmKeyHint?: string;
  paytmWebsite?: string; // "Website name" from the Paytm dashboard (WEBSTAGING for test, DEFAULT for live)
  paytmMode?: "test" | "live";
  // Business details the owner fills in under Settings. Shown on the shop's Terms, Privacy, Refund and Pricing pages.
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
  createdAt: Date;
}

const ShopSchema = new Schema<IShop>(
  {
    shopId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    slug: { type: String, unique: true, sparse: true },
    oldSlugs: { type: [String], default: [], index: true },
    agentKeyHash: { type: String, unique: true, sparse: true },
    agentKeyHint: { type: String, default: "" },
    razorpayKeyId: { type: String },
    razorpaySecretEnc: { type: String },
    razorpaySecretHint: { type: String },
    paymentProvider: { type: String, enum: ["razorpay", "phonepe", "paytm"] },
    phonepeClientId: { type: String },
    phonepeClientVersion: { type: String },
    phonepeSecretEnc: { type: String },
    phonepeSecretHint: { type: String },
    phonepeMode: { type: String, enum: ["test", "live"] },
    paytmMid: { type: String },
    paytmKeyEnc: { type: String },
    paytmKeyHint: { type: String },
    paytmWebsite: { type: String },
    paytmMode: { type: String, enum: ["test", "live"] },
    contactEmail: { type: String },
    contactPhone: { type: String },
    contactAddress: { type: String },
  },
  { timestamps: true }
);

export const Shop: Model<IShop> = mongoose.models.Shop || mongoose.model<IShop>("Shop", ShopSchema);

/** Every Shop field the payment code reads (used with .select()). */
export const PAYMENT_FIELDS =
  "paymentProvider razorpayKeyId razorpaySecretEnc razorpaySecretHint " +
  "phonepeClientId phonepeClientVersion phonepeSecretEnc phonepeSecretHint phonepeMode " +
  "paytmMid paytmKeyEnc paytmKeyHint paytmWebsite paytmMode";
