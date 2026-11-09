import { serverError } from "@/lib/apiError";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRazorpayOrder, getRazorpayCreds } from "@/lib/razorpay";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { PricingConfig } from "@/models/PricingConfig";
import { resolveShopId } from "@/lib/shop";
import { shopOpenStatus } from "@/lib/shopHours";

export const runtime = "nodejs";

const schema = z.object({
  amount: z.number().positive().max(100000),
  receipt: z.string().min(1).max(40),
  shop: z.string().trim().max(40).optional(),
});

/**
 * POST /api/payments/razorpay/create
 * Creates a Razorpay order for the customer to pay against via the
 * Razorpay Checkout widget on the client. Uses the shop's own Razorpay keys (Settings -> Online payments),
 * or RAZORPAY_KEY_ID/SECRET from the environment when the shop has none.
 * If not configured, the frontend falls back to a simulated payment flow
 * so the rest of the app remains fully testable without a Razorpay account.
 */
export async function POST(req: NextRequest) {
  const { ok } = rateLimit(`rzp-create:${getClientIp(req)}`, 30, 5 * 60 * 1000);
  if (!ok) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Don't take money for an order the shop would refuse anyway (closed, or too many orders waiting).
    await connectDB();
    const shopId = await resolveShopId(parsed.data.shop);
    const creds = await getRazorpayCreds(shopId);
    if (!creds) {
      return NextResponse.json({ error: "Online payment is not set up for this shop", configured: false }, { status: 501 });
    }
    const cfg = shopId ? await PricingConfig.findOne({ shopId }) : null;
    if (cfg) {
      const hours = shopOpenStatus(cfg);
      if (!hours.open) return NextResponse.json({ error: hours.message }, { status: 503 });
      if (cfg.maxActiveOrders > 0 && (await Order.countDocuments({ shopId, printStatus: { $in: ["queued", "printing"] } })) >= cfg.maxActiveOrders) {
        return NextResponse.json({ error: "The shop is very busy right now. Please try again in a few minutes." }, { status: 503 });
      }
    }

    const order = await createRazorpayOrder(creds, parsed.data.amount, parsed.data.receipt);
    return NextResponse.json({
      configured: true,
      razorpayOrderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: creds.keyId,
    });
  } catch (err) {
    return serverError(err, "Failed to create Razorpay order");
  }
}
