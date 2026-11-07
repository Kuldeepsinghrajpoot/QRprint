import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  // Server runtime is usually UTC (e.g. Vercel) but the shop isn't — bucket
  // days and hours in the shop's timezone or peak-hour/daily charts are shifted.
  const tz = process.env.SHOP_TIMEZONE || "Asia/Kolkata";
  const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" });
  const dayKey = (d: Date) => dayFmt.format(d);

  const DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) days.push(dayKey(new Date(now - i * DAY_MS)));
  const since = new Date(now - 14 * DAY_MS); // slight over-fetch; filtered by day key below

  const orders = (
    await Order.find({
      shopId: session.shopId,
      createdAt: { $gte: since },
      paymentStatus: "paid",
      printStatus: { $ne: "cancelled" },
    }).lean()
  ).filter((o) => days.includes(dayKey(new Date(o.createdAt))));

  // Daily totals for the last 14 days
  const dayMap = new Map<string, { orders: number; revenue: number }>();
  for (const d of days) dayMap.set(d, { orders: 0, revenue: 0 });
  for (const o of orders) {
    const entry = dayMap.get(dayKey(new Date(o.createdAt)));
    if (entry) {
      entry.orders += 1;
      entry.revenue += o.totalPrice;
    }
  }

  // Peak hour analysis (0-23)
  const hourCounts = new Array(24).fill(0);
  for (const o of orders) {
    hourCounts[Number(hourFmt.format(new Date(o.createdAt)))] += 1;
  }

  const bwCount = orders.filter((o) => o.printType === "bw").length;
  const colorCount = orders.filter((o) => o.printType === "color").length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.totalPrice, 0);
  const totalPages = orders.reduce((sum, o) => sum + o.pages * o.copies, 0);

  return NextResponse.json({
    daily: Array.from(dayMap.entries()).map(([date, v]) => ({ date, ...v })),
    hourCounts,
    printTypeSplit: { bw: bwCount, color: colorCount },
    totals: {
      orders: orders.length,
      revenue: totalRevenue,
      pages: totalPages,
      avgOrderValue: orders.length ? Math.round(totalRevenue / orders.length) : 0,
    },
  });
}
