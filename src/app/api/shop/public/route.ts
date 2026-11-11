import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { PricingConfig } from "@/models/PricingConfig";
import { resolveShopId } from "@/lib/shop";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { isShopOnline } from "@/lib/shopStatus";

export const runtime = "nodejs";

/** GET /api/shop/public?shop=<slug or id> — a shop's name and business details, for the footer of its customer page. */
export async function GET(req: NextRequest) {
  const { ok } = rateLimit(`shop-public:${getClientIp(req)}`, 120, 60 * 1000);
  if (!ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const asked = req.nextUrl.searchParams.get("shop");
  if (!asked) return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  await connectDB();
  const shopId = await resolveShopId(asked);
  if (!shopId) return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  const [shop, config, online] = await Promise.all([
    Shop.findOne({ shopId }).select("name contactEmail contactPhone contactAddress").lean(),
    PricingConfig.findOne({ shopId }).select("shopName").lean(),
    isShopOnline(shopId),
  ]);
  return NextResponse.json({
    name: config?.shopName || shop?.name || "",
    email: shop?.contactEmail ?? "",
    phone: shop?.contactPhone ?? "",
    address: shop?.contactAddress ?? "",
    online,
  });
}
