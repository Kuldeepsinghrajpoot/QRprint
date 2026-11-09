"use client";

import { useEffect, useState } from "react";
import LineIcon from "@/components/lexical/LineIcon";
import { Alert, Button, Card, CardHeader, Chip, TextField } from "@/components/lexical/ui";

type Status = { source: "shop" | "platform" | "none"; keyId: string; secretHint: string; mode: "live" | "test" | null };

/** Settings card: the shop's own Razorpay keys, so online payments go straight to the shop's Razorpay account. */
export default function RazorpayCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [editing, setEditing] = useState(false);
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [password, setPassword] = useState("");
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/shop/razorpay", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStatus(d))
      .catch(() => {});
  }, []);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/shop/razorpay", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId, keySecret, password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not save the keys");
      setStatus({ source: "shop", keyId: d.keyId, secretHint: d.secretHint, mode: d.mode });
      setEditing(false);
      setKeyId("");
      setKeySecret("");
      setPassword("");
      setMsg({ ok: true, text: "Saved. Online payments now go to your Razorpay account. We emailed you a confirmation." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not save the keys" });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/shop/razorpay", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not remove the keys. Try again.");
      const r = await fetch("/api/shop/razorpay", { cache: "no-store" });
      setStatus(await r.json());
      setRemoving(false);
      setPassword("");
      setMsg({ ok: true, text: "Your Razorpay keys were removed. We emailed you a confirmation." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not remove the keys. Try again." });
    } finally {
      setBusy(false);
    }
  }

  const own = status?.source === "shop";
  const form = editing || (status && status.source !== "shop");

  return (
    <Card>
      <CardHeader icon={<LineIcon name="wallet" size={24} />} title="Online payments (Razorpay)" subtitle="Add your own Razorpay keys so customer payments reach your account" />
      <div className="space-y-3 px-6 pb-6">
        {msg && (
          <Alert tone={msg.ok ? "success" : "error"} icon={msg.ok ? "✅" : "⚠️"}>
            {msg.text}
          </Alert>
        )}

        {own && !editing && status && (
          <div className="rounded-lg bg-slate-900/[0.05] px-3 py-2.5 text-[13px]">
            <div className="flex items-center gap-2">
              <b>Razorpay is connected</b>
              {status.mode && <Chip color={status.mode === "live" ? "success" : "warning"}>{status.mode === "live" ? "Live" : "Test mode"}</Chip>}
            </div>
            <div className="mt-1.5 text-slate-900/70">
              Key ID: <code>{status.keyId}</code>
              <br />
              Key Secret: <code>••••••••{status.secretHint}</code> (saved, it cannot be shown again)
            </div>
            {status.mode === "test" && <div className="mt-1.5 text-amber-700">Test mode: no real money moves. Switch to your Live keys to accept real payments.</div>}
          </div>
        )}

        {status && status.source === "platform" && !editing && (
          <p className="text-sm text-slate-900/60">No keys of your own yet, so payments currently use the platform account. Add your keys below to receive the money yourself.</p>
        )}
        {status && status.source === "none" && !editing && (
          <p className="text-sm text-slate-900/60">Online payment is not set up. Add your Razorpay keys below, or customers can only pay in cash.</p>
        )}

        {form && (
          <div className="space-y-4">
            <TextField label="Razorpay Key ID" value={keyId} onChange={setKeyId} helper="Starts with rzp_live_ or rzp_test_" />
            <TextField label="Razorpay Key Secret" type="password" value={keySecret} onChange={setKeySecret} helper="Shown only when you create the key in Razorpay" />
            <TextField label="Your password" type="password" value={password} onChange={setPassword} helper="Needed to change payment keys. We also email you when they change." />
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={busy || !keyId || !keySecret || !password}>
                {busy ? "Checking with Razorpay…" : "Save and check keys"}
              </Button>
              {editing && (
                <Button variant="light" onClick={() => { setEditing(false); setPassword(""); setMsg(null); }} disabled={busy}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}

        {own && !editing && !removing && (
          <div className="flex flex-wrap gap-2">
            <Button variant="light" onClick={() => { setEditing(true); setMsg(null); }} disabled={busy}>
              Change keys
            </Button>
            <Button variant="light" onClick={() => { setRemoving(true); setMsg(null); }} disabled={busy}>
              Remove keys
            </Button>
          </div>
        )}

        {own && removing && (
          <div className="space-y-4">
            <p className="text-sm text-slate-900/70">Online payment will stop working for your shop until you add keys again. Enter your password to confirm.</p>
            <TextField label="Your password" type="password" value={password} onChange={setPassword} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={remove} disabled={busy || !password}>
                {busy ? "Removing…" : "Remove keys"}
              </Button>
              <Button variant="light" onClick={() => { setRemoving(false); setPassword(""); setMsg(null); }} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-slate-900/50">
          Get the keys in your Razorpay Dashboard → Account &amp; Settings → API Keys → Generate Key. Your secret is stored encrypted and is never shown again.
        </p>
      </div>
    </Card>
  );
}
