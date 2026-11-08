import { serverError } from "@/lib/apiError";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { SignupOtp } from "@/models/SignupOtp";
import { hashPassword } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { slugProblem } from "@/lib/shop";
import { slugify } from "@/lib/shopUrl";
import { sendMail, otpEmail } from "@/lib/mail";
import { generateOtp, hashOtp, OTP_TTL_MS, OTP_RESEND_MS } from "@/lib/otp";

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
 * POST /api/auth/signup — step 1 of 2. Checks the details and emails a 6-digit code. No account exists yet:
 * it is created by POST /api/auth/signup/verify once the owner proves they can read that inbox.
 * Calling this again with the same details sends a fresh code (at most one per minute).
 */
export async function POST(req: NextRequest) {
  const { ok } = rateLimit(`signup:${getClientIp(req)}`, 10, 60 * 60 * 1000);
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

    const pending = await SignupOtp.findOne({ email });
    if (pending && pending.resendAt.getTime() > Date.now()) {
      const wait = Math.ceil((pending.resendAt.getTime() - Date.now()) / 1000);
      return NextResponse.json({ error: `Please wait ${wait} seconds before asking for another code.`, retryAfter: wait }, { status: 429 });
    }

    const code = generateOtp();
    const now = Date.now();
    await SignupOtp.findOneAndUpdate(
      { email },
      {
        email,
        codeHash: hashOtp(email, code),
        attempts: 0,
        resendAt: new Date(now + OTP_RESEND_MS),
        expiresAt: new Date(now + OTP_TTL_MS),
        name,
        shopName,
        slug,
        passwordHash: await hashPassword(password),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const mail = otpEmail({ name, code, minutes: OTP_TTL_MS / 60000 });
    const sent = await sendMail({ to: email, ...mail });
    if (!sent) {
      if (process.env.NODE_ENV !== "production") {
        // Local development with no mail provider: the code is printed here so you can still finish sign-up.
        console.log(`[otp] (dev only) verification code for ${email}: ${code}`);
      } else {
        await SignupOtp.deleteOne({ email });
        return NextResponse.json({ error: "We couldn't send the verification email. Please try again in a moment." }, { status: 502 });
      }
    }

    return NextResponse.json({ ok: true, needsVerification: true, email, resendIn: OTP_RESEND_MS / 1000 });
  } catch (err) {
    return serverError(err, "Sign-up failed");
  }
}
