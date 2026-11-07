import crypto from "crypto";
import { Shop } from "@/models/Shop";
import { validateSlug, shopUrlForSlug } from "@/lib/shopUrl";

/** Short random public id for a shop (used in the customer QR link). */
export const newShopId = (): string => crypto.randomBytes(6).toString("hex"); // 12 hex chars

/** New secret key for the desktop Print Agent. Shown to the owner once; only its hash is stored. */
export const newAgentKey = (): string => "qpa_" + crypto.randomBytes(24).toString("hex");

export const hashAgentKey = (key: string): string => crypto.createHash("sha256").update(key.trim()).digest("hex");

/** Does this shop exist? ("main" = the original single-shop data from before accounts existed.) */
export async function shopExists(shopId: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(shopId)) return false;
  if (shopId === "main") return true;
  return !!(await Shop.exists({ shopId }));
}

/**
 * Accepts either a shop's internal id (old "?shop=" links) or its sub-address name (slug) and returns the shopId,
 * or null when no such shop exists. "main" = the original single-shop data from before accounts existed.
 */
export async function resolveShopId(idOrSlug: string | null | undefined): Promise<string | null> {
  const v = (idOrSlug || "main").trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,40}$/.test(v)) return null;
  const hit = await Shop.findOne({ $or: [{ slug: v }, { shopId: v }, { oldSlugs: v }] }).select("shopId").lean();
  if (hit) return hit.shopId;
  return v === "main" ? "main" : null;
}

/** Is this sub-address name valid and not used by another shop? */
export async function slugProblem(slug: string, ownShopId?: string): Promise<string | null> {
  const bad = validateSlug(slug);
  if (bad) return bad;
  const taken = await Shop.findOne({ $or: [{ slug }, { oldSlugs: slug }] }).select("shopId").lean();
  return taken && taken.shopId !== ownShopId ? "This name is already taken" : null;
}

/** Creates (or replaces) the shop's agent key and returns the new plain key — show it once. */
export async function rotateAgentKey(shopId: string, shopName: string): Promise<string> {
  const key = newAgentKey();
  await Shop.updateOne(
    { shopId },
    { $set: { agentKeyHash: hashAgentKey(key), agentKeyHint: key.slice(-4) }, $setOnInsert: { name: shopName } },
    { upsert: true }
  );
  return key;
}

/**
 * The customer link for a shop: its own sub-address if sub-addresses are set up, otherwise
 * <app>/<slug> (e.g. localhost:3000/ravi-xerox). A shop with no slug uses its random id: <app>/<shopId>.
 */
export function customerUrl(shopId: string, slug?: string | null): string {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  if (slug) return shopUrlForSlug(slug) || `${appUrl}/${slug}`;
  return `${appUrl}/${shopId}`;
}
