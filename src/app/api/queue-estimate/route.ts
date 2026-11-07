import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { PricingConfig } from "@/models/PricingConfig";
import { resolveShopId } from "@/lib/shop";
import { estimateWait } from "@/lib/queueEstimate";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { serverError } from "@/lib/apiError";

export const runtime = "nodejs";

/** GET /api/queue-estimate?shop=<slug|id> - public: how many orders are waiting and about how long it takes. */
export async function GET(req: NextRequest) {
  const { ok } = rateLimit(`queue-estimate:${getClientIp(req)}`, 60, 60 * 1000);
  if (!ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  try {
    await connectDB();
    const asked = req.nextUrl.searchParams.get("shop");
    const shopId = await resolveShopId(asked || "main");
    if (!shopId) return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    const config = await PricingConfig.findOne({ shopId }).select("showWaitTime").lean();
    if (config?.showWaitTime === false) return NextResponse.json({ enabled: false });
    return NextResponse.json({ enabled: true, ...(await estimateWait(shopId)) });
  } catch (err) {
    return serverError(err, "Could not load the queue");
  }
}
