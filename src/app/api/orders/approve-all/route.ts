import { serverError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

/** POST /api/orders/approve-all — with auto-print off, send every paid, waiting order to the printer in one click. */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await connectDB();
    const res = await Order.updateMany(
      { shopId: session.shopId, printStatus: "queued", paymentStatus: "paid", requiresManualPrint: { $ne: true }, approvedForPrint: { $ne: true } },
      { $set: { approvedForPrint: true } }
    );
    return NextResponse.json({ approved: res.modifiedCount });
  } catch (err) {
    return serverError(err, "Could not send the orders to the printer");
  }
}
