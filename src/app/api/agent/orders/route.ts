import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { PricingConfig } from "@/models/PricingConfig";
import { Printer, type PaperSize } from "@/models/Printer";
import { getAgentShopId } from "@/lib/agentAuth";
import { CANCEL_WINDOW_MS } from "@/lib/orderTiming";
import { assignPrinters } from "@/lib/printerRouting";

export const runtime = "nodejs";

/**
 * GET /api/agent/orders
 * Polled by the Electron Print Agent (every few seconds) to find orders
 * that are paid and waiting to be sent to a physical printer.
 *
 * Orders younger than the customer cancel window (see orderTiming.ts) are held back until it ends.
 *
 * IMPORTANT — special paper sizes (Photo, A3, Legal, Letter) are held back
 * from auto-printing until a staff member manually assigns a printer from
 * the dashboard. No software can physically swap a printer's paper tray,
 * so an unassigned non-A4 order could otherwise get silently printed on
 * whatever printer/paper happens to be loaded. Requiring a manual printer
 * assignment for these forces a human to confirm the correct paper is in
 * before it prints. Plain A4 jobs (the default stock) still auto-print.
 */
export async function GET(req: NextRequest) {
  const shopId = await getAgentShopId(req);
  if (!shopId) {
    return NextResponse.json({ error: "Invalid or missing agent key" }, { status: 401 });
  }

  await connectDB();

  const config = await PricingConfig.findOne({ shopId }).select("printingPaused autoPrint defaultColorPrinterId defaultBwPrinterId");
  if (config?.printingPaused) {
    // Shop-wide pause (lunch break / printer maintenance) — hold everything,
    // even already-queued orders, until staff resumes from the dashboard.
    return NextResponse.json([]);
  }

  // Auto-print off: the agent only sees orders the shop has approved with "Print now".
  const autoPrintOff = config?.autoPrint === false;

  // Shop-chosen default printers (Shop Controls): an order nobody assigned goes to the default for its colour mode,
  // as long as that printer is set up for the order's paper size.
  const defaults = new Map<"color" | "bw", { id: string; sizes: PaperSize[] }>();
  for (const [mode, id] of [["color", config?.defaultColorPrinterId], ["bw", config?.defaultBwPrinterId]] as const) {
    if (!id || !mongoose.isValidObjectId(id)) continue;
    const pr = await Printer.findOne({ _id: id, shopId, type: { $in: [mode, "both"] } }).select("supportedPaperSizes").lean();
    if (pr) defaults.set(mode, { id: String(pr._id), sizes: pr.supportedPaperSizes ?? [] });
  }
  const viaDefault = [...defaults].map(([printType, d]) => ({ printType, paperSize: { $in: d.sizes }, printerId: null }));

  const orders = await Order.find({
    shopId,
    ...(autoPrintOff ? { approvedForPrint: true } : {}),
    paymentStatus: "paid",
    printStatus: "queued",
    // HOLD: the customer can still cancel during the first ~35s (countdown on their receipt screen), so the
    // agent only sees an order once that window is over — it can no longer be cancelled/refunded mid-print.
    createdAt: { $lte: new Date(Date.now() - CANCEL_WINDOW_MS) },
    requiresManualPrint: { $ne: true },
    $or: [{ paperSize: "A4" }, { printerId: { $exists: true, $ne: null } }, ...viaDefault],
  })
    .sort({ priority: -1, queuePosition: 1, createdAt: 1 }) // priority/rush first, then manual queue order, then FIFO
    .limit(20)
    .lean();

  // Orders nobody assigned: default printer first, another idle printer if it is busy (see printerRouting.ts).
  // Not saved: decided again on each poll, and it becomes permanent when the agent reports the printer it used.
  if (defaults.size && orders.some((o) => !o.printerId)) {
    const [printers, busyRaw] = await Promise.all([
      Printer.find({ shopId }).select("type supportedPaperSizes status lastSeenAt").sort({ createdAt: 1 }).lean(),
      Order.distinct("printerId", { shopId, printStatus: "printing", printerId: { $ne: null } }),
    ]);
    assignPrinters(orders, defaults, printers, busyRaw);
  }

  return NextResponse.json(orders);
}
