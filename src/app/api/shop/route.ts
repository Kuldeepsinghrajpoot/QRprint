import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { PricingConfig } from "@/models/PricingConfig";
import { getSession } from "@/lib/session";
import { slugProblem, customerUrl } from "@/lib/shop";
import { shopUrlForSlug } from "@/lib/shopUrl";

export const runtime = "nodejs";

/** GET /api/shop — this shop's name, sub-address and customer link. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const [shop, config] = await Promise.all([
    Shop.findOne({ shopId: session.shopId }).select("slug name").lean(),
    PricingConfig.findOne({ shopId: session.shopId }).select("shopName").lean(),
  ]);
  const slug = shop?.slug ?? "";
  return NextResponse.json({
    shopId: session.shopId,
    name: config?.shopName || shop?.name || "",
    slug,
    url: customerUrl(session.shopId, slug),
    subAddressesEnabled: !!shopUrlForSlug("x"),
    urlTemplate: shopUrlForSlug("{slug}"),
  });
}

const patchSchema = z.object({ slug: z.string().trim().toLowerCase() });

/** PATCH /api/shop — owner changes the shop's sub-address name. (The old name keeps working, so printed QR codes stay valid.) */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Only the shop owner can change the shop address" }, { status: 403 });
  }
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  const { slug } = parsed.data;

  await connectDB();
  const problem = await slugProblem(slug, session.shopId);
  if (problem) return NextResponse.json({ error: problem }, { status: 409 });

  try {
    // The previous name keeps working, so QR codes already printed never stop opening this shop.
    const current = await Shop.findOne({ shopId: session.shopId }).select("slug").lean();
    const update: Record<string, unknown> = { $set: { slug }, $setOnInsert: { name: "My Print Shop" } };
    if (current?.slug && current.slug !== slug) update.$addToSet = { oldSlugs: current.slug };
    await Shop.updateOne({ shopId: session.shopId }, update, { upsert: true });
  } catch (err) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "This name is already taken" }, { status: 409 });
    }
    throw err;
  }
  return NextResponse.json({ slug, url: customerUrl(session.shopId, slug) });
}
