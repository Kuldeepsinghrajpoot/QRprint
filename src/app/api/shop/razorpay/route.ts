import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { getSession } from "@/lib/session";
import { encryptSecret, encryptionKeyProblem } from "@/lib/secretBox";
import { User } from "@/models/User";
import { verifyPassword } from "@/lib/auth";
import { sendMail, paymentSettingsChangedEmail } from "@/lib/mail";
import { checkRazorpayKeys } from "@/lib/razorpay";
import { serverError } from "@/lib/apiError";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

const modeOf = (keyId?: string | null) => (keyId?.startsWith("rzp_live_") ? "live" : keyId?.startsWith("rzp_test_") ? "test" : null);

/** GET /api/shop/razorpay — is online payment set up? Never returns the Key Secret. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const shop = await Shop.findOne({ shopId: session.shopId }).select("razorpayKeyId razorpaySecretEnc razorpaySecretHint").lean();
  const own = !!(shop?.razorpayKeyId && shop?.razorpaySecretEnc);
  const platform = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  return NextResponse.json({
    source: own ? "shop" : platform ? "platform" : "none",
    keyId: own ? shop!.razorpayKeyId : "",
    secretHint: own ? shop!.razorpaySecretHint || "" : "",
    mode: own ? modeOf(shop!.razorpayKeyId) : platform ? modeOf(process.env.RAZORPAY_KEY_ID) : null,
  });
}

const schema = z.object({
  keyId: z.string().trim().regex(/^rzp_(test|live)_[A-Za-z0-9]{6,40}$/, "Key ID looks like rzp_live_xxxxxxxx or rzp_test_xxxxxxxx"),
  keySecret: z.string().trim().min(10, "Enter the full Key Secret").max(100),
  password: z.string().min(1, "Enter your password to confirm").max(100),
});

/** Changing where the money goes needs the owner's password again, even though they are already logged in. */
async function confirmOwner(session: { userId: string; shopId: string }, password: string) {
  const user = await User.findOne({ _id: session.userId, shopId: session.shopId });
  if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
  return user;
}

async function notifyOwner(
  user: { email: string; name: string },
  shopName: string,
  action: "added" | "changed" | "removed",
  keyId?: string
) {
  const when = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " (IST)";
  const mail = paymentSettingsChangedEmail({
    name: user.name,
    shopName,
    gateway: "Razorpay",
    action,
    detail: keyId,
    when,
  });
  // Best effort: a mail problem must never block or undo the change itself.
  await Promise.race([sendMail({ to: user.email, ...mail }).catch(() => false), new Promise((r) => setTimeout(r, 6000))]);
}

/** PUT /api/shop/razorpay — owner saves this shop's Razorpay keys. They are checked with Razorpay first, then stored encrypted. */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Only the shop owner can change payment settings" }, { status: 403 });
  }
  const { ok } = rateLimit(`rzp-keys:${session.shopId}:${getClientIp(req)}`, 10, 10 * 60 * 1000);
  if (!ok) return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid keys" }, { status: 400 });
    }
    const { keyId, keySecret, password } = parsed.data;

    const problem = encryptionKeyProblem();
    if (problem) return NextResponse.json({ error: problem }, { status: 503 });

    await connectDB();
    const owner = await confirmOwner(session, password);
    if (!owner) return NextResponse.json({ error: "Your password is wrong" }, { status: 400 });

    const check = await checkRazorpayKeys(keyId, keySecret);
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 });

    const before = await Shop.findOne({ shopId: session.shopId }).select("name razorpayKeyId").lean();
    await Shop.updateOne(
      { shopId: session.shopId },
      { $set: { razorpayKeyId: keyId, razorpaySecretEnc: encryptSecret(keySecret), razorpaySecretHint: keySecret.slice(-4) } }
    );
    await notifyOwner(owner, before?.name || "your shop", before?.razorpayKeyId ? "changed" : "added", keyId);
    return NextResponse.json({ ok: true, keyId, secretHint: keySecret.slice(-4), mode: modeOf(keyId), source: "shop" });
  } catch (err) {
    return serverError(err, "Failed to save the Razorpay keys");
  }
}

/** DELETE /api/shop/razorpay — owner removes this shop's keys. */
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Only the shop owner can change payment settings" }, { status: 403 });
  }
  const { ok } = rateLimit(`rzp-keys:${session.shopId}:${getClientIp(req)}`, 10, 10 * 60 * 1000);
  if (!ok) return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
  try {
    const body = await req.json().catch(() => ({}));
    await connectDB();
    const owner = await confirmOwner(session, typeof body?.password === "string" ? body.password : "");
    if (!owner) return NextResponse.json({ error: "Your password is wrong" }, { status: 400 });
    const before = await Shop.findOne({ shopId: session.shopId }).select("name razorpayKeyId").lean();
    await Shop.updateOne({ shopId: session.shopId }, { $unset: { razorpayKeyId: "", razorpaySecretEnc: "", razorpaySecretHint: "" } });
    await notifyOwner(owner, before?.name || "your shop", "removed", before?.razorpayKeyId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, "Failed to remove the Razorpay keys");
  }
}
