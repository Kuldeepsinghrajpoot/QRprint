import { serverError } from "@/lib/apiError";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { PricingConfig, DEFAULT_RATES } from "@/models/PricingConfig";
import { getSession } from "@/lib/session";
import { z } from "zod";
import { resolveShopId } from "@/lib/shop";
import { hashPassword } from "@/lib/auth";

const tier = z.object({
  page1: z.number().min(0).max(100000),
  page2to10: z.number().min(0).max(100000),
  page11plus: z.number().min(0).max(100000),
});
const paperRates = z.object({ bw: tier, color: tier });

// Whitelist of editable fields. Previously the raw request body was passed to
// findOneAndUpdate, allowing negative/NaN prices and arbitrary field writes
// (e.g. shopId).
const availabilityFlags = z.object({ bw: z.boolean(), color: z.boolean() });

const pricingSchema = z
  .object({
    shopName: z.string().trim().min(1).max(100),
    rates: z.object({ A4: paperRates, A3: paperRates, Legal: paperRates, Letter: paperRates, Photo: paperRates }),
    availability: z.object({ A4: availabilityFlags, A3: availabilityFlags, Legal: availabilityFlags, Letter: availabilityFlags, Photo: availabilityFlags }),
    duplexDiscountPercent: z.number().min(0).max(100),
    bindingSpiralCharge: z.number().min(0).max(100000),
    bindingLaminationCharge: z.number().min(0).max(100000),
    priorityFeePercent: z.number().min(0).max(1000),
    gstEnabled: z.boolean(),
    gstPercent: z.number().min(0).max(100),
    onlineFeeEnabled: z.boolean(),
    onlineFeePercent: z.number().min(0).max(10),
    onlineFeeGstPercent: z.number().min(0).max(100),
    freePrinting: z.boolean(),
    freePrintingPassword: z.string().min(8).max(72).optional(),
    clearFreePrintingPassword: z.boolean().optional(),
    cashPaymentEnabled: z.boolean(),
    onlinePaymentEnabled: z.boolean(),
  })
  .partial();

export const runtime = "nodejs";

function pricingResponse(config: Awaited<ReturnType<typeof PricingConfig.findOne>>, includePasswordStatus = false) {
  if (!config) throw new Error("Pricing configuration was not saved");
  const { freePrintingPasswordHash, ...safeConfig } = config.toObject();
  return {
    ...safeConfig,
    ...(includePasswordStatus ? { freePrintingPasswordSet: Boolean(freePrintingPasswordHash) } : {}),
  };
}

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
  const query = PricingConfig.findOne({ shopId });
  let config = await (session?.role === "owner" ? query.select("+freePrintingPasswordHash") : query);

  if (!config) {
    config = await PricingConfig.create({ shopId, shopName: "My Print Shop", rates: DEFAULT_RATES });
  }

  return NextResponse.json(pricingResponse(config, session?.role === "owner"));
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
    const { freePrintingPassword, clearFreePrintingPassword, ...fields } = parsed.data;
    if (freePrintingPassword && clearFreePrintingPassword) {
      return NextResponse.json({ error: "Set a new password or remove the saved password, not both." }, { status: 400 });
    }

    await connectDB();
    const existing = await PricingConfig.findOne({ shopId: session.shopId }).select("+freePrintingPasswordHash");
    const freePrintingEnabled = fields.freePrinting ?? existing?.freePrinting ?? false;
    if (clearFreePrintingPassword && freePrintingEnabled) {
      return NextResponse.json({ error: "Turn off free printing before removing its password." }, { status: 400 });
    }

    const passwordHash = freePrintingPassword
      ? await hashPassword(freePrintingPassword)
      : clearFreePrintingPassword
        ? ""
        : existing?.freePrintingPasswordHash ?? "";
    if (freePrintingEnabled && !passwordHash) {
      return NextResponse.json({ error: "Set a free printing password before enabling free printing." }, { status: 400 });
    }

    // Free printing and paid methods are exclusive: when free printing is on, Cash and Online are forced off.
    const update = {
      ...fields,
      ...(fields.freePrinting ? { cashPaymentEnabled: false, onlinePaymentEnabled: false } : {}),
      ...(freePrintingPassword || clearFreePrintingPassword ? { freePrintingPasswordHash: passwordHash } : {}),
    };
    const config = await PricingConfig.findOneAndUpdate({ shopId: session.shopId }, { $set: update }, {
      returnDocument: "after",
      upsert: true,
    }).select("+freePrintingPasswordHash");
    return NextResponse.json(pricingResponse(config, true));
  } catch (err) {
    return serverError(err, "Failed to update pricing");
  }
}
