import { serverError } from "@/lib/apiError";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { PricingConfig, DEFAULT_RATES } from "@/models/PricingConfig";
import { getSession } from "@/lib/session";
import { z } from "zod";
import { resolveShopId } from "@/lib/shop";

const tier = z.object({
  page1: z.number().min(0).max(100000),
  page2to10: z.number().min(0).max(100000),
  page11plus: z.number().min(0).max(100000),
});
const paperRates = z.object({ bw: tier, color: tier });

// Whitelist of editable fields. Previously the raw request body was passed to
// findOneAndUpdate, allowing negative/NaN prices and arbitrary field writes
// (e.g. shopId).
const pricingSchema = z
  .object({
    shopName: z.string().trim().min(1).max(100),
    rates: z.object({ A4: paperRates, A3: paperRates, Legal: paperRates, Letter: paperRates, Photo: paperRates }),
    duplexDiscountPercent: z.number().min(0).max(100),
    bindingSpiralCharge: z.number().min(0).max(100000),
    bindingLaminationCharge: z.number().min(0).max(100000),
    priorityFeePercent: z.number().min(0).max(1000),
    gstEnabled: z.boolean(),
    gstPercent: z.number().min(0).max(100),
    freePrinting: z.boolean(),
    cashPaymentEnabled: z.boolean(),
    onlinePaymentEnabled: z.boolean(),
    printingPaused: z.boolean(),
  })
  .partial();

export const runtime = "nodejs";

/** GET /api/settings/pricing — public (customer page needs this to calculate live prices) */
export async function GET(req: NextRequest) {
  // The customer page passes ?shop=<id> from the QR link; the dashboard (logged in) always gets its own shop.
  const session = await getSession();
  await connectDB();
  const asked = req.nextUrl.searchParams.get("shop");
  const shopId = asked ? await resolveShopId(asked) : session?.shopId || "main";
  if (!shopId) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }
  let config = await PricingConfig.findOne({ shopId });

  if (!config) {
    config = await PricingConfig.create({ shopId, shopName: "My Print Shop", rates: DEFAULT_RATES });
  }

  return NextResponse.json(config);
}

/** PUT /api/settings/pricing — owner-only, updates pricing config */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Only the shop owner can update pricing" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = pricingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    await connectDB();
    // Free printing and paid methods are exclusive: when free printing is on, Cash and Online are forced off.
    const update = parsed.data.freePrinting ? { ...parsed.data, cashPaymentEnabled: false, onlinePaymentEnabled: false } : parsed.data;
    const config = await PricingConfig.findOneAndUpdate({ shopId: session.shopId }, { $set: update }, {
      new: true,
      upsert: true,
    });
    return NextResponse.json(config);
  } catch (err) {
    return serverError(err, "Failed to update pricing");
  }
}
