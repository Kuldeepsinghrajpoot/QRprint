"use client";

import { useEffect, useState } from "react";
import LineIcon from "@/components/lexical/LineIcon";
import { Alert, Button, Card, CardHeader, Chip, SelectField, TextField } from "@/components/lexical/ui";
import { PROVIDERS, PROVIDER_LABEL, type Provider } from "@/lib/payments/types";

type ProviderInfo = { configured: boolean; id: string; hint: string; mode: "live" | "test" | null; extra: string };
type Status = {
  active: Provider; // the ONE gateway customers pay through
  source: "shop" | "platform" | "none";
  providers: Record<Provider, ProviderInfo>;
};

type FieldDef = { key: string; label: string; secret?: boolean; optional?: boolean; helper?: string };

const FIELDS: Record<Provider, FieldDef[]> = {
  razorpay: [
    { key: "keyId", label: "Razorpay Key ID", helper: "Starts with rzp_live_ or rzp_test_" },
    { key: "keySecret", label: "Razorpay Key Secret", secret: true, helper: "Shown only when you create the key in Razorpay" },
  ],
  phonepe: [
    { key: "clientId", label: "PhonePe Client ID" },
    { key: "clientSecret", label: "PhonePe Client Secret", secret: true },
    { key: "clientVersion", label: "Client Version", helper: "Sent in your PhonePe credentials email. Test credentials use 1." },
  ],
  paytm: [
    { key: "mid", label: "Paytm Merchant ID (MID)" },
    { key: "merchantKey", label: "Paytm Merchant Key", secret: true, helper: "16 characters" },
    { key: "website", label: "Website name (optional)", optional: true, helper: "Leave empty to use Paytm's default: DEFAULT for live, WEBSTAGING for test" },
  ],
};

const HAS_MODE: Record<Provider, boolean> = { razorpay: false, phonepe: true, paytm: true }; // Razorpay's mode is part of the key itself

const WHERE: Record<Provider, string> = {
  razorpay: "Get the keys in your Razorpay Dashboard → Account & Settings → API Keys → Generate Key.",
  phonepe: "Get the credentials in your PhonePe Business dashboard → Developer Settings (the V2 credentials: Client ID, Client Secret, Client Version).",
  paytm: "Get the credentials in your Paytm dashboard → Developers → API Keys (Merchant ID and Merchant Key).",
};

type Action = "view" | "edit" | "activate" | "remove";

/** Settings card: the shop's payment gateway. Keys for several gateways can be saved, but customers pay through exactly ONE of them. */
export default function PaymentGatewayCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [picked, setPicked] = useState<Provider | null>(null);
  const [action, setAction] = useState<Action>("view");
  const [values, setValues] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"live" | "test">("live");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/shop/payments", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStatus(d))
      .catch(() => {});
  }, []);

  const selected: Provider = picked ?? status?.active ?? "razorpay";
  const label = PROVIDER_LABEL[selected];
  const info = status?.providers[selected];
  const isActive = status?.active === selected;
  const fields = FIELDS[selected];
  const showForm = !!status && (action === "edit" || (!info?.configured && action === "view"));
  const canSave = fields.every((f) => f.optional || (values[f.key] || "").trim()) && !!password;

  function reset() {
    setAction("view");
    setValues({});
    setPassword("");
  }

  function choose(p: Provider) {
    setPicked(p);
    reset();
    setMsg(null);
  }

  async function call(method: "PUT" | "PATCH" | "DELETE", body: Record<string, unknown>, okText: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/shop/payments", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Something went wrong. Try again.");
      setStatus(d);
      reset();
      setMsg({ ok: true, text: okText });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Something went wrong. Try again." });
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    call("PUT", { provider: selected, ...values, ...(HAS_MODE[selected] ? { mode } : {}), password }, `Saved. Customers now pay through ${label}. We emailed you a confirmation.`);
  const activate = () => call("PATCH", { provider: selected, password }, `Done. Customers now pay through ${label}. We emailed you a confirmation.`);
  const remove = () => call("DELETE", { provider: selected, password }, `Your ${label} keys were removed. We emailed you a confirmation.`);

  const passwordField = (helper?: string) => <TextField label="Your password" type="password" value={password} onChange={setPassword} helper={helper} />;

  return (
    <Card>
      <CardHeader
        icon={<LineIcon name="wallet" size={24} />}
        title="Online payments"
        subtitle="Customers pay through one gateway at a time, and the money goes straight to your account"
      />
      <div className="space-y-3 px-6 pb-6">
        {msg && (
          <Alert tone={msg.ok ? "success" : "error"} icon={msg.ok ? "✅" : "⚠️"}>
            {msg.text}
          </Alert>
        )}

        {/* Gateway picker: the chip shows which one customers pay through right now */}
        <div className="grid grid-cols-3 gap-2">
          {PROVIDERS.map((p) => {
            const on = p === selected;
            const saved = status?.providers[p].configured;
            const active = status?.active === p && (saved || status.source === "platform");
            return (
              <button
                key={p}
                type="button"
                onClick={() => choose(p)}
                disabled={busy}
                className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-[13px] font-semibold transition ${
                  on ? "border-[color:var(--accent)] bg-[color:var(--accent)]/[0.06] text-slate-900" : "border-slate-200 text-slate-900/70 hover:bg-slate-900/[0.03]"
                }`}
              >
                {PROVIDER_LABEL[p]}
                {active ? <Chip color="success" small>Active</Chip> : saved ? <Chip color="secondary" small>Keys saved</Chip> : <Chip color="secondary" small>Not set up</Chip>}
              </button>
            );
          })}
        </div>

        {info?.configured && action !== "edit" && (
          <div className="rounded-lg bg-slate-900/[0.05] px-3 py-2.5 text-[13px]">
            <div className="flex flex-wrap items-center gap-2">
              <b>{label} is connected</b>
              {info.mode && <Chip color={info.mode === "live" ? "success" : "warning"}>{info.mode === "live" ? "Live" : "Test mode"}</Chip>}
              {isActive ? <Chip color="success">Used for customer payments</Chip> : <Chip color="secondary">Not in use</Chip>}
            </div>
            <div className="mt-1.5 text-slate-900/70">
              ID: <code>{info.id}</code>
              {info.extra && <> · {info.extra}</>}
              <br />
              Secret: <code>••••••••{info.hint}</code> (saved, it cannot be shown again)
            </div>
            {info.mode === "test" && <div className="mt-1.5 text-amber-700">Test mode: no real money moves. Switch to your Live credentials to accept real payments.</div>}
            {!isActive && <div className="mt-1.5 text-slate-900/70">Customers are paying through {status ? PROVIDER_LABEL[status.active] : "another gateway"} right now. Switch below to use {label} instead.</div>}
          </div>
        )}

        {status && !info?.configured && action === "view" && selected === "razorpay" && status.active === "razorpay" && status.source === "platform" && (
          <p className="text-sm text-slate-900/60">No keys of your own yet, so payments currently use the platform account. Add your keys below to receive the money yourself.</p>
        )}
        {status && !info?.configured && action === "view" && status.source === "none" && isActive && (
          <p className="text-sm text-slate-900/60">Online payment is not set up. Add your {label} keys below, or customers can only pay in cash.</p>
        )}
        {status && !info?.configured && action === "view" && !isActive && (
          <p className="text-sm text-slate-900/60">Add your {label} keys below. Saving them makes {label} the gateway your customers pay through ({status ? PROVIDER_LABEL[status.active] : "the current one"} stops being used for new payments).</p>
        )}

        {showForm && (
          <div className="space-y-4">
            {fields.map((f) => (
              <TextField
                key={f.key}
                label={f.label}
                type={f.secret ? "password" : "text"}
                value={values[f.key] || ""}
                onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
                helper={f.helper}
              />
            ))}
            {HAS_MODE[selected] && (
              <SelectField label="Credentials are for" value={mode} onChange={(v) => setMode(v === "test" ? "test" : "live")}>
                <option value="live">Live (real money)</option>
                <option value="test">Test (sandbox, no real money)</option>
              </SelectField>
            )}
            {passwordField("Needed to change payment keys. We also email you when they change.")}
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={busy || !canSave}>
                {busy ? `Checking with ${label}…` : `Save and use ${label}`}
              </Button>
              {action === "edit" && (
                <Button variant="light" onClick={() => { reset(); setMsg(null); }} disabled={busy}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}

        {info?.configured && action === "view" && (
          <div className="flex flex-wrap gap-2">
            {!isActive && (
              <Button onClick={() => { setAction("activate"); setMsg(null); }} disabled={busy}>
                Use {label} for customer payments
              </Button>
            )}
            <Button variant="light" onClick={() => { setAction("edit"); setMsg(null); }} disabled={busy}>
              Change keys
            </Button>
            <Button variant="light" onClick={() => { setAction("remove"); setMsg(null); }} disabled={busy}>
              Remove keys
            </Button>
          </div>
        )}

        {info?.configured && action === "activate" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-900/70">
              New customer payments will go through {label}. {status ? PROVIDER_LABEL[status.active] : "The current gateway"} stops being used for new payments (payments already made can still be refunded). Enter your password to confirm.
            </p>
            {passwordField()}
            <div className="flex flex-wrap gap-2">
              <Button onClick={activate} disabled={busy || !password}>
                {busy ? "Switching…" : `Switch to ${label}`}
              </Button>
              <Button variant="light" onClick={() => { reset(); setMsg(null); }} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {info?.configured && action === "remove" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-900/70">
              {isActive ? `Online payment will stop working for your shop until you add keys again. ` : ""}
              Orders paid through {label} before can no longer be refunded automatically once its keys are removed. Enter your password to confirm.
            </p>
            {passwordField()}
            <div className="flex flex-wrap gap-2">
              <Button onClick={remove} disabled={busy || !password}>
                {busy ? "Removing…" : "Remove keys"}
              </Button>
              <Button variant="light" onClick={() => { reset(); setMsg(null); }} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-slate-900/50">{WHERE[selected]} Your secret is stored encrypted and is never shown again.</p>
      </div>
    </Card>
  );
}
