import { serverError } from "@/lib/apiError";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { PricingConfig, DEFAULT_RATES } from "@/models/PricingConfig";
import { getSession } from "@/lib/session";
import mongoose from "mongoose";
import { Printer } from "@/models/Printer";

export const runtime = "nodejs";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the 24-hour format, e.g. 09:00");

const controlsSchema = z
  .object({
    autoPrint: z.boolean(),
    defaultColorPrinterId: z.string().trim().max(40),
    defaultBwPrinterId: z.string().trim().max(40),
    openingHoursEnabled: z.boolean(),
    openTime: hhmm,
    closeTime: hhmm,
    openDays: z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one open day").max(7),
    timezone: z.string().trim().max(60).refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown time zone"),
    minOrderAmount: z.number().min(0).max(100000),
    maxPagesPerOrder: z.number().int().min(0).max(2000),
    maxActiveOrders: z.number().int().min(0).max(1000),
    showWaitTime: z.boolean(),
    customerNotice: z.string().trim().max(200),
    cashAutoCancelMinutes: z.number().int().min(1).max(1440),
  })
  .partial()
  .strict();

const FIELDS = [
  "autoPrint", "defaultColorPrinterId", "defaultBwPrinterId", "openingHoursEnabled", "openTime", "closeTime", "openDays", "timezone", "minOrderAmount",
  "maxPagesPerOrder", "maxActiveOrders", "showWaitTime", "customerNotice", "cashAutoCancelMinutes", "printingPaused",
] as const;

const pick = (c: object | null) => Object.fromEntries(FIELDS.map((k) => [k, (c as Record<string, unknown> | null)?.[k]]));

/** GET /api/settings/controls — the Shop Controls page */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  let config = await PricingConfig.findOne({ shopId: session.shopId });
  if (!config) config = await PricingConfig.create({ shopId: session.shopId, shopName: "My Print Shop", rates: DEFAULT_RATES });
  return NextResponse.json(pick(config.toObject()));
}

/**
 * PATCH /api/settings/controls
 * Auto-print is a day-to-day switch, so any signed-in staff member can flip it (like Pause). Everything else is owner-only.
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = controlsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid settings" }, { status: 400 });
    }
    const onlyAutoPrint = Object.keys(parsed.data).every((k) => k === "autoPrint");
    if (session.role !== "owner" && !onlyAutoPrint) {
      return NextResponse.json({ error: "Only the shop owner can change these settings" }, { status: 403 });
    }

    await connectDB();

    // A default printer must be one of this shop's printers and able to print that colour mode.
    for (const [key, mode, label] of [
      ["defaultColorPrinterId", "color", "colour"],
      ["defaultBwPrinterId", "bw", "black & white"],
    ] as const) {
      const id = parsed.data[key];
      if (!id) continue;
      const ok =
        mongoose.isValidObjectId(id) &&
        (await Printer.exists({ _id: id, shopId: session.shopId, type: { $in: [mode, "both"] } }));
      if (!ok) return NextResponse.json({ error: `Pick a ${label} printer from your printer list` }, { status: 400 });
    }

    const config = await PricingConfig.findOneAndUpdate(
      { shopId: session.shopId },
      { $set: parsed.data, $setOnInsert: { shopName: "My Print Shop", rates: DEFAULT_RATES } },
      { returnDocument: "after", upsert: true }
    );
    return NextResponse.json(pick(config.toObject()));
  } catch (err) {
    return serverError(err, "Failed to save settings");
  }
}
