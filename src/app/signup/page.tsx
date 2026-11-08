"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import FluentIcon from "@/components/lexical/FluentIcon";
import { Alert, Button, LEX_FONT, TextField, PAGE_BG } from "@/components/lexical/ui";
import AgentKeyBox from "@/components/AgentKeyBox";
import { shopUrlForSlug, slugify, validateSlug } from "@/lib/shopUrl";
import PoweredBy from "@/components/PoweredBy";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [agentKey, setAgentKey] = useState<string | null>(null);
  // Step 2: the 6-digit code emailed to the owner
  const [step, setStep] = useState<"form" | "code">("form");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [shopUrl, setShopUrl] = useState("");
  // Shop address (sub-address name): follows the shop name until the user edits it.
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugNote, setSlugNote] = useState<{ ok: boolean; text: string } | null>(null);
  const addressesOn = !!shopUrlForSlug("x");

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(shopName));
  }, [shopName, slugTouched]);

  useEffect(() => {
    if (!addressesOn || !slug) {
      setSlugNote(null);
      return;
    }
    const bad = validateSlug(slug);
    if (bad) {
      setSlugNote({ ok: false, text: bad });
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/shop/slug-check?slug=${encodeURIComponent(slug)}`);
        const d = await r.json();
        setSlugNote(d.available ? { ok: true, text: "Available ✓" } : { ok: false, text: d.reason || "Not available" });
      } catch {
        setSlugNote(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [slug, addressesOn]);

  // counts down the "Resend code" wait
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Step 1 (and "Resend code"): check the details and email a code. No account exists until the code is verified.
  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, shopName, email, password, slug: addressesOn ? slug : undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429 && data.retryAfter && step === "code") setCooldown(data.retryAfter);
        throw new Error(data.error || "Sign-up failed");
      }
      setStep("code");
      setCode("");
      setCooldown(data.resendIn || 60);
      setNotice(`We sent a 6-digit code to ${email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed");
    } finally {
      setLoading(false);
    }
  }

  // Step 2: the right code creates the account and signs the owner in.
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.expired) {
          setStep("form");
          setCode("");
        }
        throw new Error(data.error || "Verification failed");
      }
      setShopUrl(data.shopUrl || "");
      setAgentKey(data.agentKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-1" style={{ fontFamily: LEX_FONT, background: PAGE_BG }}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;800&display=swap"
        precedence="default"
      />

      {/* Brand panel */}
      <div
        className="relative hidden flex-1 flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{ background: "linear-gradient(135deg, var(--accent-dark) 0%, var(--accent) 55%, var(--accent-light) 100%)" }}
      >
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-white/[0.07]" />

        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-white/15 backdrop-blur">
            <FluentIcon name="printer" size={28} />
          </span>
          <span className="text-2xl font-extrabold tracking-tight">QRtoPrint</span>
        </div>

        <div className="relative">
          <FluentIcon name="printer" size={96} />
          <h2 className="mt-6 text-4xl font-extrabold leading-tight">
            Your own shop.
            <br />
            Your own printers.
          </h2>
          <p className="mt-3 max-w-md text-[15px]" style={{ color: "rgba(255,255,255,0.85)" }}>
            Every account is completely separate — your printers, orders, customers and prices are visible only to you.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {["Printers appear automatically from your Print Agent", "Your orders and customers stay private to your shop", "Your own QR code and pricing"].map(
              (t) => (
                <li key={t} className="flex items-center gap-3">
                  <FluentIcon name="check-mark-button" size={22} />
                  {t}
                </li>
              )
            )}
          </ul>
        </div>

        <div className="relative text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
          © QRtoPrint · <PoweredBy light className="inline" />
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center px-5 py-10 lg:w-[480px] lg:shrink-0 lg:bg-white">
        <div className="w-full max-w-sm">
          {agentKey ? (
            <>
              <h1 className="text-2xl font-bold text-slate-900/90">Your shop is ready 🎉</h1>
              <p className="mb-5 mt-1.5 text-sm text-slate-900/60">Connect the desktop Print Agent to this account.</p>
              {shopUrl && (
                <div className="mb-4 rounded-lg bg-slate-900/[0.05] px-3 py-2 text-[13px]">
                  <div className="text-xs text-slate-900/60">Your shop address (for your QR code)</div>
                  <b className="break-all">{shopUrl}</b>
                </div>
              )}
              <AgentKeyBox agentKey={agentKey} />
              <Button className="mt-6 w-full" onClick={() => { router.push("/admin"); router.refresh(); }}>
                Continue to dashboard
              </Button>
              <p className="mt-3 text-center text-xs text-slate-900/50">
                You can create a new key any time in Settings → Print Agent.
              </p>
            </>
          ) : step === "code" ? (
            <>
              <h1 className="text-2xl font-bold text-slate-900/90">Verify your email</h1>
              <p className="mb-7 mt-1.5 text-sm text-slate-900/60">Enter the 6-digit code we sent to confirm this is your email.</p>
              <form onSubmit={handleVerify} className="space-y-5">
                {error && (
                  <Alert tone="error" icon="⚠️">
                    {error}
                  </Alert>
                )}
                {notice && !error && <Alert tone="info" icon="✉️">{notice}</Alert>}
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  aria-label="6-digit verification code"
                  placeholder="000000"
                  className="w-full rounded-lg border border-slate-300 bg-white py-3 text-center text-3xl font-bold tracking-[0.5em] text-slate-900/90 outline-none focus:border-[color:var(--accent)]"
                />
                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full rounded-lg bg-[color:var(--accent)] py-2.5 text-[0.9375rem] font-medium text-white transition active:bg-[color:var(--accent-dark)] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                >
                  {loading ? "Verifying…" : "Verify and create account"}
                </button>
                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("form");
                      setError(null);
                      setNotice(null);
                    }}
                    className="font-medium text-slate-900/60 active:underline"
                  >
                    ← Change email
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    disabled={loading || cooldown > 0}
                    className="font-medium text-[color:var(--accent)] active:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                  >
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-slate-900/90">Create your shop account</h1>
              <p className="mb-7 mt-1.5 text-sm text-slate-900/60">Each account has its own printers and orders.</p>
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <Alert tone="error" icon="⚠️">
                    {error}
                  </Alert>
                )}
                <TextField label="Your name" required value={name} onChange={setName} />
                <TextField label="Shop name" required value={shopName} onChange={setShopName} />
                {addressesOn && (
                  <div>
                    <TextField
                      label="Shop address"
                      required
                      value={slug}
                      onChange={(v) => {
                        setSlugTouched(true);
                        setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                      }}
                      helper={slug ? shopUrlForSlug(slug).replace(/^https?:\/\//, "") : "Your customers will use this address"}
                    />
                    {slugNote && (
                      <p className={`mt-1 px-3.5 text-xs ${slugNote.ok ? "text-emerald-600" : "text-red-600"}`}>{slugNote.text}</p>
                    )}
                  </div>
                )}
                <TextField label="Email" type="email" required value={email} onChange={setEmail} />
                <TextField label="Password" type="password" required value={password} onChange={setPassword} helper="At least 8 characters" />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-[color:var(--accent)] py-2.5 text-[0.9375rem] font-medium text-white transition active:bg-[color:var(--accent-dark)] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                >
                  {loading ? "Sending code…" : "Continue"}
                </button>
                <p className="text-center text-sm text-slate-900/60">
                  Already have an account?{" "}
                  <Link href="/login" className="font-medium text-[color:var(--accent)] active:underline">
                    Sign in
                  </Link>
                </p>
              </form>
            </>
          )}
          <PoweredBy className="mt-8 lg:hidden" />
        </div>
      </div>
    </div>
  );
}
