import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSession } from "@/lib/session";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { PricingConfig } from "@/models/PricingConfig";

export const runtime = "nodejs";

/** GET /api/orders/:id/invoice — generates a simple GST invoice PDF on the fly */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  await connectDB();

  const order = await Order.findOne({ _id: id, shopId: session.shopId }).lean();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const config = await PricingConfig.findOne({ shopId: order.shopId }).lean();
  const shopName = config?.shopName || "Print Shop";

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([420, 560]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 520;
  const left = 40;

  const draw = (text: string, opts: { size?: number; f?: typeof font; color?: [number, number, number] } = {}) => {
    // Standard PDF fonts only support Latin-1; anything else would make pdf-lib throw.
    const safe = text.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
    page.drawText(safe, {
      x: left,
      y,
      size: opts.size ?? 11,
      font: opts.f ?? font,
      color: rgb(...(opts.color ?? [0.12, 0.16, 0.22])),
    });
    y -= (opts.size ?? 11) + 8;
  };

  draw(shopName, { size: 18, f: bold, color: [0.15, 0.39, 0.92] });
  draw("Tax Invoice / Receipt", { size: 11, color: [0.4, 0.45, 0.55] });
  y -= 10;

  draw(`Invoice / Token: #${order.token}`, { f: bold });
  draw(`Date: ${new Date(order.createdAt).toLocaleString("en-IN", { timeZone: process.env.SHOP_TIMEZONE || "Asia/Kolkata" })}`);
  draw(`Customer: ${order.customerName}`);
  if (order.customerPhone) draw(`Phone: ${order.customerPhone}`);
  y -= 6;

  draw("Order Details", { f: bold, size: 12 });
  draw(`Paper Size: ${order.paperSize}    Print Type: ${order.printType === "bw" ? "Black & White" : "Color"}`);
  draw(`Pages x Copies: ${order.pages} x ${order.copies}    Duplex: ${order.duplex ? `Yes (${order.duplexEdge === "short" ? "short" : "long"} edge)` : "No"}`);
  if ((order.pagesPerSheet ?? 1) > 1) draw(`Pages per sheet: ${order.pagesPerSheet}`);
  draw(`Binding: ${order.binding === "none" ? "-" : order.binding}    Priority: ${order.priority ? "Yes" : "No"}`);
  y -= 6;

  draw("Billing", { f: bold, size: 12 });
  draw(`Subtotal: Rs. ${order.subtotal}`);
  if (order.priorityFee > 0) draw(`Priority/Rush Fee: Rs. ${order.priorityFee}`);
  if (order.gstAmount > 0) draw(`GST (${order.gstRate}%): Rs. ${order.gstAmount}`);
  if ((order.onlineFee ?? 0) > 0) draw(`Online payment fee: Rs. ${order.onlineFee}`);
  if ((order.onlineFeeGst ?? 0) > 0) draw(`GST on online payment fee: Rs. ${order.onlineFeeGst}`);
  draw(`Total Paid: Rs. ${order.totalPrice}`, { f: bold, size: 13, color: [0.09, 0.64, 0.29] });
  draw(`Payment Method: ${order.paymentMethod === "cash" ? "Cash" : order.paymentMethod === "free" ? "Free (no charge)" : "UPI / Online"}`);
  draw(`Payment Status: ${order.paymentStatus.toUpperCase()}`);

  y -= 20;
  draw("This is a system-generated invoice.", { size: 9, color: [0.5, 0.55, 0.6] });

  const pdfBytes = await pdfDoc.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${order.token}.pdf"`,
    },
  });
}
