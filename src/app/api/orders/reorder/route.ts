import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { serverError } from "@/lib/apiError";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const schema = z.object({
  // The full list of "queued" order IDs, in the exact order staff wants
  // them printed — e.g. after dragging a VIP customer's order to the top.
  orderIds: z.array(z.string().refine((v) => mongoose.isValidObjectId(v), "Invalid order id")).min(1).max(200),
});

/** PATCH /api/orders/reorder — staff drag-and-drop reordering of the print queue */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await connectDB();

    // Assign strictly increasing queuePosition values matching the new
    // order — the agent (and the dashboard) sort by this ascending.
    const bulkOps = parsed.data.orderIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id, shopId: session.shopId, printStatus: "queued" as const },
        update: { $set: { queuePosition: index } },
      },
    }));

    await Order.bulkWrite(bulkOps);

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err, "Failed to reorder the queue");
  }
}
