"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { X } from "./Icon";
import { SITE } from "./site";

const inputCls =
  "mt-1 w-full rounded-xl border border-ink/20 bg-white px-4 py-3 font-normal outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30";

/** "Login" button that opens a popup. Signs in through the dashboard's real /api/auth/login, then opens /admin. */
export default function LoginModal() {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
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
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className="text-sm font-semibold hover:text-brand">
        Login
      </button>
      <dialog
        ref={ref}
        aria-labelledby="landing-login-title"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-md bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/60 backdrop:backdrop-blur-sm"
      >
        <div className="relative p-8">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full p-2 text-ink/60 hover:bg-mist hover:text-brand"
          >
            <X size={20} />
          </button>
          <Image src="/chhapo-logo.svg" alt="" width={44} height={44} />
          <h2 id="landing-login-title" className="mt-4 font-display text-2xl font-extrabold">
            Login to {SITE.name}
          </h2>
          <p className="mt-1 text-ink/70">Sign in to your shop dashboard.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            {error && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <label className="block text-sm font-semibold">
              Email
              <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </label>
            <label className="block text-sm font-semibold">
              Password
              <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-brand py-3 font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? "Signing in…" : "Login"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink/70">
            New shop?{" "}
            <Link href="/signup" className="font-semibold text-brand hover:underline">
              Start free
            </Link>
          </p>
        </div>
      </dialog>
    </>
  );
}
