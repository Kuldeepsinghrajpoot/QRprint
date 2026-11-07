import { serverError } from "@/lib/apiError";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { verifyPassword, createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  // Max 10 attempts per 10 minutes per IP — slows down password guessing
  // without getting in the way of a real user who mistypes a few times.
  const { ok } = rateLimit(`login:${getClientIp(req)}`, 10, 10 * 60 * 1000);
  if (!ok) {
    return NextResponse.json({ error: "Too many login attempts. Please try again in a few minutes." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email or password format" }, { status: 400 });
    }

    await connectDB();
    const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await createSessionToken({
      userId: String(user._id),
      shopId: user.shopId,
      role: user.role,
      name: user.name,
    });

    const res = NextResponse.json({ ok: true, name: user.name, role: user.role });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err) {
    return serverError(err, "Login failed");
  }
}
