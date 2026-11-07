import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { getSession } from "@/lib/session";
import { serverError } from "@/lib/apiError";

export const runtime = "nodejs";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * GET /api/customers[?q=name-or-phone]
 * Your regulars, worked out from past orders: one row per mobile number (or per name when no number was given),
 * best spenders first. Cancelled orders don't count.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "Only the shop owner can see customers" }, { status: 403 });

  try {
    await connectDB();
    const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 60);
    const match: Record<string, unknown> = { shopId: session.shopId, printStatus: { $ne: "cancelled" } };
    if (q) {
      const re = new RegExp(escapeRegex(q), "i");
      match.$or = [{ customerName: re }, { customerPhone: re }];
    }

    const customers = await Order.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } }, // so $first below is the most recent name/phone
      {
        $group: {
          _id: {
            $cond: [{ $gt: [{ $strLenCP: { $ifNull: ["$customerPhone", ""] } }, 0] }, "$customerPhone", { $toLower: "$customerName" }],
          },
          name: { $first: "$customerName" },
          phone: { $first: "$customerPhone" },
          orders: { $sum: 1 },
          spent: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$totalPrice", 0] } },
          pages: { $sum: { $multiply: ["$pages", "$copies"] } },
          firstOrderAt: { $min: "$createdAt" },
          lastOrderAt: { $max: "$createdAt" },
        },
      },
      { $sort: { spent: -1, orders: -1 } },
      { $limit: 200 },
      { $project: { _id: 0, key: "$_id", name: 1, phone: 1, orders: 1, spent: 1, pages: 1, firstOrderAt: 1, lastOrderAt: 1 } },
    ]);

    return NextResponse.json({ customers });
  } catch (err) {
    return serverError(err, "Failed to load customers");
  }
}
