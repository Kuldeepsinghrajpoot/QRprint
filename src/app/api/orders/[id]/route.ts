import { serverError } from "@/lib/apiError";
import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { Printer } from "@/models/Printer";
import { purgeOrderFile } from "@/lib/fileCleanup";
import { getSession } from "@/lib/session";
import { sendOrderNotification, readyMessage } from "@/lib/notify";

export const runtime = "nodejs";

const updateSchema = z.object({
  paymentStatus: z.enum(["pending", "paid", "refunded"]).optional(),
  // "cancelled" is not allowed here: use POST /api/orders/:id/shop-cancel (it also refunds and deletes the file)
  printStatus: z.enum(["queued", "printing", "ready", "collected", "failed"]).optional(),
  printerId: z.string().optional(),
  // "Print now" while the shop has auto-print switched off
  approvedForPrint: z.boolean().optional(),
});

/** PATCH /api/orders/:id — dashboard actions: "Cash Received", "Mark Ready", "Collected", refund, assign printer */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized — please log in to the dashboard" }, { status: 401 });
  }

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Marking "refunded" only records it - the money is returned through the cancel flow or the payment gateway -
    // so keep it to the owner.
    if (parsed.data.paymentStatus === "refunded" && session.role !== "owner") {
      return NextResponse.json({ error: "Only the shop owner can mark an order as refunded" }, { status: 403 });
    }

    await connectDB();
    // Only orders of the signed-in shop can be changed.
    const before = await Order.findOne({ _id: id, shopId: session.shopId }).select("printStatus printType paperSize").lean();
    if (!before) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (parsed.data.printerId) {
      // ...and only to a printer of the same shop.
      const printer = mongoose.isValidObjectId(parsed.data.printerId)
        ? await Printer.findOne({ _id: parsed.data.printerId, shopId: session.shopId })
            .select("type supportedPaperSizes")
            .lean()
        : null;
      if (!printer) return NextResponse.json({ error: "Printer not found" }, { status: 404 });
      const supportsType = printer.type === "both" || printer.type === before.printType;
      const supportsPaper = printer.supportedPaperSizes.includes(before.paperSize);
      if (!supportsType || !supportsPaper) {
        return NextResponse.json(
          { error: "The selected printer does not support this order's print type and paper size" },
          { status: 400 }
        );
      }
    }
    const order = await Order.findOneAndUpdate({ _id: id, shopId: session.shopId }, parsed.data, { new: true });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Privacy feature: once collected, delete the stored file (and clear its link from the order)
    let fileDeleted: boolean | undefined;
    if (parsed.data.printStatus === "collected" && order.fileKey) {
      const result = await purgeOrderFile(order);
      fileDeleted = result.deleted;
      if (result.deleted) {
        order.fileKey = undefined;
        order.fileUrl = undefined;
      }
    }

    // Notify the customer (WhatsApp/SMS) the moment staff mark it ready manually
    if (parsed.data.printStatus === "ready" && before?.printStatus !== "ready") {
      sendOrderNotification({
        phone: order.customerPhone,
        customerName: order.customerName,
        message: readyMessage(order.customerName, order.token),
      }).catch(() => {});
    }

    return NextResponse.json(fileDeleted === undefined ? order : { ...order.toObject(), fileDeleted });
  } catch (err) {
    return serverError(err, "Failed to update order");
  }
}
