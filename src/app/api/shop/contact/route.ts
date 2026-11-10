import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { getSession } from "@/lib/session";
import { contactSchema } from "@/lib/shopContact";
import { serverError } from "@/lib/apiError";

export const runtime = "nodejs";

/** PUT /api/shop/contact — the owner saves the shop's phone, email and address. All three are required. */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Only the shop owner can change the business details" }, { status: 403 });
  }
  try {
    const parsed = contactSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid details" }, { status: 400 });
    }
    const { phone, email, address } = parsed.data;
    await connectDB();
    await Shop.updateOne(
      { shopId: session.shopId },
      { $set: { contactPhone: phone, contactEmail: email, contactAddress: address }, $setOnInsert: { name: "My Print Shop" } },
      { upsert: true }
    );
    return NextResponse.json({ ok: true, contactPhone: phone, contactEmail: email, contactAddress: address, contactComplete: true });
  } catch (err) {
    return serverError(err, "Could not save the business details");
  }
}
