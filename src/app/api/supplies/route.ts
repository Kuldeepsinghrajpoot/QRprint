import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Printer } from "@/models/Printer";
import { Order } from "@/models/Order";
import { getSession } from "@/lib/session";
import { serverError } from "@/lib/apiError";

export const runtime = "nodejs";

/**
 * GET /api/supplies
 * Per printer: how many pages it has printed since its cartridge / ink was last refilled, against the cartridge yield
 * the owner entered. Only orders that finished printing (ready or collected) and were sent to that printer count.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await connectDB();
    const printers = await Printer.find({ shopId: session.shopId }).sort({ createdAt: 1 }).lean();
    const rows = await Promise.all(
      printers.map(async (p) => {
        const since = p.tonerRefilledAt ?? p.createdAt;
        const [agg] = await Order.aggregate([
          { $match: { shopId: session.shopId, printerId: p._id, printStatus: { $in: ["ready", "collected"] }, updatedAt: { $gte: since } } },
          { $group: { _id: null, pages: { $sum: { $multiply: ["$pages", "$copies"] } } } },
        ]);
        const yieldPages = p.tonerYieldPages ?? 0;
        const used = agg?.pages ?? 0;
        return {
          _id: String(p._id),
          name: p.name,
          type: p.type,
          yieldPages,
          refilledAt: p.tonerRefilledAt ?? null,
          usedPages: used,
          leftPages: yieldPages > 0 ? Math.max(0, yieldPages - used) : null,
        };
      })
    );
    return NextResponse.json(rows);
  } catch (err) {
    return serverError(err, "Could not load supplies");
  }
}
