"use client";

import { useCallback, useEffect, useState } from "react";
import LineIcon from "@/components/lexical/LineIcon";
import { Alert, Button, Card, CardHeader, Chip, Dialog, TextField } from "@/components/lexical/ui";

interface Member {
  _id: string;
  name: string;
  email: string;
  role: "owner" | "staff";
  createdAt: string;
}

/** Settings card (owner only): add, remove and reset passwords for staff logins. */
export default function TeamCard() {
  const [members, setMembers] = useState<Member[]>([]);
  const [max, setMax] = useState(10);
  const [adding, setAdding] = useState(false);
  const [resetFor, setResetFor] = useState<Member | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/team", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setMembers(data.members);
        setMax(data.max);
      }
    } catch {
      // ignore: the card just stays empty
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: loading the team from the API
    load();
  }, [load]);

  const staffCount = members.filter((m) => m.role === "staff").length;

  async function call(url: string, init: RequestInit, done: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Something went wrong");
      setNotice(done);
      setTimeout(() => setNotice(null), 4000);
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    if (await call("/api/team", { method: "POST", body: JSON.stringify(form) }, `${form.name} can now log in.`)) {
      setForm({ name: "", email: "", password: "" });
      setAdding(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetFor) return;
    if (await call(`/api/team/${resetFor._id}`, { method: "PATCH", body: JSON.stringify({ password: newPassword }) }, `Password changed for ${resetFor.name}.`)) {
      setNewPassword("");
      setResetFor(null);
    }
  }

  async function remove(m: Member) {
    if (!window.confirm(`Remove ${m.name}? They will no longer be able to log in.`)) return;
    await call(`/api/team/${m._id}`, { method: "DELETE" }, `${m.name} was removed.`);
  }

  return (
    <Card>
      <CardHeader icon={<LineIcon name="users" size={24} />} title="Team" subtitle="Staff logins for your counter. Staff can run the queue but cannot open settings or mark refunds." />
      <div className="space-y-3 px-6 pb-6">
        {notice && <Alert tone="success" icon="✅">{notice}</Alert>}
        {error && !adding && !resetFor && <Alert tone="error" icon="⚠️">{error}</Alert>}

        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {members.map((m) => (
            <li key={m._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-semibold text-slate-900/90">
                  {m.name}
                  <Chip color={m.role === "owner" ? "primary" : "secondary"} small>{m.role}</Chip>
                </div>
                <div className="truncate text-xs text-slate-900/50">{m.email}</div>
              </div>
              {m.role === "staff" && (
                <div className="flex gap-2">
                  <Button variant="light" tone="secondary" size="sm" onClick={() => setResetFor(m)}>Reset password</Button>
                  <Button variant="light" tone="error" size="sm" disabled={busy} onClick={() => remove(m)}>Remove</Button>
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-900/50">{staffCount} of {max} staff logins used</span>
          <Button size="sm" disabled={staffCount >= max} onClick={() => { setError(null); setAdding(true); }}>
            Add staff login
          </Button>
        </div>
      </div>

      <Dialog open={adding} onClose={() => setAdding(false)}>
        <form onSubmit={addStaff} className="space-y-4 p-6">
          <h3 className="text-lg font-bold text-slate-900/90">Add staff login</h3>
          {error && <Alert tone="error" icon="⚠️">{error}</Alert>}
          <TextField label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <TextField label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required helper="They log in with this email" />
          <TextField label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required helper="At least 8 characters" />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="light" tone="secondary" onClick={() => setAdding(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Adding…" : "Add"}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!resetFor} onClose={() => setResetFor(null)}>
        <form onSubmit={resetPassword} className="space-y-4 p-6">
          <h3 className="text-lg font-bold text-slate-900/90">New password for {resetFor?.name}</h3>
          {error && <Alert tone="error" icon="⚠️">{error}</Alert>}
          <TextField label="New password" type="password" value={newPassword} onChange={setNewPassword} required helper="At least 8 characters" />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="light" tone="secondary" onClick={() => setResetFor(null)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Change password"}</Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}
