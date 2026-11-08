import { serverError } from "@/lib/apiError";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Shop } from "@/models/Shop";
import { SignupOtp } from "@/models/SignupOtp";
import { PricingConfig, DEFAULT_RATES } from "@/models/PricingConfig";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { newShopId, rotateAgentKey, slugProblem, customerUrl } from "@/lib/shop";
import { sendMail, welcomeEmail } from "@/lib/mail";
import { otpMatches, OTP_MAX_ATTEMPTS } from "@/lib/otp";

export const runtime = "nodejs";

const verifySchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

/**
 * POST /api/auth/signup/verify — step 2 of 2. With the right code, creates the shop, owner login, pricing and Print Agent key.
 */
export async function POST(req: NextRequest) {
  const { ok } = rateLimit(`signup-verify:${getClientIp(req)}`, 30, 60 * 60 * 1000);
  if (!ok) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });

  try {
    const parsed = verifySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid details" }, { status: 400 });
    const email = parsed.data.email.toLowerCase();
    const { code } = parsed.data;

    await connectDB();
    const pending = await SignupOtp.findOne({ email });
    if (!pending || pending.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "This code has expired. Go back and ask for a new one.", expired: true }, { status: 410 });
    }

    if (!otpMatches(email, code, pending.codeHash)) {
      const attempts = pending.attempts + 1;
      if (attempts >= OTP_MAX_ATTEMPTS) {
        await SignupOtp.deleteOne({ _id: pending._id });
        return NextResponse.json({ error: "Too many wrong codes. Go back and ask for a new one.", expired: true }, { status: 429 });
      }
      await SignupOtp.updateOne({ _id: pending._id }, { $set: { attempts } });
      const left = OTP_MAX_ATTEMPTS - attempts;
      return NextResponse.json({ error: `That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.` }, { status: 400 });
    }

    // Right code. Re-check, because the email or address could have been taken while the code was in the inbox.
    if (await User.exists({ email })) {
      await SignupOtp.deleteOne({ _id: pending._id });
      return NextResponse.json({ error: "An account with this email already exists. Please sign in." }, { status: 409 });
    }
    const slugErr = await slugProblem(pending.slug);
    if (slugErr) {
      await SignupOtp.deleteOne({ _id: pending._id });
      return NextResponse.json({ error: `Shop address: ${slugErr}. Please sign up again with another address.`, expired: true }, { status: 409 });
    }

    const { name, shopName, slug, passwordHash } = pending;
    // Single use: removed first, so the same code can't create two accounts.
    if (!(await SignupOtp.findOneAndDelete({ _id: pending._id }))) {
      return NextResponse.json({ error: "This code was already used.", expired: true }, { status: 410 });
    }

    const shopId = newShopId();
    const agentKey = await rotateAgentKey(shopId, shopName);
    await Shop.updateOne({ shopId }, { $set: { slug } });
    await PricingConfig.create({ shopId, shopName, rates: DEFAULT_RATES });
    const user = await User.create({ shopId, name, email, passwordHash, role: "owner" });

    const token = await createSessionToken({ userId: String(user._id), shopId, role: "owner", name });
    // Welcome email: waited for briefly (so serverless hosts don't cut it off) but never allowed to fail or delay sign-up for long.
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
    const mail = welcomeEmail({ name, shopName, shopUrl: customerUrl(shopId, slug), dashboardUrl: `${appUrl}/login` });
    await Promise.race([sendMail({ to: email, ...mail }), new Promise((r) => setTimeout(r, 6000))]);

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
    return serverError(err, "Verification failed");
  }
}
