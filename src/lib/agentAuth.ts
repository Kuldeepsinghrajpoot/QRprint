import { NextRequest } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { hashAgentKey } from "@/lib/shop";

/**
 * The desktop Print Agent authenticates with the secret key of ITS shop (Dashboard → Settings → Print Agent).
 * The key identifies the shop, so every agent request is automatically limited to that shop's printers and orders.
 *
 * Returns the shopId the key belongs to, or null when the key is missing/invalid (fail closed).
 * Legacy: the old shared AGENT_API_KEY from .env.local still works and maps to the original "main" shop.
 */
export async function getAgentShopId(req: NextRequest): Promise<string | null> {
  const key = req.headers.get("x-agent-key")?.trim();
  if (!key) return null;

  const legacy = process.env.AGENT_API_KEY?.trim();
  if (legacy) {
    const a = crypto.createHash("sha256").update(key).digest();
    const b = crypto.createHash("sha256").update(legacy).digest();
    if (crypto.timingSafeEqual(a, b)) return "main";
  }

  await connectDB();
  const shop = await Shop.findOne({ agentKeyHash: hashAgentKey(key) }).select("shopId").lean();
  return shop ? shop.shopId : null;
}
