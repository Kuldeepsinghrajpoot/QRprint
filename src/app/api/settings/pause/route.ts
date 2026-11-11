import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { PricingConfig, DEFAULT_RATES } from "@/models/PricingConfig";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const schema = z.object({ printingPaused: z.boolean() });

/**
 * PATCH /api/settings/pause
 * Toggles the shop-wide pause: while paused, customers can't place new
 * orders and the Print Agent won't pick up already-queued ones either —
 * covers both a lunch break and a printer being down for maintenance.
 * Any logged-in staff member can toggle this (unlike full pricing edits,
 * which are owner-only) since it's a day-to-day operational switch.
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectDB();
  let config = await PricingConfig.findOneAndUpdate(
    { shopId: session.shopId },
    { printingPaused: parsed.data.printingPaused },
    { returnDocument: "after" }
  );

  if (!config) {
    config = await PricingConfig.create({
      shopId: session.shopId,
      shopName: "My Print Shop",
      rates: DEFAULT_RATES,
      printingPaused: parsed.data.printingPaused,
    });
  }

  return NextResponse.json(config);
}
