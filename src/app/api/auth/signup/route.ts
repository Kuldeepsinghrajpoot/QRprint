import { serverError } from "@/lib/apiError";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Shop } from "@/models/Shop";
import { PricingConfig, DEFAULT_RATES } from "@/models/PricingConfig";
import { hashPassword, createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { newShopId, rotateAgentKey, slugProblem, customerUrl } from "@/lib/shop";
import { slugify } from "@/lib/shopUrl";

export const runtime = "nodejs";

const signupSchema = z.object({
  name: z.string().trim().min(1, "Your name is required").max(100),
  shopName: z.string().trim().min(1, "Shop name is required").max(100),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  // The shop's sub-address name (ravi-xerox -> ravi-xerox.qr.lexicalsoftware.in). Made from the shop name when omitted.
  slug: z.string().trim().toLowerCase().max(40).optional(),
});

/**
 * POST /api/auth/signup — creates a NEW shop account (its own shopId, owner login, pricing and Print Agent key).
 * Each shop's data is completely separate from every other shop's.
 */
export async function POST(req: NextRequest) {
  const { ok } = rateLimit(`signup:${getClientIp(req)}`, 5, 60 * 60 * 1000);
  if (!ok) return NextResponse.json({ error: "Too many sign-ups from this network. Try again later." }, { status: 429 });

  try {
    const parsed = signupSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid details" }, { status: 400 });
    }
    const { name, shopName, password } = parsed.data;
    const slug = parsed.data.slug || slugify(shopName);
    const email = parsed.data.email.toLowerCase();

    await connectDB();
    if (await User.exists({ email })) {
      return NextResponse.json({ error: "An account with this email already exists. Please sign in." }, { status: 409 });
    }

    const slugErr = await slugProblem(slug);
    if (slugErr) return NextResponse.json({ error: `Shop address: ${slugErr}`, field: "slug" }, { status: 409 });

    const shopId = newShopId();
    const agentKey = await rotateAgentKey(shopId, shopName);
    await Shop.updateOne({ shopId }, { $set: { slug } });
    await PricingConfig.create({ shopId, shopName, rates: DEFAULT_RATES });
    const user = await User.create({ shopId, name, email, passwordHash: await hashPassword(password), role: "owner" });

    const token = await createSessionToken({ userId: String(user._id), shopId, role: "owner", name });
    const res = NextResponse.json({ ok: true, shopId, agentKey, slug, shopUrl: customerUrl(shopId, slug) }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "An account with this email already exists. Please sign in." }, { status: 409 });
    }
    return serverError(err, "Sign-up failed");
  }
}
