"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { PricingConfigDTO, PaperSize, PrintType } from "@/types/order";
import LineIcon from "@/components/lexical/LineIcon";
import { isOffered, offeredTypes } from "@/lib/pricing";
import { Alert, Button, Card, CardHeader, CellInput, Chip, NumberField, Switch } from "@/components/lexical/ui";

const PAPER_SIZES: PaperSize[] = ["A4", "A3", "Legal", "Letter", "Photo"];
const PRINT_TYPES: PrintType[] = ["bw", "color"];

export default function PricingPage() {
  const paidBefore = useRef({ cash: true, online: true });
  const [config, setConfig] = useState<PricingConfigDTO | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freePrintingPassword, setFreePrintingPassword] = useState("");
  const [clearFreePrintingPassword, setClearFreePrintingPassword] = useState(false);
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

  function setOffered(size: PaperSize, type: PrintType, on: boolean) {
    if (!config) return;
    const current = Object.fromEntries(PAPER_SIZES.map((s) => [s, { bw: isOffered(config.availability, s, "bw"), color: isOffered(config.availability, s, "color") }])) as Record<PaperSize, Record<PrintType, boolean>>;
    current[size][type] = on;
    setConfig({ ...config, availability: current });
  }

  async function handleSave() {
    if (!config) return;
    if (freePrintingPassword && (freePrintingPassword.length < 8 || freePrintingPassword.length > 72)) {
      setError("Free printing passwords must be 8–72 characters.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          gstEnabled: false,
          onlineFeeEnabled: false,
          ...(freePrintingPassword ? { freePrintingPassword } : {}),
          ...(clearFreePrintingPassword ? { clearFreePrintingPassword: true } : {}),
        }), // GST and the online fee are no longer offered, so saving switches them off
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setConfig(data);
      setFreePrintingPassword("");
      setClearFreePrintingPassword(false);
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

      {offeredTypes(config.availability).length === 0 && !config.freePrinting && (
        <Alert tone="warning" icon="🚫">
          Nothing is ticked in the table below, so customers can&apos;t place orders. Tick the paper sizes and print types you can print.
        </Alert>
      )}

      {/* Tiered pricing table */}
      <Card>
        <CardHeader icon={<LineIcon name="files" size={24} />} title="Tiered Pricing (₹ per page)" subtitle="Tick what you can print. Unticked rows are hidden from customers" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-[#F8FAFC] text-left text-xs font-semibold uppercase tracking-wide text-slate-900/60">
                <th className="px-6 py-3">Offer</th>
                <th className="px-3 py-3">Paper Size</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Page 1</th>
                <th className="px-3 py-3">Page 2–10</th>
                <th className="px-3 py-3">Page 11+</th>
              </tr>
            </thead>
            <tbody>
              {PAPER_SIZES.map((size) =>
                PRINT_TYPES.map((type) => (
                  <tr key={`${size}-${type}`} className={`border-t border-slate-900/[0.07] transition ${isOffered(config.availability, size, type) ? "" : "opacity-50"}`}>
                    <td className="px-6 py-2.5">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-[color:var(--accent)]"
                        checked={isOffered(config.availability, size, type)}
                        onChange={(e) => setOffered(size, type, e.target.checked)}
                        aria-label={`Offer ${type === "bw" ? "black & white" : "colour"} printing on ${size}`}
                      />
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900/90">
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
            <CardHeader icon={<LineIcon name="wallet" size={24} />} title="Discounts & Extra Charges" subtitle="Duplex discount starts on page 2; page 1 stays full price" />
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
          <CardHeader icon={<LineIcon name="files" size={24} />} title="Payments" subtitle="Accepted payment methods" />
          <div className="space-y-3 px-6 pb-6">
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
              description="For colleges and offices: customers enter the shared password to send a free order."
            />
            {(config.freePrinting || config.freePrintingPasswordSet) && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <label htmlFor="free-printing-password" className="block text-sm font-semibold text-slate-900/90">
                  Free printing password
                </label>
                <input
                  id="free-printing-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
                  value={freePrintingPassword}
                  onChange={(e) => {
                    setFreePrintingPassword(e.target.value);
                    setClearFreePrintingPassword(false);
                  }}
                  placeholder={config.freePrintingPasswordSet ? "Enter a new password to change it" : "Set a password (8–72 characters)"}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20"
                />
                <p className="mt-2 text-xs text-slate-600">
                  {clearFreePrintingPassword
                    ? "The saved password will be removed when you save."
                    : config.freePrintingPasswordSet
                      ? "A password is saved. Leave this blank to keep it."
                      : "Set a password before saving free printing. Give it only to people allowed to print for free."}
                </p>
                {config.freePrintingPasswordSet && (
                  <button
                    type="button"
                    disabled={!!config.freePrinting}
                    onClick={() => {
                      setFreePrintingPassword("");
                      setClearFreePrintingPassword(true);
                    }}
                    className="mt-3 text-xs font-semibold text-red-700 underline underline-offset-2 disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                  >
                    Remove saved password
                  </button>
                )}
              </div>
            )}
            <Switch checked={!config.freePrinting && config.cashPaymentEnabled} onChange={(v) => setConfig({ ...config, cashPaymentEnabled: v })} title="Accept Cash payments" description={config.freePrinting ? "Off while free printing is on" : "Customer pays at the counter"} disabled={!!config.freePrinting} />
            <Switch checked={!config.freePrinting && config.onlinePaymentEnabled} onChange={(v) => setConfig({ ...config, onlinePaymentEnabled: v })} title="Accept Online (UPI/Card) payments" description={config.freePrinting ? "Off while free printing is on" : "Checkout through your active gateway (Razorpay, PhonePe or Paytm: Settings → Online payments)"} disabled={!!config.freePrinting} />
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
