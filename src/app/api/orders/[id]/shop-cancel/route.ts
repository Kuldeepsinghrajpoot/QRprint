import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { getSession } from "@/lib/session";
import { purgeOrderFile } from "@/lib/fileCleanup";
import { isRazorpayConfigured, refundRazorpayPayment } from "@/lib/razorpay";
import { sendOrderNotification, cancelledMessage } from "@/lib/notify";
import { serverError } from "@/lib/apiError";

export const runtime = "nodejs";

const schema = z.object({ reason: z.string().trim().max(200).optional() });

/**
 * POST /api/orders/:id/shop-cancel - the shop cancels a print from the dashboard
 * (customer changed their mind, wrong file, printer problem...). Works while the order is queued, printing or failed.
 *  - Online payment: refunded through Razorpay automatically.
 *  - Cash already received: marked refunded and the response says how much cash to hand back.
 *  - The stored file is deleted and the customer is notified.
 * If the job was already sent to the printer, paper may still come out - the response says so (`wasPrinting`).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized - please log in to the dashboard" }, { status: 401 });
  }
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const reason = parsed.data.reason || undefined;

    await connectDB();
    const before = await Order.findOne({ _id: id, shopId: session.shopId }).select("printStatus").lean();
    if (!before) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Atomic: only an order that is still queued / printing / failed can be cancelled.
    const cancelled = await Order.findOneAndUpdate(
      { _id: id, shopId: session.shopId, printStatus: { $in: ["queued", "printing", "failed"] } },
      { $set: { printStatus: "cancelled", cancelledAt: new Date(), cancelledBy: "shop", ...(reason ? { cancelReason: reason } : {}) } },
      { new: true }
    );
    if (!cancelled) {
      return NextResponse.json(
        { error: "This order can no longer be cancelled. It is already ready, collected or cancelled." },
        { status: 409 }
      );
    }

    let refundIssued = false;
    let refundFailed = false;
    let cashToReturn = 0;
    if (cancelled.paymentStatus === "paid") {
      if (cancelled.paymentMethod === "online") {
        if (cancelled.razorpayPaymentId && isRazorpayConfigured()) {
          try {
            await refundRazorpayPayment(cancelled.razorpayPaymentId);
            refundIssued = true;
            cancelled.paymentStatus = "refunded";
            await cancelled.save();
          } catch (err) {
            // The order stays cancelled; the shop must refund this one manually from the payment dashboard.
            refundFailed = true;
            console.error(`Refund failed for order ${cancelled.token}:`, err);
          }
        } else {
          refundFailed = true;
        }
      } else {
        cashToReturn = cancelled.totalPrice;
        cancelled.paymentStatus = "refunded";
        await cancelled.save();
      }
    }

    if (cancelled.fileKey) {
      const result = await purgeOrderFile(cancelled);
      if (result.deleted) {
        cancelled.fileKey = undefined;
        cancelled.fileUrl = undefined;
      }
    }

    sendOrderNotification({
      phone: cancelled.customerPhone,
      customerName: cancelled.customerName,
      message: cancelledMessage(cancelled.customerName, cancelled.token, refundIssued),
    }).catch(() => {});

    return NextResponse.json({ order: cancelled, refundIssued, refundFailed, cashToReturn, wasPrinting: before.printStatus === "printing" });
  } catch (err) {
    return serverError(err, "Failed to cancel the print");
  }
}
