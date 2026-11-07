import { Order } from "@/models/Order";
import { Printer } from "@/models/Printer";

/** Rough speed of one printer. Real jobs vary (colour, duplex, big files), so the result is shown as "about". */
const PAGES_PER_MINUTE = 20;
/** Handling time per order: picking up the file, loading paper, sorting the output. */
const MINUTES_PER_ORDER = 0.5;

export interface WaitEstimate {
  ahead: number; // orders still to print before this one
  minutes: number; // about how long until it starts printing / is done; 0 when nothing is ahead
}

/**
 * How busy the shop is. Counts orders that are paid and still queued or printing; with `before` only those placed
 * earlier than that time (the orders ahead of one particular customer), otherwise the whole queue.
 */
export async function estimateWait(shopId: string, before?: Date): Promise<WaitEstimate> {
  const [rows, onlinePrinters] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          shopId,
          paymentStatus: "paid",
          printStatus: { $in: ["queued", "printing"] },
          ...(before ? { createdAt: { $lt: before } } : {}),
        },
      },
      { $group: { _id: null, orders: { $sum: 1 }, pages: { $sum: { $multiply: ["$pages", "$copies"] } } } },
    ]),
    Printer.countDocuments({ shopId, status: "online" }),
  ]);
  const ahead: number = rows[0]?.orders ?? 0;
  const pages: number = rows[0]?.pages ?? 0;
  if (ahead === 0) return { ahead: 0, minutes: 0 };
  const printers = Math.max(1, onlinePrinters);
  return { ahead, minutes: Math.max(1, Math.ceil(pages / (PAGES_PER_MINUTE * printers) + ahead * MINUTES_PER_ORDER)) };
}
