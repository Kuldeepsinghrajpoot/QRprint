"use client";

import { useState } from "react";
import LineIcon from "@/components/lexical/LineIcon";
import { Button, Card, CardHeader, TextField } from "@/components/lexical/ui";

/** Settings card: the logged-in user changes their own password. */
export default function ChangePasswordCard() {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    if (form.next !== form.confirm) return setMsg({ ok: false, text: "The two new passwords don't match" });
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not change the password");
      setForm({ current: "", next: "", confirm: "" });
      setMsg({ ok: true, text: "Password updated. Use the new one next time you log in." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not change the password" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader icon={<LineIcon name="gear" size={24} />} title="Change password" subtitle="For your own login" />
      <div className="space-y-3 px-6 pb-6">
        <TextField label="Current password" type="password" value={form.current} onChange={(v) => setForm({ ...form, current: v })} />
        <TextField label="New password" type="password" value={form.next} onChange={(v) => setForm({ ...form, next: v })} helper="At least 8 characters" />
        <TextField label="Confirm new password" type="password" value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} />
        {msg && <p className={`text-xs ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
        <Button variant="light" onClick={submit} disabled={busy || !form.current || !form.next || !form.confirm}>
          {busy ? "Updating…" : "Update password"}
        </Button>
      </div>
    </Card>
  );
}
