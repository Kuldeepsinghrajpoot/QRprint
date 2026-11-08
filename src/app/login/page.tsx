"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import FluentIcon from "@/components/lexical/FluentIcon";
import { Alert, LEX_FONT, TextField, PAGE_BG } from "@/components/lexical/ui";
import PoweredBy from "@/components/PoweredBy";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      const next = params.get("next");
      // Only allow same-site relative paths (blocks "//evil.com" style open redirects)
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
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
            Run your print shop
            <br />
            from one dashboard.
          </h2>
          <p className="mt-3 max-w-md text-[15px]" style={{ color: "rgba(255,255,255,0.85)" }}>
            Live queue, printers, pricing and analytics — everything your customers scan and pay for, in one place.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {["Orders arrive live, paid & ready to print", "Auto-route jobs to the right printer & paper", "Track revenue and peak hours"].map(
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
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-[10px]"
              style={{ background: "linear-gradient(135deg, var(--accent-dark) 0%, var(--accent) 60%, var(--accent-light) 100%)" }}
            >
              <FluentIcon name="printer" size={26} />
            </span>
            <span className="text-xl font-extrabold text-slate-900/90">QRtoPrint</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900/90">Welcome to QRtoPrint! 👋</h1>
          <p className="mb-7 mt-1.5 text-sm text-slate-900/60">Sign in to your shop dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert tone="error" icon="⚠️">
                {error}
              </Alert>
            )}
            <TextField label="Email" type="email" required value={email} onChange={setEmail} />
            <TextField label="Password" type="password" required value={password} onChange={setPassword} />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[color:var(--accent)] py-2.5 text-[0.9375rem] font-medium text-white transition active:bg-[color:var(--accent-dark)] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
            <p className="text-center text-sm text-slate-900/60">
              New shop?{" "}
              <Link href="/signup" className="font-medium text-[color:var(--accent)] active:underline">
                Create an account
              </Link>
            </p>
          </form>
          <PoweredBy className="mt-8 lg:hidden" />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
