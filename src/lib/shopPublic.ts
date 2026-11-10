import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { PricingConfig, type IPricingConfig } from "@/models/PricingConfig";
import { resolveShopId } from "@/lib/shop";
import { slugFromHostname } from "@/lib/shopUrl";
import { isContactComplete } from "@/lib/shopContact";

export type ShopConfig = Pick<
  IPricingConfig,
  | "rates" | "availability" | "duplexDiscountPercent" | "bindingSpiralCharge" | "bindingLaminationCharge" | "priorityFeePercent"
  | "gstEnabled" | "gstPercent" | "onlineFeeEnabled" | "onlineFeePercent" | "onlineFeeGstPercent" | "freePrinting" | "cashPaymentEnabled" | "onlinePaymentEnabled"
  | "openingHoursEnabled" | "openTime" | "closeTime" | "openDays" | "minOrderAmount" | "maxPagesPerOrder"
>;

/** What the public policy pages need to know about one shop. Contact details come from the owner's Settings. */
export type ShopPublic = {
  shopId: string;
  slug: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  contactComplete: boolean;
  config: ShopConfig | null;
};

/** Looks a shop up by its address name (slug), old name or id. Returns null when there is no such shop. */
export const loadShopPublic = cache(async (idOrSlug: string): Promise<ShopPublic | null> => {
  await connectDB();
  const shopId = await resolveShopId(idOrSlug);
  if (!shopId) return null;
  const [shop, config] = await Promise.all([
    Shop.findOne({ shopId }).select("slug name contactEmail contactPhone contactAddress").lean(),
    PricingConfig.findOne({ shopId }).lean(),
  ]);
  return {
    shopId,
    slug: shop?.slug ?? "",
    name: config?.shopName || shop?.name || "This shop",
    email: shop?.contactEmail ?? "",
    phone: shop?.contactPhone ?? "",
    address: shop?.contactAddress ?? "",
    contactComplete: isContactComplete(shop),
    config: (config as unknown as ShopConfig) ?? null,
  };
});

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * For the plain /terms, /privacy-policy, /refund-policy and /pricing pages: is this request for one shop?
 *  - a shop sub-address (ravi-xerox.qr.lexicalsoftware.in/terms) -> that shop; links stay on the same address
 *  - an old ?shop=<id> link -> that shop; links go to /<shop>/...
 *  - the main address with no shop -> null (show the QRtoPrint pages)
 * A shop that was asked for but does not exist is a 404.
 */
export async function shopFromRequest(sp: SearchParams): Promise<{ shop: ShopPublic; base: string } | null> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim().split(":")[0];
  const slug = slugFromHostname(host);
  if (slug) {
    const shop = await loadShopPublic(slug);
    if (!shop) notFound();
    return { shop, base: "" };
  }
  const q = Array.isArray(sp.shop) ? sp.shop[0] : sp.shop;
  if (q) {
    const shop = await loadShopPublic(q);
    if (!shop) notFound();
    return { shop, base: `/${shop.slug || shop.shopId}` };
  }
  return null;
}
