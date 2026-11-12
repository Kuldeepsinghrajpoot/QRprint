import { shopOpenStatus } from "@/lib/shopHours";
import { serverError } from "@/lib/apiError";
import { maybeRunCleanup } from "@/lib/fileCleanup";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { PricingConfig, DEFAULT_RATES } from "@/models/PricingConfig";
import { Customer, pointsForAmount } from "@/models/Customer";
import { calcOrderPrice, calcOnlineFee, generateToken, isOffered } from "@/lib/pricing";
import { sendOrderNotification, orderPlacedMessage } from "@/lib/notify";
import { getGateway, verifyPayment, type PaidFields } from "@/lib/payments";
import { isProvider } from "@/lib/payments/types";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";
import { publicUrlForKey } from "@/lib/storage";
import { resolveShopId } from "@/lib/shop";
import { newCancelKey, hashCancelKey } from "@/lib/cancelKey";
import { isShopOnline } from "@/lib/shopStatus";
import { verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

const createOrderSchema = z.object({
  customerName: z.string().trim().min(1, "Name is required").max(100),
  customerPhone: z.string().trim().max(20).optional(),
  // fileUrl is intentionally NOT accepted from the client: the print agent
  // downloads whatever URL is stored, so it is derived server-side from the
  // upload key. fileKey must be one our own /api/upload produced.
  fileKey: z.string().regex(/^orders\/[A-Za-z0-9._-]+$/, "Invalid file key").optional(),
  fileName: z.string().max(255).optional(),
  printType: z.enum(["bw", "color"]),
  paperSize: z.enum(["A4", "A3", "Legal", "Letter", "Photo"]).default("A4"),
  duplex: z.boolean().default(false),
  duplexEdge: z.enum(["long", "short"]).default("long"),
  pagesPerSheet: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(6), z.literal(9), z.literal(16)]).default(1),
  binding: z.enum(["none", "spiral", "lamination"]).default("none"),
  pages: z.number().int().min(1).max(2000, "A single order can't exceed 2000 pages"),
  pageCountEstimated: z.boolean().default(false),
  copies: z.number().int().min(1).max(50),
  priority: z.boolean().default(false),
  paymentMethod: z.enum(["cash", "online", "free"]),
  freePrintingPassword: z.string().max(72).optional(),
  // Present only for real online payments (omitted in simulated/test-mode flow).
  // Razorpay sends its three fields; PhonePe and Paytm send the gatewayOrderId the server gave them. The server re-checks all of it with the gateway.
  paymentProvider: z.enum(["razorpay", "phonepe", "paytm"]).optional(),
  razorpayOrderId: z.string().max(100).optional(),
  razorpayPaymentId: z.string().max(100).optional(),
  razorpaySignature: z.string().max(200).optional(),
  gatewayOrderId: z.string().max(80).optional(),
  // Which shop the customer scanned (from the QR link ?shop=...). Missing = the original single shop.
  shop: z.string().trim().max(40).optional(),
});

/** GET /api/orders — shop dashboard live queue (staff/owner login required) */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized — please log in to the dashboard" }, { status: 401 });
  }

  await connectDB();

  // Auto-cancel cash orders that have sat unpaid for too long (default 20 min),
  // so the queue doesn't get clogged by no-shows / abandoned orders.
  const shopCfg = await PricingConfig.findOne({ shopId: session.shopId }).select("cashAutoCancelMinutes").lean();
  const timeoutMinutes = Number(shopCfg?.cashAutoCancelMinutes || process.env.CASH_AUTO_CANCEL_MINUTES || 20);
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);
  await Order.updateMany(
    {
      shopId: session.shopId,
      paymentMethod: "cash",
      paymentStatus: "pending",
      printStatus: "queued",
      createdAt: { $lt: cutoff },
    },
    { $set: { printStatus: "failed", printerError: "Auto-cancelled: cash payment not confirmed in time" } }
  );

  // Safety net for the privacy feature: retries failed deletes and removes files that are no longer needed (at most every 10 min).
  await maybeRunCleanup();

  const status = req.nextUrl.searchParams.get("printStatus");
  const filter: Record<string, unknown> = { shopId: session.shopId };
  if (status) filter.printStatus = status;

  // The Live Queue asks for one calendar day (?date=YYYY-MM-DD&tz=<Date#getTimezoneOffset>) so it starts fresh every day;
  // older orders live in Order History. Without ?date it returns the latest orders as before.
  const date = req.nextUrl.searchParams.get("date");
  if (date) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    const tz = Number(req.nextUrl.searchParams.get("tz") ?? 0);
    if (!m || !Number.isFinite(tz) || Math.abs(tz) > 14 * 60) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    const start = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + tz * 60 * 1000);
    filter.createdAt = { $gte: start, $lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
  }

  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(date ? 1000 : 200).lean();
  return NextResponse.json(orders);
}

/** POST /api/orders — customer places a new order */
export async function POST(req: NextRequest) {
  // Generous limit — a shop's customers are often on the same WiFi (shared
  // IP), so this is aimed at stopping scripted spam, not normal walk-in traffic.
  const { ok } = rateLimit(`create-order:${getClientIp(req)}`, 30, 5 * 60 * 1000);
  if (!ok) {
    return NextResponse.json({ error: "Too many orders from this network — please wait a few minutes." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;

    await connectDB();

    const shopId = await resolveShopId(data.shop);
    if (!shopId) {
      return NextResponse.json({ error: "Shop not found — please scan the shop QR code again" }, { status: 404 });
    }
    if (!(await isShopOnline(shopId))) {
      return NextResponse.json(
        { error: "This shop is offline and isn't accepting orders right now. Please try again later." },
        { status: 503 },
      );
    }

    let config = await PricingConfig.findOne({ shopId }).select("+freePrintingPasswordHash");
    if (!config) {
      config = await PricingConfig.create({ shopId, shopName: "My Print Shop", rates: DEFAULT_RATES });
    }

    // The pause switch is documented as blocking new orders; enforce it here
    // too (the UI disabling the button is not a control).
    if (config.printingPaused) {
      return NextResponse.json({ error: "The shop is not accepting orders right now" }, { status: 503 });
    }

    // Shop Controls: opening hours, order limits, phone requirement, waiting-order cap
    const hours = shopOpenStatus(config);
    if (!hours.open) {
      return NextResponse.json({ error: hours.message }, { status: 503 });
    }
    if (config.requirePhone && !/^\+?[0-9][0-9 -]{6,18}$/.test(data.customerPhone || "")) {
      return NextResponse.json({ error: "Please enter a valid mobile number" }, { status: 400 });
    }
    if (config.maxPagesPerOrder > 0 && data.pages > config.maxPagesPerOrder) {
      return NextResponse.json({ error: `This shop accepts up to ${config.maxPagesPerOrder} pages per order. Please split your file.` }, { status: 400 });
    }
    if (config.maxActiveOrders > 0) {
      const waiting = await Order.countDocuments({ shopId, printStatus: { $in: ["queued", "printing"] } });
      if (waiting >= config.maxActiveOrders) {
        return NextResponse.json({ error: "The shop is very busy right now. Please try again in a few minutes." }, { status: 503 });
      }
    }

    // Free printing (college / office): no payment at all. The order is marked paid with a total of 0 so it goes
    // straight to the queue and never counts as revenue or cash to collect.
    const free = config.freePrinting === true;
    if (free) {
      if (!config.freePrintingPasswordHash) {
        return NextResponse.json({ error: "Free printing is unavailable until the shop sets its password." }, { status: 503 });
      }
      if (!data.freePrintingPassword || !(await verifyPassword(data.freePrintingPassword, config.freePrintingPasswordHash))) {
        return NextResponse.json({ error: "The free printing password is incorrect." }, { status: 403 });
      }
    }
    if (data.paymentMethod === "free" && !free) {
      return NextResponse.json({ error: "This shop is not offering free printing" }, { status: 400 });
    }
    const paymentMethod = free ? "free" : data.paymentMethod;
    if (!free && !config.cashPaymentEnabled && !config.onlinePaymentEnabled) {
      return NextResponse.json({ error: "This shop isn't taking orders right now. Please check back later." }, { status: 503 });
    }
    if (paymentMethod === "cash" && !config.cashPaymentEnabled) {
      return NextResponse.json({ error: "Cash payment is currently disabled by the shop" }, { status: 400 });
    }
    if (paymentMethod === "online" && !config.onlinePaymentEnabled) {
      return NextResponse.json({ error: "Online payment is currently disabled by the shop" }, { status: 400 });
    }

    if (!isOffered(config.availability, data.paperSize, data.printType)) {
      return NextResponse.json({ error: `This shop doesn't offer ${data.printType === "bw" ? "black & white" : "colour"} printing on ${data.paperSize} paper` }, { status: 400 });
    }

    const price = calcOrderPrice({
      rates: config.rates,
      paperSize: data.paperSize,
      printType: data.printType,
      pages: data.pages,
      pagesPerSheet: data.pagesPerSheet,
      copies: data.copies,
      duplex: data.duplex,
      binding: data.binding,
      priority: data.priority,
      duplexDiscountPercent: config.duplexDiscountPercent,
      bindingSpiralCharge: config.bindingSpiralCharge,
      bindingLaminationCharge: config.bindingLaminationCharge,
      priorityFeePercent: config.priorityFeePercent,
      gstEnabled: config.gstEnabled,
      gstPercent: config.gstPercent,
    });

    // Online payments carry the gateway's charge (and GST on it); cash orders never do. The minimum order check
    // above/below uses the bill without it, so the charge cannot be what makes an order reach the minimum.
    const onlineFee = calcOnlineFee(price.total, !free && paymentMethod === "online" && config.onlineFeeEnabled === true, config.onlineFeePercent ?? 2, config.onlineFeeGstPercent ?? 18);
    const chargeTotal = price.total + onlineFee.total;

    if (!free && config.minOrderAmount > 0 && price.total < config.minOrderAmount) {
      return NextResponse.json({ error: `The minimum order is ₹${config.minOrderAmount}` }, { status: 400 });
    }

    // Determine payment status:
    // - Cash: always starts "pending" (confirmed later at the counter)
    // - Online + a gateway set up: the gateway itself must confirm the payment (right amount, not used before) to be marked "paid"
    // - Online + NO gateway set up: simulated test-mode flow, marked "paid" immediately (never in production)
    let paymentStatus: "pending" | "paid" = free ? "paid" : "pending";
    let paidFields: PaidFields | undefined;
    if (paymentMethod === "online") {
      const active = await getGateway(shopId);
      if (active) {
        // Normally the customer paid through the shop's active gateway. If the shop switched gateways while this customer was
        // paying, accept the gateway they actually used - but only one the shop has its OWN keys saved for (see getGateway).
        const used = data.paymentProvider ?? (data.razorpayOrderId ? "razorpay" : undefined);
        const gateway = used && isProvider(used) && used !== active.provider ? await getGateway(shopId, used) : active;
        if (!gateway) {
          return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
        }
        const proof = await verifyPayment(gateway, data, chargeTotal);
        if (!proof.ok) {
          return NextResponse.json({ error: proof.error }, { status: proof.status });
        }
        // One payment can only ever pay for one order.
        if (await Order.exists(proof.unique)) {
          return NextResponse.json({ error: "This payment has already been used for an order" }, { status: 409 });
        }
        paidFields = proof.fields;
        paymentStatus = "paid";
      } else if (process.env.NODE_ENV === "production") {
        // Never auto-mark orders paid in production just because the payment keys are missing/misconfigured -
        // that would be free printing.
        return NextResponse.json({ error: "Online payments are not available right now" }, { status: 503 });
      } else {
        paymentStatus = "paid"; // dev-only simulation, no real gateway configured
      }
    }

    // Token generation: check-then-insert has a small race window under
    // concurrent requests (two customers could generate the same token
    // in the same instant). We guard against that by catching MongoDB's
    // duplicate-key error on insert and simply retrying with a fresh
    // token, rather than failing the customer's order.
    // Word docs and ZIPs can't be silently printed by the agent (no
    // reliable Windows print path for these), so they're flagged for
    // manual handling by staff, computed server-side from the filename
    // rather than trusting a client-sent flag.
    const requiresManualPrint = /\.(docx?|zip)$/i.test(data.fileName || "");

    const cancelKey = newCancelKey();
    let order;
    let token = generateToken();
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        order = await Order.create({
          token,
          shopId,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          fileUrl: data.fileKey ? publicUrlForKey(data.fileKey) : undefined,
          fileKey: data.fileKey,
          fileName: data.fileName,
          requiresManualPrint,
          printType: data.printType,
          paperSize: data.paperSize,
          duplex: data.duplex,
          duplexEdge: data.duplexEdge,
          pagesPerSheet: data.pagesPerSheet,
          binding: data.binding,
          pages: data.pages,
          pageCountEstimated: data.pageCountEstimated,
          copies: data.copies,
          priority: data.priority,
          subtotal: price.subtotal,
          priorityFee: price.priorityFee,
          gstRate: config.gstEnabled ? config.gstPercent : 0,
          gstAmount: price.gstAmount,
          onlineFee: onlineFee.fee,
          onlineFeeGst: onlineFee.gst,
          totalPrice: free ? 0 : chargeTotal,
          paymentMethod,
          paymentStatus,
          printStatus: "queued",
          ...paidFields, // paymentProvider + the gateway's payment ids (online orders only)
          cancelKeyHash: hashCancelKey(cancelKey),
        });
        break;
      } catch (err: unknown) {
        const e = err as { code?: number; keyPattern?: Record<string, unknown> } | null;
        const isDuplicate = typeof err === "object" && err !== null && e?.code === 11000;
        // A duplicate on anything but the token means the same payment was submitted twice at the same moment.
        if (isDuplicate && e?.keyPattern && !("token" in e.keyPattern)) {
          return NextResponse.json({ error: "This payment has already been used for an order" }, { status: 409 });
        }
        const isDuplicateToken = isDuplicate;
        if (!isDuplicateToken || attempt === 4) throw err;
        token = generateToken(); // collided with an order created moments ago — try a new one
      }
    }
    if (!order) throw new Error("Could not create the order");

    // Loyalty tracking (only if phone provided)
    if (data.customerPhone) {
      await Customer.findOneAndUpdate(
        { shopId, phone: data.customerPhone },
        {
          $set: { name: data.customerName },
          $inc: {
            totalOrders: 1,
            totalSpent: free ? 0 : chargeTotal,
            loyaltyPoints: free ? 0 : pointsForAmount(chargeTotal),
          },
        },
        { upsert: true }
      );

      sendOrderNotification({
        phone: data.customerPhone,
        customerName: data.customerName,
        message: orderPlacedMessage(data.customerName, token),
      }).catch(() => {});
    }

    // The cancel secret is shown to the customer once (never stored in plain text).
    const { cancelKeyHash: _hash, ...publicOrder } = order.toObject();
    void _hash;
    return NextResponse.json({ ...publicOrder, cancelKey }, { status: 201 });
  } catch (err) {
    return serverError(err, "Failed to create order");
  }
}
