import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { getSession } from "@/lib/session";
import { buildOrderFilter } from "@/lib/orderFilter";
import { serverError } from "@/lib/apiError";

export const runtime = "nodejs";

/** GET /api/orders/history - searchable, filterable, paged list of ALL the shop's orders (the Live Queue only keeps the latest 200). */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const sp = req.nextUrl.searchParams;
    const filter = buildOrderFilter(session.shopId, sp);
    const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 25));

    const paid = { $eq: ["$paymentStatus", "paid"] };
    const sumIf = (cond: unknown) => ({ $sum: { $cond: [cond, "$totalPrice", 0] } });
    const [total, agg] = await Promise.all([
      Order.countDocuments(filter),
      Order.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            revenue: sumIf(paid),
            cash: sumIf({ $and: [paid, { $eq: ["$paymentMethod", "cash"] }] }),
            online: sumIf({ $and: [paid, { $eq: ["$paymentMethod", "online"] }] }),
            refunded: sumIf({ $eq: ["$paymentStatus", "refunded"] }),
            cancelled: { $sum: { $cond: [{ $eq: ["$printStatus", "cancelled"] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const pages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(pages, Math.max(1, parseInt(sp.get("page") || "1", 10) || 1));
    const orders = await Order.find(filter)
      .select("-fileKey -fileUrl -razorpayPaymentId")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const s = agg[0] ?? {};
    return NextResponse.json({
      orders,
      total,
      page,
      pages,
      summary: {
        orders: s.orders ?? 0,
        revenue: s.revenue ?? 0,
        cash: s.cash ?? 0,
        online: s.online ?? 0,
        refunded: s.refunded ?? 0,
        cancelled: s.cancelled ?? 0,
      },
    });
  } catch (err) {
    return serverError(err, "Could not load order history");
  }
}
