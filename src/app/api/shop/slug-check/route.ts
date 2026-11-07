import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { slugProblem } from "@/lib/shop";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

/** GET /api/shop/slug-check?slug=ravi-xerox — is this sub-address name free? (used by the sign-up form) */
export async function GET(req: NextRequest) {
  const { ok } = rateLimit(`slug-check:${getClientIp(req)}`, 60, 60 * 1000);
  if (!ok) return NextResponse.json({ available: false, reason: "Too many checks — wait a moment" }, { status: 429 });
  const slug = (req.nextUrl.searchParams.get("slug") || "").toLowerCase();
  await connectDB();
  const session = await getSession();
  const problem = await slugProblem(slug, session?.shopId);
  return NextResponse.json({ available: !problem, reason: problem });
}
