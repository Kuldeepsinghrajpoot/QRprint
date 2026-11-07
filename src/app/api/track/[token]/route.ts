import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { PricingConfig } from "@/models/PricingConfig";
import { estimateWait } from "@/lib/queueEstimate";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

/**
 * GET /api/track/:token — public, used by the customer order-tracking page.
 * Order tokens are short (e.g. "A247") by design — customers read them
 * aloud at the counter — so they're rate-limited here to stop someone
 * from scanning through all ~23,000 possible tokens to harvest other
 * customers' order details.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { ok } = rateLimit(`track:${getClientIp(req)}`, 20, 60 * 1000); // 20 lookups/min per IP
  if (!ok) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment and try again." }, { status: 429 });
  }

  const { token } = await params;
  await connectDB();

  const order = await Order.findOne({ token: token.toUpperCase().replace(/^#/, "") }).select(
    "shopId token customerName printStatus paymentStatus paymentMethod totalPrice pages copies printType createdAt cancelledBy cancelReason"
  );

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // While the order is still waiting: how many orders are ahead of it and about how long that takes.
  const { shopId, ...publicOrder } = order.toObject();
  let wait: { ahead: number; waitMinutes: number } | undefined;
  if (order.paymentStatus === "paid" && ["queued", "printing"].includes(order.printStatus)) {
    const config = await PricingConfig.findOne({ shopId }).select("showWaitTime").lean();
    if (config?.showWaitTime !== false) {
      const w = await estimateWait(shopId, order.createdAt);
      wait = { ahead: w.ahead, waitMinutes: w.minutes };
    }
  }
  return NextResponse.json({ ...publicOrder, ...wait });
}
