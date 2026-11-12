"use client";

import { useEffect, useState } from "react";
import PrintCounterCard from "@/components/PrintCounterCard";
import LineIcon from "@/components/lexical/LineIcon";
import { Alert, Button, Card, CardHeader, NumberField, SelectField, Switch, TextField } from "@/components/lexical/ui";
import { shopOpenStatus } from "@/lib/shopHours";

interface PrinterOpt {
  _id: string;
  name: string;
  type: "bw" | "color" | "both";
}

interface Controls {
  autoPrint: boolean;
  defaultColorPrinterId: string;
  defaultBwPrinterId: string;
  printingPaused: boolean;
  openingHoursEnabled: boolean;
  openTime: string;
  closeTime: string;
  openDays: number[];
  timezone: string;
  minOrderAmount: number;
  maxPagesPerOrder: number;
  maxActiveOrders: number;
  showWaitTime: boolean;
  customerNotice: string;
  cashAutoCancelMinutes: number;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ZONES = [
  ["Asia/Kolkata", "India (IST)"],
  ["Asia/Dubai", "Dubai (GST)"],
  ["Asia/Dhaka", "Bangladesh (BST)"],
  ["Asia/Kathmandu", "Nepal (NPT)"],
  ["Asia/Colombo", "Sri Lanka (IST)"],
  ["Asia/Karachi", "Pakistan (PKT)"],
  ["Asia/Singapore", "Singapore (SGT)"],
  ["Europe/London", "London (UK)"],
  ["America/New_York", "New York (ET)"],
];
const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900/80 outline-none transition focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent)]";

export default function ShopControlsPage() {
  const [c, setC] = useState<Controls | null>(null);
  const [saved, setSaved] = useState<Controls | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [printers, setPrinters] = useState<PrinterOpt[]>([]);

  useEffect(() => {
    fetch("/api/printers", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setPrinters(d))
      .catch(() => {});
    fetch("/api/settings/controls", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Controls) => {
        setC(d);
        setSaved(d);
      })
      .catch(() => setError("Could not load the settings. Please refresh."));
  }, []);

  if (!c) {
    return error ? (
      <Alert tone="error" icon="⚠️">
        {error}
      </Alert>
    ) : (
      <div className="flex items-center justify-center gap-3 py-24 text-sm text-slate-900/60">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--accent)] border-t-transparent" />
        Loading shop controls…
      </div>
    );
  }

  const set = <K extends keyof Controls>(key: K, value: Controls[K]) => {
    setC({ ...c, [key]: value });
    setDone(false);
  };
  const dirty = JSON.stringify(c) !== JSON.stringify(saved);
  const status = shopOpenStatus(c);

  function toggleDay(d: number) {
    const has = c!.openDays.includes(d);
    const next = has ? c!.openDays.filter((x) => x !== d) : [...c!.openDays, d].sort();
    set("openDays", next);
  }

  async function save() {
    if (!c) return;
    setSaving(true);
    setError(null);
    try {
      const { printingPaused: _paused, ...payload } = c; // pause has its own switch on the Live Queue
      void _paused;
      const res = await fetch("/api/settings/controls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not save");
      setC(data);
      setSaved(data);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert tone="error" icon="⚠️">
          {error}
        </Alert>
      )}
      {done && (
        <Alert tone="success" icon="✅">
          Saved. Customers see the new rules straight away.
        </Alert>
      )}

      <PrintCounterCard />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Printing */}
        <Card>
          <CardHeader icon={<LineIcon name="printer" size={24} />} title="Printing" subtitle="How paid orders reach your printer" />
          <div className="space-y-3 px-6 pb-6">
            <Switch
              checked={c.autoPrint}
              onChange={(v) => set("autoPrint", v)}
              title="Auto-print paid orders"
              description={
                c.autoPrint
                  ? "On: a paid order goes to the printer by itself, after the customer's 30-second cancel window."
                  : "Off: paid orders wait in the Live Queue until you press Print now."
              }
            />
            <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-900/10 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-900/90">Pause printing</div>
                <div className="text-xs text-slate-900/60">{c.printingPaused ? "Paused: new orders are blocked." : "Live: orders are being accepted."} Change it from the Live Queue.</div>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.printingPaused ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                {c.printingPaused ? "Paused" : "Live"}
              </span>
            </div>
            <div className="space-y-3 rounded-lg border border-slate-900/10 px-4 pb-4 pt-5">
              <div>
                <div className="text-sm font-semibold text-slate-900/90">Default printers</div>
                <div className="text-xs text-slate-900/60">Where an order goes when nobody picked a printer for it.</div>
              </div>
              <SelectField label="Colour jobs" value={c.defaultColorPrinterId || ""} onChange={(v) => set("defaultColorPrinterId", v)}>
                <option value="">Automatic (let the print agent choose)</option>
                {printers.filter((p) => p.type !== "bw").map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </SelectField>
              <SelectField label="Black & white jobs" value={c.defaultBwPrinterId || ""} onChange={(v) => set("defaultBwPrinterId", v)}>
                <option value="">Automatic (let the print agent choose)</option>
                {printers.filter((p) => p.type !== "color").map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </SelectField>
              {printers.length === 0 && <p className="text-xs text-slate-900/50">No printers yet. They appear here once the Print Agent has found them.</p>}
            </div>
            <p className="text-xs text-slate-900/60">
              Word and ZIP files always wait for you. Photo, A3, Legal and Letter orders only go to a default printer that is set up for that paper size; otherwise they wait for you to pick one.
            </p>
          </div>
        </Card>

      

        {/* Order rules */}
        <Card>
          <CardHeader icon={<LineIcon name="files" size={24} />} title="Order rules" subtitle="Keep tiny or huge orders from clogging the queue" />
          <div className="space-y-4 px-6 pb-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField label="Minimum order (₹)" value={c.minOrderAmount} onChange={(v) => set("minOrderAmount", v)} helper="0 means no minimum" />
              <NumberField label="Most pages in one order" value={c.maxPagesPerOrder} onChange={(v) => set("maxPagesPerOrder", Math.round(v))} helper="0 means no limit" />
              <NumberField label="Most orders waiting at once" value={c.maxActiveOrders} onChange={(v) => set("maxActiveOrders", Math.round(v))} helper="Waiting + printing. 0 means no limit" />
              <NumberField label="Cancel unpaid cash orders after (min)" value={c.cashAutoCancelMinutes} onChange={(v) => set("cashAutoCancelMinutes", Math.max(1, Math.round(v)))} helper="If the customer never pays at the counter" />
            </div>
            <Switch
              checked={c.showWaitTime !== false}
              onChange={(v) => set("showWaitTime", v)}
              title="Show wait time to customers"
              description={'Customers see "3 orders ahead, about 6 min" before they order and while they track their order.'}
            />
            <p className="text-sm text-slate-500">A valid mobile number is required for every customer order.</p>
          </div>
        </Card>

  {/* Opening hours */}
        <Card>
          <CardHeader
            icon={<LineIcon name="clock" size={24} />}
            title="Opening hours"
            subtitle={c.openingHoursEnabled ? (status.open ? "You are open now" : "You are closed now") : "Customers can order any time"}
          />
          <div className="space-y-4 px-6 pb-6">
            <Switch
              checked={c.openingHoursEnabled}
              onChange={(v) => set("openingHoursEnabled", v)}
              title="Only take orders during opening hours"
              description="Outside these hours the customer page says you are closed and blocks new orders."
            />
            {c.openingHoursEnabled && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs text-slate-900/60">
                    Opens
                    <input type="time" value={c.openTime} onChange={(e) => set("openTime", e.target.value)} className={`${field} mt-1`} />
                  </label>
                  <label className="block text-xs text-slate-900/60">
                    Closes
                    <input type="time" value={c.closeTime} onChange={(e) => set("closeTime", e.target.value)} className={`${field} mt-1`} />
                  </label>
                </div>
                <div>
                  <div className="mb-1.5 text-xs text-slate-900/60">Open on</div>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS.map((d, i) => {
                      const on = c.openDays.includes(i);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleDay(i)}
                          aria-pressed={on}
                          className={`rounded-md border px-3.5 py-1 text-[13px] font-medium transition ${
                            on ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-white" : "border-slate-300 text-slate-600 active:bg-slate-50"
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className="block text-xs text-slate-900/60">
                  Time zone
                  <select value={c.timezone} onChange={(e) => set("timezone", e.target.value)} className={`${field} mt-1`}>
                    {!ZONES.some(([z]) => z === c.timezone) && <option value={c.timezone}>{c.timezone}</option>}
                    {ZONES.map(([z, label]) => (
                      <option key={z} value={z}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-slate-900/60">If the closing time is earlier than the opening time, the shop closes after midnight.</p>
              </>
            )}
          </div>
        </Card>
        {/* Customer notice */}
        <Card>
          <CardHeader icon={<LineIcon name="list" size={24} />} title="Message to customers" subtitle="Shown at the top of the upload page" />
          <div className="space-y-3 px-6 pb-6">
            <TextField
              label="Notice"
              value={c.customerNotice}
              onChange={(v) => set("customerNotice", v.slice(0, 200))}
              helper={`${c.customerNotice.length}/200 · e.g. "A3 and photo prints are ready in 20 minutes."`}
            />
            {c.customerNotice && (
              <div className="rounded-lg border border-[color:var(--accent)]/25 px-3.5 py-2.5 text-[13px] text-slate-900/80" style={{ background: "rgb(var(--accent-rgb) / 0.07)" }}>
                {c.customerNotice}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="sticky bottom-4 z-20">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <span className="text-sm text-slate-900/60">{dirty ? "You have unsaved changes." : "All changes saved."}</span>
            <Button onClick={save} disabled={saving || !dirty}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
