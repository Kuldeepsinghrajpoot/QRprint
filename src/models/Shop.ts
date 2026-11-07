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
  },
  { timestamps: true }
);

export const Shop: Model<IShop> = mongoose.models.Shop || mongoose.model<IShop>("Shop", ShopSchema);
