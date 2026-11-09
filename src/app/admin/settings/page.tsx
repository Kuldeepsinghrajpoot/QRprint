"use client";

import PalettePicker from "@/components/PalettePicker";
import { useEffect, useState, useCallback } from "react";
import type { PricingConfigDTO } from "@/types/order";
import LineIcon from "@/components/lexical/LineIcon";
import AgentKeyBox from "@/components/AgentKeyBox";
import RazorpayCard from "@/components/RazorpayCard";
import TeamCard from "@/components/TeamCard";
import ChangePasswordCard from "@/components/ChangePasswordCard";
import { Alert, Button, Card, CardHeader, Switch, TextField } from "@/components/lexical/ui";

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

  useEffect(() => {
    fetch("/api/shop", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setShop(d);
        setSlugInput(d.slug || "");
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Shop */}
        <Card>
          <CardHeader icon={<LineIcon name="printer" size={24} />} title="Shop" subtitle="Shown on the customer page" />
          <div className="px-6 pb-6">
            <TextField label="Shop Name" value={config.shopName} onChange={(v) => setConfig({ ...config, shopName: v })} />
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

        {/* Print Agent connection */}
        <Card>
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

        {/* Online payments: the shop's own Razorpay keys */}
        <RazorpayCard />

        {/* Queue control */}
        <Card>
          <CardHeader icon={<LineIcon name="hour" size={24} />} title="Queue Control" subtitle="Lunch break or printer maintenance" />
          <div className="space-y-3 px-6 pb-6">
            <Switch
              checked={config.printingPaused}
              onChange={(v) => setConfig({ ...config, printingPaused: v })}
              title="⏸️ Pause printing"
              description="Blocks new orders and holds the queue until you resume"
            />
            <p className="text-xs text-slate-900/50">
              There&apos;s also a quick toggle for this right on the Live Queue page — no need to come here just to pause.
            </p>
          </div>
        </Card>
        <ChangePasswordCard />
      </div>

      <TeamCard />

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
