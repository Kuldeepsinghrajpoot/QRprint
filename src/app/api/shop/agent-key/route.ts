import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { getSession } from "@/lib/session";
import { rotateAgentKey } from "@/lib/shop";

export const runtime = "nodejs";

/** GET /api/shop/agent-key — is a Print Agent key set for this shop? (never returns the key itself) */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const shop = await Shop.findOne({ shopId: session.shopId }).select("agentKeyHint agentKeyHash").lean();
  return NextResponse.json({ hasKey: !!shop?.agentKeyHash, hint: shop?.agentKeyHint ?? "", shopId: session.shopId });
}

/** POST /api/shop/agent-key — owner creates a NEW key (the old one stops working). Shown once. */
export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Only the shop owner can create an agent key" }, { status: 403 });
  }
  await connectDB();
  const existing = await Shop.findOne({ shopId: session.shopId }).select("name").lean();
  const key = await rotateAgentKey(session.shopId, existing?.name || "My Print Shop");
  return NextResponse.json({ agentKey: key });
}
