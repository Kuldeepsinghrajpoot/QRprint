import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { getSession } from "@/lib/session";
import { buildOrderFilter, shopTimezone, todayKey } from "@/lib/orderFilter";
import { serverError } from "@/lib/apiError";

export const runtime = "nodejs";

const MAX_ROWS = 5000;

/** One CSV cell. Cells starting with = + - @ get a leading ' so Excel never runs them as formulas. */
function cell(v: unknown): string {
  let s = v === undefined || v === null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** GET /api/orders/export - the same filters as Order History, downloaded as a CSV for Excel / accounting. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const filter = buildOrderFilter(session.shopId, req.nextUrl.searchParams);
    const orders = await Order.find(filter).select("-fileKey -fileUrl -razorpayPaymentId").sort({ createdAt: -1 }).limit(MAX_ROWS).lean();

    const tz = shopTimezone();
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

    const header = [
      "Date", "Time", "Token", "Customer", "Phone", "Print type", "Paper", "Duplex", "Flip edge", "Pages per sheet", "Binding", "Pages", "Copies",
      "Subtotal", "Priority fee", "GST", "Total", "Payment method", "Payment status", "Print status", "Cancelled by", "Cancel reason",
    ];
    const rows = orders.map((o) => {
      const at = new Date(o.createdAt);
      return [
        date.format(at), time.format(at), o.token, o.customerName, o.customerPhone, o.printType === "bw" ? "B&W" : "Color",
        o.paperSize, o.duplex ? "Yes" : "No", o.duplex ? (o.duplexEdge === "short" ? "Short" : "Long") : "", o.pagesPerSheet ?? 1, o.binding, o.pages, o.copies, o.subtotal, o.priorityFee, o.gstAmount, o.totalPrice,
        o.paymentMethod, o.paymentStatus, o.printStatus, o.cancelledBy, o.cancelReason,
      ];
    });
    // BOM so Excel opens the file as UTF-8 (₹, Hindi names)
    const csv = "\uFEFF" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="orders-${todayKey(tz)}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return serverError(err, "Could not export orders");
  }
}
