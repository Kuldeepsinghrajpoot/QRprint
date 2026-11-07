"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { PricingConfigDTO, PaperSize, PrintType } from "@/types/order";
import LineIcon from "@/components/lexical/LineIcon";
import { Alert, Button, Card, CardHeader, CellInput, Chip, NumberField, Switch } from "@/components/lexical/ui";

const PAPER_SIZES: PaperSize[] = ["A4", "A3", "Legal", "Letter", "Photo"];
const PRINT_TYPES: PrintType[] = ["bw", "color"];

export default function PricingPage() {
  const paidBefore = useRef({ cash: true, online: true });
  const [config, setConfig] = useState<PricingConfigDTO | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const res = await fetch("/api/settings/pricing", { cache: "no-store" });
    setConfig(await res.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load
    load();
  }, [load]);

  function updateRate(size: PaperSize, type: PrintType, field: "page1" | "page2to10" | "page11plus", value: number) {
    if (!config) return;
    setConfig({
      ...config,
      rates: {
        ...config.rates,
        [size]: {
          ...config.rates[size],
          [type]: { ...config.rates[size][type], [field]: value },
        },
      },
    });
  }

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
        Loading prices…
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
          Prices saved — the customer page is already using them.
        </Alert>
      )}

      {/* Tiered pricing table */}
      <Card>
        <CardHeader icon={<LineIcon name="files" size={24} />} title="Tiered Pricing (₹ per page)" subtitle="Price per page changes as the page count grows" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-[#F8FAFC] text-left text-xs font-semibold uppercase tracking-wide text-slate-900/60">
                <th className="px-6 py-3">Paper Size</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Page 1</th>
                <th className="px-3 py-3">Page 2–10</th>
                <th className="px-3 py-3">Page 11+</th>
              </tr>
            </thead>
            <tbody>
              {PAPER_SIZES.map((size) =>
                PRINT_TYPES.map((type) => (
                  <tr key={`${size}-${type}`} className="border-t border-slate-900/[0.07] transition">
                    <td className="px-6 py-2.5 font-semibold text-slate-900/90">
                      {type === "bw" ? (size === "Photo" ? "📷 Photo" : size) : ""}
                    </td>
                    <td className="px-3 py-2.5">
                      <Chip color={type === "bw" ? "secondary" : "primary"} small>
                        {type === "bw" ? "B&W" : "Color"}
                      </Chip>
                    </td>
                    {(["page1", "page2to10", "page11plus"] as const).map((field) => (
                      <td key={field} className="px-3 py-2.5">
                        <CellInput value={config.rates[size][type][field]} onChange={(v) => updateRate(size, type, field, v)} />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Extra charges */}
        <div>
          <Card className="h-full">
            <CardHeader icon={<LineIcon name="wallet" size={24} />} title="Discounts & Extra Charges" subtitle="Duplex, rush, binding and lamination" />
            <div className="grid grid-cols-1 gap-5 px-6 pb-6 sm:grid-cols-2">
              <NumberField label="Duplex discount (%)" value={config.duplexDiscountPercent} onChange={(v) => setConfig({ ...config, duplexDiscountPercent: v })} />
              <NumberField label="Priority / rush fee (%)" value={config.priorityFeePercent} onChange={(v) => setConfig({ ...config, priorityFeePercent: v })} />
              <NumberField label="Spiral binding charge (₹ flat)" value={config.bindingSpiralCharge} onChange={(v) => setConfig({ ...config, bindingSpiralCharge: v })} />
              <NumberField label="Lamination charge (₹ per page)" value={config.bindingLaminationCharge} onChange={(v) => setConfig({ ...config, bindingLaminationCharge: v })} />
            </div>
          </Card>
        </div>
        {/* GST & payments */}
        <Card>
          <CardHeader icon={<LineIcon name="files" size={24} />} title="GST & Payments" subtitle="Tax and accepted payment methods" />
          <div className="space-y-3 px-6 pb-6">
            <Switch checked={config.gstEnabled} onChange={(v) => setConfig({ ...config, gstEnabled: v })} title="Enable GST" description="Adds GST to every order total" />
            {config.gstEnabled && (
              <div className="max-w-[200px]">
                <NumberField label="GST %" value={config.gstPercent} onChange={(v) => setConfig({ ...config, gstPercent: v })} />
              </div>
            )}
            <Switch
              checked={!!config.freePrinting}
              onChange={(v) => {
                if (v) {
                  // Free printing and paid methods never run together: remember what was on, switch both off.
                  paidBefore.current = { cash: config.cashPaymentEnabled, online: config.onlinePaymentEnabled };
                  setConfig({ ...config, freePrinting: true, cashPaymentEnabled: false, onlinePaymentEnabled: false });
                } else {
                  // Turning it off brings the old payment choices back (cash + online if there was nothing before).
                  const b = paidBefore.current;
                  const both = !b.cash && !b.online;
                  setConfig({ ...config, freePrinting: false, cashPaymentEnabled: both || b.cash, onlinePaymentEnabled: both || b.online });
                }
              }}
              title="Free printing (no payment)"
              description="For colleges and offices: customers just upload and send. No payment step, no revenue."
            />
            <Switch checked={!config.freePrinting && config.cashPaymentEnabled} onChange={(v) => setConfig({ ...config, cashPaymentEnabled: v })} title="Accept Cash payments" description={config.freePrinting ? "Off while free printing is on" : "Customer pays at the counter"} disabled={!!config.freePrinting} />
            <Switch checked={!config.freePrinting && config.onlinePaymentEnabled} onChange={(v) => setConfig({ ...config, onlinePaymentEnabled: v })} title="Accept Online (UPI/Card) payments" description={config.freePrinting ? "Off while free printing is on" : "Razorpay checkout on the customer page"} disabled={!!config.freePrinting} />
            {!config.freePrinting && !config.cashPaymentEnabled && !config.onlinePaymentEnabled && (
              <Alert tone="warning" icon="🚫">
                Both payment methods are off, so customers can&apos;t place orders. Their page will say the shop isn&apos;t taking orders.
              </Alert>
            )}
          </div>
        </Card>

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
