import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { purgeOrderFile } from "@/lib/fileCleanup";
import { refundOnlinePayment } from "@/lib/payments";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { CANCEL_WINDOW_MS } from "@/lib/orderTiming";
import { cancelKeyMatches } from "@/lib/cancelKey";
import { serverError } from "@/lib/apiError";

export const runtime = "nodejs";


/**
 * POST /api/orders/:id/cancel
 * Lets a customer cancel their own order (e.g. wrong file selected) within
 * a short window right after placing it. Only allowed while the order is
 * still "queued" — once it starts printing, it's too late to pull back.
 * If it was paid online, a refund is attempted automatically through the gateway that took the payment (Razorpay, PhonePe or Paytm).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = rateLimit(`cancel-order:${getClientIp(req)}`, 20, 5 * 60 * 1000);
  if (!ok) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  const { id } = await params;

  try {
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    const body = await req.json().catch(() => null);
    const key = typeof body?.key === "string" ? body.key : undefined;

    await connectDB();
    const order = await Order.findById(id).select("+cancelKeyHash");

    // Same answer for "no such order" and "wrong key", so order ids can't be probed.
    if (!order || !cancelKeyMatches(key, order.cancelKeyHash)) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.printStatus !== "queued") {
      return NextResponse.json(
        { error: "This order can no longer be cancelled — it's already being processed." },
        { status: 409 }
      );
    }

    const ageMs = Date.now() - order.createdAt.getTime();
    if (ageMs > CANCEL_WINDOW_MS) {
      return NextResponse.json({ error: "The cancellation window has passed for this order." }, { status: 409 });
    }

    // Cancel FIRST, atomically: if the agent claimed the order (queued ->
    // printing) since our check above, this matches nothing and we refuse —
    // so we never refund money for an order that is already printing.
    const cancelled = await Order.findOneAndUpdate(
      { _id: id, printStatus: "queued" },
      { $set: { printStatus: "cancelled", cancelledAt: new Date(), cancelledBy: "customer" } },
      { returnDocument: "after" }
    );
    if (!cancelled) {
      return NextResponse.json(
        { error: "This order can no longer be cancelled — it's already being processed." },
        { status: 409 }
      );
    }

    let refundIssued = false;
    if (order.paymentMethod === "online" && order.paymentStatus === "paid") {
      try {
        if ((await refundOnlinePayment(order)) === "refunded") {
          refundIssued = true;
          cancelled.paymentStatus = "refunded";
          await cancelled.save();
        }
      } catch (err) {
        // Don't undo the cancellation on a refund hiccup — the order still
        // shouldn't print. Surface this so the shop can follow up manually.
        console.error(`Refund failed for order ${order.token}:`, err);
      }
    }

    if (order.fileKey) {
      await purgeOrderFile(order);
    }

    return NextResponse.json({ order: cancelled, refundIssued });
  } catch (err) {
    return serverError(err, "Failed to cancel order");
  }
}
