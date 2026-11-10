import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { Shop, PAYMENT_FIELDS } from "@/models/Shop";
import { getSession } from "@/lib/session";
import { encryptSecret, encryptionKeyProblem } from "@/lib/secretBox";
import { User } from "@/models/User";
import { verifyPassword } from "@/lib/auth";
import { sendMail, paymentSettingsChangedEmail } from "@/lib/mail";
import { checkRazorpayKeys, platformRazorpayCreds } from "@/lib/razorpay";
import { checkPhonePeKeys } from "@/lib/payments/phonepe";
import { checkPaytmKeys, defaultPaytmWebsite } from "@/lib/payments/paytm";
import { activeProviderOf } from "@/lib/payments";
import { PROVIDER_LABEL, type GatewayMode, type Provider } from "@/lib/payments/types";
import { serverError } from "@/lib/apiError";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

type ShopDoc = Record<string, string | undefined>;

const razorpayMode = (keyId?: string | null): GatewayMode | null => (keyId?.startsWith("rzp_live_") ? "live" : keyId?.startsWith("rzp_test_") ? "test" : null);

/** What the settings page shows. Never includes a secret: only public ids and the last 4 characters. */
function describe(shop: ShopDoc | null) {
  const s = shop ?? {};
  const active = activeProviderOf({ paymentProvider: s.paymentProvider as Provider | undefined });
  const platform = !!platformRazorpayCreds();
  const rzp = !!(s.razorpayKeyId && s.razorpaySecretEnc);
  const pp = !!(s.phonepeClientId && s.phonepeClientVersion && s.phonepeSecretEnc);
  const pt = !!(s.paytmMid && s.paytmKeyEnc);
  const configured = { razorpay: rzp, phonepe: pp, paytm: pt };
  return {
    active, // the ONE gateway customers pay through
    source: configured[active] ? "shop" : active === "razorpay" && platform ? "platform" : "none",
    platformMode: platform ? razorpayMode(process.env.RAZORPAY_KEY_ID) : null,
    providers: {
      razorpay: { configured: rzp, id: rzp ? s.razorpayKeyId : "", hint: rzp ? s.razorpaySecretHint || "" : "", mode: rzp ? razorpayMode(s.razorpayKeyId) : null, extra: "" },
      phonepe: { configured: pp, id: pp ? s.phonepeClientId : "", hint: pp ? s.phonepeSecretHint || "" : "", mode: pp ? s.phonepeMode || "live" : null, extra: pp ? `Client version ${s.phonepeClientVersion}` : "" },
      paytm: { configured: pt, id: pt ? s.paytmMid : "", hint: pt ? s.paytmKeyHint || "" : "", mode: pt ? s.paytmMode || "live" : null, extra: pt ? `Website name ${s.paytmWebsite || defaultPaytmWebsite((s.paytmMode as GatewayMode) || "live")}` : "" },
    },
  };
}

async function load(shopId: string): Promise<ShopDoc | null> {
  return (await Shop.findOne({ shopId }).select(`name ${PAYMENT_FIELDS}`).lean()) as ShopDoc | null;
}

/** GET /api/shop/payments - which gateways are set up and which one is active. Never returns a secret. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  return NextResponse.json(describe(await load(session.shopId)));
}

const password = z.string().min(1, "Enter your password to confirm").max(100);
const mode = z.enum(["test", "live"], { message: "Choose Test or Live" });

const saveSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("razorpay"),
    keyId: z.string().trim().regex(/^rzp_(test|live)_[A-Za-z0-9]{6,40}$/, "Key ID looks like rzp_live_xxxxxxxx or rzp_test_xxxxxxxx"),
    keySecret: z.string().trim().min(10, "Enter the full Key Secret").max(100),
    password,
  }),
  z.object({
    provider: z.literal("phonepe"),
    clientId: z.string().trim().regex(/^[A-Za-z0-9_-]{6,80}$/, "Enter the full Client ID from PhonePe"),
    clientVersion: z.string().trim().regex(/^[A-Za-z0-9._-]{1,10}$/, "Client Version is usually a number like 1"),
    clientSecret: z.string().trim().min(10, "Enter the full Client Secret").max(200),
    mode,
    password,
  }),
  z.object({
    provider: z.literal("paytm"),
    mid: z.string().trim().regex(/^[A-Za-z0-9]{10,30}$/, "Enter the full Merchant ID (MID)"),
    merchantKey: z.string().trim().length(16, "The Paytm Merchant Key is exactly 16 characters"),
    website: z.string().trim().regex(/^[A-Za-z0-9_-]{2,30}$/, "Website name can only have letters, numbers, - and _").optional().or(z.literal("")),
    mode,
    password,
  }),
]);

const pickSchema = z.object({ provider: z.enum(["razorpay", "phonepe", "paytm"]), password });

/** Changing where the money goes needs the owner's password again, even though they are already logged in. */
async function confirmOwner(session: { userId: string; shopId: string }, pw: string) {
  const user = await User.findOne({ _id: session.userId, shopId: session.shopId });
  if (!user || !(await verifyPassword(pw, user.passwordHash))) return null;
  return user;
}

async function notifyOwner(
  user: { email: string; name: string },
  shopName: string,
  p: { provider: Provider; action: "added" | "changed" | "removed" | "switched"; detail?: string; activeNow?: Provider }
) {
  const when = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " (IST)";
  const mail = paymentSettingsChangedEmail({
    name: user.name,
    shopName,
    gateway: PROVIDER_LABEL[p.provider],
    action: p.action,
    detail: p.detail,
    activeNow: p.activeNow ? PROVIDER_LABEL[p.activeNow] : undefined,
    when,
  });
  // Best effort: a mail problem must never block or undo the change itself.
  await Promise.race([sendMail({ to: user.email, ...mail }).catch(() => false), new Promise((r) => setTimeout(r, 6000))]);
}

type Guard = { owner: NonNullable<Awaited<ReturnType<typeof confirmOwner>>>; shopId: string } | { response: NextResponse };

/** Owner-only + rate limit + password, shared by every change below. */
async function guard(req: NextRequest, pw: string | undefined, session: Awaited<ReturnType<typeof getSession>>): Promise<Guard> {
  if (!session || session.role !== "owner") {
    return { response: NextResponse.json({ error: "Only the shop owner can change payment settings" }, { status: 403 }) };
  }
  const { ok } = rateLimit(`pay-keys:${session.shopId}:${getClientIp(req)}`, 10, 10 * 60 * 1000);
  if (!ok) return { response: NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 }) };
  await connectDB();
  const owner = await confirmOwner(session, pw || "");
  if (!owner) return { response: NextResponse.json({ error: "Your password is wrong" }, { status: 400 }) };
  return { owner, shopId: session.shopId };
}

/**
 * PUT /api/shop/payments - the owner saves the keys of ONE gateway. They are checked with that gateway first, then stored
 * encrypted, and that gateway becomes the shop's active one (the others stay saved but stop being used).
 */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Only the shop owner can change payment settings" }, { status: 403 });
  }
  try {
    const parsed = saveSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid details" }, { status: 400 });
    }
    const d = parsed.data;

    const problem = encryptionKeyProblem();
    if (problem) return NextResponse.json({ error: problem }, { status: 503 });

    const g = await guard(req, d.password, session);
    if ("response" in g) return g.response;

    let check: { ok: true } | { ok: false; reason: string };
    let set: Record<string, string>;
    let detail: string;
    if (d.provider === "razorpay") {
      check = await checkRazorpayKeys(d.keyId, d.keySecret);
      set = { razorpayKeyId: d.keyId, razorpaySecretEnc: encryptSecret(d.keySecret), razorpaySecretHint: d.keySecret.slice(-4) };
      detail = d.keyId;
    } else if (d.provider === "phonepe") {
      check = await checkPhonePeKeys({ clientId: d.clientId, clientVersion: d.clientVersion, clientSecret: d.clientSecret, mode: d.mode });
      set = {
        phonepeClientId: d.clientId,
        phonepeClientVersion: d.clientVersion,
        phonepeSecretEnc: encryptSecret(d.clientSecret),
        phonepeSecretHint: d.clientSecret.slice(-4),
        phonepeMode: d.mode,
      };
      detail = d.clientId;
    } else {
      const website = d.website || defaultPaytmWebsite(d.mode);
      check = await checkPaytmKeys({ mid: d.mid, merchantKey: d.merchantKey, website, mode: d.mode });
      set = { paytmMid: d.mid, paytmKeyEnc: encryptSecret(d.merchantKey), paytmKeyHint: d.merchantKey.slice(-4), paytmWebsite: website, paytmMode: d.mode };
      detail = d.mid;
    }
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 });

    const before = describe(await load(g.shopId));
    const name = ((await load(g.shopId))?.name as string | undefined) || "your shop";
    await Shop.updateOne({ shopId: g.shopId }, { $set: { ...set, paymentProvider: d.provider } });
    await notifyOwner(g.owner, name, { provider: d.provider, action: before.providers[d.provider].configured ? "changed" : "added", detail, activeNow: d.provider });
    return NextResponse.json(describe(await load(g.shopId)));
  } catch (err) {
    return serverError(err, "Failed to save the payment keys");
  }
}

/** PATCH /api/shop/payments - switch the active gateway to one whose keys are already saved. */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  try {
    const parsed = pickSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request" }, { status: 400 });
    const { provider, password: pw } = parsed.data;

    const g = await guard(req, pw, session);
    if ("response" in g) return g.response;

    const now = describe(await load(g.shopId));
    if (!now.providers[provider].configured) {
      return NextResponse.json({ error: `Add your ${PROVIDER_LABEL[provider]} keys first.` }, { status: 400 });
    }
    if (now.active !== provider) {
      const name = ((await load(g.shopId))?.name as string | undefined) || "your shop";
      await Shop.updateOne({ shopId: g.shopId }, { $set: { paymentProvider: provider } });
      await notifyOwner(g.owner, name, { provider, action: "switched", detail: now.providers[provider].id || undefined, activeNow: provider });
    }
    return NextResponse.json(describe(await load(g.shopId)));
  } catch (err) {
    return serverError(err, "Failed to switch the payment gateway");
  }
}

/** DELETE /api/shop/payments - remove the saved keys of one gateway. If it was the active one, the shop falls back to the default (Razorpay). */
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  try {
    const parsed = pickSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request" }, { status: 400 });
    const { provider, password: pw } = parsed.data;

    const g = await guard(req, pw, session);
    if ("response" in g) return g.response;

    const before = await load(g.shopId);
    const was = describe(before);
    const unset: Record<string, ""> =
      provider === "razorpay"
        ? { razorpayKeyId: "", razorpaySecretEnc: "", razorpaySecretHint: "" }
        : provider === "phonepe"
          ? { phonepeClientId: "", phonepeClientVersion: "", phonepeSecretEnc: "", phonepeSecretHint: "", phonepeMode: "" }
          : { paytmMid: "", paytmKeyEnc: "", paytmKeyHint: "", paytmWebsite: "", paytmMode: "" };
    if (was.active === provider) unset.paymentProvider = "";
    await Shop.updateOne({ shopId: g.shopId }, { $unset: unset });
    await notifyOwner(g.owner, (before?.name as string | undefined) || "your shop", { provider, action: "removed", detail: was.providers[provider].id || undefined });
    return NextResponse.json(describe(await load(g.shopId)));
  } catch (err) {
    return serverError(err, "Failed to remove the payment keys");
  }
}
