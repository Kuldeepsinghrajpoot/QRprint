import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { Printer } from "@/models/Printer";
import { getSession } from "@/lib/session";
import { serverError } from "@/lib/apiError";

export const runtime = "nodejs";

const schema = z
  .object({
    tonerYieldPages: z.number().int().min(0).max(1_000_000),
    refilled: z.literal(true),
  })
  .partial()
  .strict();

/**
 * PATCH /api/supplies/:id { refilled: true } | { tonerYieldPages }
 * Anyone signed in can mark a cartridge as refilled (staff change it at the counter). Only the owner changes the yield.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Printer not found" }, { status: 404 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (parsed.data.tonerYieldPages !== undefined && session.role !== "owner") {
    return NextResponse.json({ error: "Only the shop owner can change the cartridge size" }, { status: 403 });
  }
  try {
    await connectDB();
    const $set: Record<string, unknown> = {};
    if (parsed.data.tonerYieldPages !== undefined) $set.tonerYieldPages = parsed.data.tonerYieldPages;
    if (parsed.data.refilled) $set.tonerRefilledAt = new Date();
    const hit = await Printer.updateOne({ _id: id, shopId: session.shopId }, { $set });
    if (!hit.matchedCount) return NextResponse.json({ error: "Printer not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, "Could not save");
  }
}
