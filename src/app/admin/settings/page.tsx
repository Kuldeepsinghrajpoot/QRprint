"use client";

import PalettePicker from "@/components/PalettePicker";
import { useEffect, useState, useCallback } from "react";
import type { PricingConfigDTO } from "@/types/order";
import LineIcon from "@/components/lexical/LineIcon";
import AgentKeyBox from "@/components/AgentKeyBox";
import PaymentGatewayCard from "@/components/PaymentGatewayCard";
import TeamCard from "@/components/TeamCard";
import ChangePasswordCard from "@/components/ChangePasswordCard";
import { Alert, Button, Card, CardHeader, TextField } from "@/components/lexical/ui";

export default function SettingsPage() {
  const [config, setConfig] = useState<PricingConfigDTO | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyHint, setKeyHint] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);
  const [shop, setShop] = useState<{ slug: string; url: string; subAddressesEnabled: boolean; urlTemplate: string } | null>(null);
  const [slugInput, setSlugInput] = useState("");
  const [slugMsg, setSlugMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [slugBusy, setSlugBusy] = useState(false);
  // Business details (required): shown on this shop's Terms, Privacy, Refund and Pricing pages.
  const [contact, setContact] = useState({ phone: "", email: "", address: "" });
  const [contactDone, setContactDone] = useState(false);
  const [contactMsg, setContactMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [contactBusy, setContactBusy] = useState(false);

  useEffect(() => {
    fetch("/api/shop", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setShop(d);
        setSlugInput(d.slug || "");
        setContact({ phone: d.contactPhone || "", email: d.contactEmail || d.suggestedEmail || "", address: d.contactAddress || "" });
        setContactDone(!!d.contactComplete);
      })
      .catch(() => {});
  }, []);

  async function saveSlug() {
    if (shop?.slug && shop.slug !== slugInput && !window.confirm("Change your shop address? Your already-printed QR codes will keep working, but new prints will use the new address.")) return;
    setSlugBusy(true);
    setSlugMsg(null);
    try {
      const res = await fetch("/api/shop", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: slugInput }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setShop((s) => (s ? { ...s, slug: data.slug, url: data.url } : s));
      setSlugMsg({ ok: true, text: "Saved. Download the new QR code from Shop QR Code." });
    } catch (e) {
      setSlugMsg({ ok: false, text: e instanceof Error ? e.message : "Could not save" });
    } finally {
      setSlugBusy(false);
    }
  }

  async function saveContact() {
    setContactBusy(true);
    setContactMsg(null);
    try {
      const res = await fetch("/api/shop/contact", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(contact) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setContact({ phone: data.contactPhone, email: data.contactEmail, address: data.contactAddress });
      setContactDone(true);
      setContactMsg({ ok: true, text: "Saved. Your policy pages now show these details." });
    } catch (e) {
      setContactMsg({ ok: false, text: e instanceof Error ? e.message : "Could not save" });
    } finally {
      setContactBusy(false);
    }
  }

  const contactReady = contact.phone.trim() !== "" && contact.email.trim() !== "" && contact.address.trim() !== "";

  useEffect(() => {
    fetch("/api/shop/agent-key", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setKeyHint(d.hasKey ? d.hint || "" : null))
      .catch(() => {});
  }, [newKey]);

  async function createAgentKey() {
    if (keyHint !== null && !window.confirm("Create a new key? The current key stops working, so you must paste the new one into the Print Agent on every PC.")) return;
    setKeyBusy(true);
    try {
      const res = await fetch("/api/shop/agent-key", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create key");
      setNewKey(data.agentKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create key");
    } finally {
      setKeyBusy(false);
    }
  }

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/pricing", { cache: "no-store" });
    setConfig(await res.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load
    load();
  }, [load]);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setConfig(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-sm text-slate-900/60">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--accent)] border-t-transparent" />
        Loading settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert tone="error" icon="⚠️">
          {error}
        </Alert>
      )}
      {saved && (
        <Alert tone="success" icon="✅">
          Settings saved.
        </Alert>
      )}

      <Card>
        <div className="p-4 sm:p-6">
          <PalettePicker />
        </div>
      </Card>

      {/* Shop and Print Agent: two separate cards side by side, same height */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="h-full">
          <CardHeader icon={<LineIcon name="printer" size={24} />} title="Shop" subtitle="Shown on the customer page" />
          <div className="px-6 pb-6">
            <TextField label="Shop Name" value={config.shopName} onChange={(v) => setConfig({ ...config, shopName: v })} />
          </div>
        </Card>

        <Card className="h-full">
          <CardHeader icon={<LineIcon name="printer" size={24} />} title="Print Agent" subtitle="Connect the desktop app to this account" />
          <div className="space-y-3 px-6 pb-6">
            {newKey ? (
              <AgentKeyBox agentKey={newKey} />
            ) : (
              <p className="text-sm text-slate-900/70">
                {keyHint === null
                  ? "No agent key yet. Create one, then paste it into the Print Agent on your shop PC."
                  : `An agent key is active (ends in …${keyHint}). For safety it can't be shown again — create a new one if you lost it.`}
              </p>
            )}
            <p className="text-sm text-slate-900/60">
              Need the app? <a href="/print-agent" target="_blank" rel="noopener noreferrer" className="font-medium text-[color:var(--accent)] underline">Install guide and download</a>
            </p>
            <Button variant="light" onClick={createAgentKey} disabled={keyBusy}>
              {keyBusy ? "Creating…" : keyHint === null ? "🔑 Create agent key" : "🔄 Create new key"}
            </Button>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Business details: required, so payment gateways and customers can see who runs the shop */}
        <Card>
          <div id="business" />
          <CardHeader icon={<LineIcon name="user" size={24} />} title="Business details" subtitle="Required. Shown on your Terms, Privacy, Refund and Pricing pages" />
          <div className="space-y-3 px-6 pb-6">
            {!contactDone && (
              <Alert tone="warning" icon="⚠️">
                Add your phone number, email and full address. Payment gateways (Razorpay, PhonePe, Paytm) ask for them on your website.
              </Alert>
            )}
            <TextField label="Business phone" required type="tel" value={contact.phone} onChange={(v) => setContact({ ...contact, phone: v })} placeholder=" " helper="Customers can call this number" />
            <TextField label="Business email" required type="email" value={contact.email} onChange={(v) => setContact({ ...contact, email: v })} placeholder=" " helper="Customers write here for refunds and questions" />
            <div>
              <label htmlFor="shop-address" className="mb-1 block px-1 text-xs text-slate-900/60">
                Full shop address *
              </label>
              <textarea
                id="shop-address"
                rows={3}
                required
                maxLength={300}
                value={contact.address}
                onChange={(e) => setContact({ ...contact, address: e.target.value })}
                placeholder="Shop number, street, area, city, state, PIN code"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-[13px] text-sm text-slate-900/90 outline-none transition focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent)]"
              />
            </div>
            {contactMsg && <p className={`text-xs ${contactMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{contactMsg.text}</p>}
            <Button variant="light" onClick={saveContact} disabled={contactBusy || !contactReady}>
              {contactBusy ? "Saving…" : "Save business details"}
            </Button>
            {contactDone && shop?.url && (
              <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-900/70">
                <p className="mb-1 font-semibold">Your policy pages (share these with the payment gateway):</p>
                <ul className="space-y-0.5">
                  {[["Terms & Conditions", "/terms"], ["Privacy Policy", "/privacy-policy"], ["Refund & Cancellation", "/refund-policy"], ["Pricing & Services", "/pricing"]].map(([label, path]) => (
                    <li key={path}>
                      {label}:{" "}
                      <a href={`${shop.url}${path}`} target="_blank" rel="noopener noreferrer" className="break-all text-[color:var(--accent)] underline">
                        {`${shop.url}${path}`.replace(/^https?:\/\//, "")}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>

        {/* Shop address */}
        {shop?.subAddressesEnabled && (
          <Card>
            <CardHeader icon={<LineIcon name="qr" size={24} />} title="Shop address" subtitle="The web address your customers open" />
            <div className="space-y-3 px-6 pb-6">
              <TextField
                label="Shop address"
                value={slugInput}
                onChange={(v) => setSlugInput(v.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                helper={slugInput ? shop.urlTemplate.replace("{slug}", slugInput).replace(/^https?:\/\//, "") : ""}
              />
              {slugMsg && <p className={`text-xs ${slugMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{slugMsg.text}</p>}
              <Button variant="light" onClick={saveSlug} disabled={slugBusy || !slugInput || slugInput === shop.slug}>
                {slugBusy ? "Saving…" : shop.slug ? "Change address" : "Set address"}
              </Button>
            </div>
          </Card>
        )}

        {/* Online payments: the shop's own gateway keys (Razorpay, PhonePe or Paytm - one active at a time) */}
        <PaymentGatewayCard />

        <TeamCard />
        <ChangePasswordCard />
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-4 z-20">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <span className="text-sm text-slate-900/60">Remember to save — changes go live for customers right after.</span>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "💾 Save Changes"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
