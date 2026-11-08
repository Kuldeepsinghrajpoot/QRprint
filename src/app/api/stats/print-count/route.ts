import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { PricingConfig } from "@/models/PricingConfig";
import { getSession } from "@/lib/session";
import { serverError } from "@/lib/apiError";
import { PRINTED_SIDES_EXPR } from "@/lib/pricing";

export const runtime = "nodejs";

/** Start (as a UTC Date) of today and of this month in the given time zone. */
function periodStarts(tz: string, now = new Date()) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  const localAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const offsetMs = localAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  return {
    today: new Date(Date.UTC(+p.year, +p.month - 1, +p.day) - offsetMs),
    month: new Date(Date.UTC(+p.year, +p.month - 1, 1) - offsetMs),
  };
}

/**
 * GET /api/stats/print-count
 * How much this shop has printed: pages and orders, split into black & white and colour, for today, this month and
 * all time. "Printed" = orders that finished printing (ready or collected). Pages = pages x copies.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await connectDB();
    const config = await PricingConfig.findOne({ shopId: session.shopId }).select("timezone").lean();
    let tz = config?.timezone || "Asia/Kolkata";
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
    } catch {
      tz = "Asia/Kolkata";
    }
    const start = periodStarts(tz);

    const rows = await Order.aggregate([
      { $match: { shopId: session.shopId, printStatus: { $in: ["ready", "collected"] } } },
      {
        $group: {
          _id: "$printType",
          pagesAll: { $sum: PRINTED_SIDES_EXPR },
          ordersAll: { $sum: 1 },
          pagesMonth: { $sum: { $cond: [{ $gte: ["$updatedAt", start.month] }, PRINTED_SIDES_EXPR, 0] } },
          ordersMonth: { $sum: { $cond: [{ $gte: ["$updatedAt", start.month] }, 1, 0] } },
          pagesToday: { $sum: { $cond: [{ $gte: ["$updatedAt", start.today] }, PRINTED_SIDES_EXPR, 0] } },
          ordersToday: { $sum: { $cond: [{ $gte: ["$updatedAt", start.today] }, 1, 0] } },
        },
      },
    ]);

    const empty = () => ({ bw: 0, color: 0, total: 0 });
    const out = {
      pages: { all: empty(), month: empty(), today: empty() },
      orders: { all: empty(), month: empty(), today: empty() },
    };
    for (const r of rows) {
      const mode = r._id === "color" ? "color" : "bw";
      for (const [period, key] of [["all", "All"], ["month", "Month"], ["today", "Today"]] as const) {
        out.pages[period][mode] += r[`pages${key}`];
        out.orders[period][mode] += r[`orders${key}`];
      }
    }
    for (const kind of ["pages", "orders"] as const) {
      for (const period of ["all", "month", "today"] as const) {
        const o = out[kind][period];
        o.total = o.bw + o.color;
      }
    }
    return NextResponse.json(out);
  } catch (err) {
    return serverError(err, "Could not load the print count");
  }
}
