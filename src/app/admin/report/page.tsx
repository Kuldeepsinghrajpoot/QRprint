"use client";

import { useEffect, useMemo, useState } from "react";
import type { OrderDTO } from "@/types/order";
import LineIcon from "@/components/lexical/LineIcon";
import { Button, Card, CardHeader, StatCard } from "@/components/lexical/ui";

const localISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseISO = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const formatISODate = (iso: string, options: Intl.DateTimeFormatOptions) => {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
};
const fmtDay = (iso: string) => formatISODate(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtShortDay = (iso: string) => formatISODate(iso, { weekday: "short", day: "numeric", month: "short" });
const hour12 = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
const field =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900/80 outline-none transition focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent)]";

/** One of the four tool cards above the report: a small icon + label, then its control. */
function ToolCard({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[color:var(--accent)]" style={{ background: "rgb(var(--accent-rgb) / 0.08)" }}>
            {icon}
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-900/50">{label}</div>
        </div>
        {children}
      </div>
    </Card>
  );
}

export default function DailyReportPage() {
  const [dates, setDates] = useState({ date: "", today: "" });
  const { date, today } = dates;
  const setDate = (nextDate: string) => setDates((current) => ({ ...current, date: nextDate }));
  const [orders, setOrders] = useState<OrderDTO[] | null>(null);
  const [shopName, setShopName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const currentToday = localISO(new Date());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initialize the browser-local day after hydration
    setDates({ date: currentToday, today: currentToday });
  }, []);

  useEffect(() => {
    fetch("/api/settings/pricing", { cache: "no-store" })
      .then((r) => r.json())
      .then((c) => setShopName(c.shopName || ""))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    if (!date) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the loading state while the new day loads
    setOrders(null);
    fetch(`/api/orders?date=${date}&tz=${new Date().getTimezoneOffset()}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || !Array.isArray(d)) throw new Error(d?.error || "Could not load the report");
        return d as OrderDTO[];
      })
      .then((d) => {
        if (alive) {
          setOrders(d);
          setError(null);
        }
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not load the report"));
    return () => {
      alive = false;
    };
  }, [date]);

  // counted cash is a per-browser convenience, remembered per day (empty if storage is blocked)
  const [counts, setCounts] = useState<Record<string, string>>({});
  useEffect(() => {
    const out: Record<string, string> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith("qrprint_cash_count_")) out[k.slice("qrprint_cash_count_".length)] = localStorage.getItem(k) ?? "";
      }
    } catch {
      /* storage unavailable */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore browser-only cash counts after hydration
    setCounts(out);
  }, []);
  const counted = counts[date] ?? "";

  function updateCounted(v: string) {
    const clean = v.replace(/[^0-9]/g, "").slice(0, 7);
    setCounts((c) => ({ ...c, [date]: clean }));
    try {
      if (clean) localStorage.setItem(`qrprint_cash_count_${date}`, clean);
      else localStorage.removeItem(`qrprint_cash_count_${date}`);
    } catch {
      /* the number just isn't remembered */
    }
  }

  const r = useMemo(() => {
    const all = orders ?? [];
    const live = all.filter((o) => o.printStatus !== "cancelled");
    const paid = all.filter((o) => o.paymentStatus === "paid");
    const sum = (a: OrderDTO[]) => a.reduce((s, o) => s + o.totalPrice, 0);
    const pagesOf = (o: OrderDTO) => o.pages * o.copies;
    const hours = Array<number>(24).fill(0);
    live.forEach((o) => (hours[new Date(o.createdAt).getHours()] += 1));
    const busiest = hours.reduce((best, n, h) => (n > hours[best] ? h : best), 0);
    const sizes = new Map<string, number>();
    live.forEach((o) => sizes.set(o.paperSize, (sizes.get(o.paperSize) ?? 0) + pagesOf(o)));
    const bw = live.filter((o) => o.printType === "bw");
    const color = live.filter((o) => o.printType === "color");
    return {
      orders: live.length,
      cancelled: all.length - live.length,
      revenue: sum(paid),
      cash: sum(paid.filter((o) => o.paymentMethod === "cash")),
      online: sum(paid.filter((o) => o.paymentMethod === "online")),
      refunded: sum(all.filter((o) => o.paymentStatus === "refunded")),
      cashPending: sum(live.filter((o) => o.paymentStatus === "pending")),
      pendingCount: live.filter((o) => o.paymentStatus === "pending").length,
      pages: live.reduce((s, o) => s + pagesOf(o), 0),
      bwPages: bw.reduce((s, o) => s + pagesOf(o), 0),
      colorPages: color.reduce((s, o) => s + pagesOf(o), 0),
      avg: paid.length ? Math.round(sum(paid) / paid.length) : 0,
      hours,
      busiest,
      sizes: [...sizes.entries()].sort((a, b) => b[1] - a[1]),
      byStatus: (["queued", "printing", "ready", "collected", "failed"] as const).map((s) => [s, live.filter((o) => o.printStatus === s).length] as const),
    };
  }, [orders]);

  function shift(days: number) {
    if (!date) return;
    const d = parseISO(date);
    d.setDate(d.getDate() + days);
    const next = localISO(d);
    if (next <= today) setDate(next);
  }

  async function copySummary() {
    const lines = [
      `${shopName || "Shop"} — ${fmtDay(date)}`,
      `Orders: ${r.orders}${r.cancelled ? ` (${r.cancelled} cancelled)` : ""}`,
      `Revenue: ₹${r.revenue} (cash ₹${r.cash}, online ₹${r.online})`,
      r.refunded ? `Refunded: ₹${r.refunded}` : "",
      r.cashPending ? `Cash still to collect: ₹${r.cashPending} (${r.pendingCount} orders)` : "",
      `Pages printed: ${r.pages} (B&W ${r.bwPages}, colour ${r.colorPages})`,
      r.orders ? `Busiest hour: ${hour12(r.busiest)}` : "",
      counted !== "" ? `Cash counted: ₹${counted} (${cashDiff === 0 ? "matches" : cashDiff! > 0 ? `₹${cashDiff} extra` : `₹${-cashDiff!} short`})` : "",
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Select the numbers and copy them by hand.");
    }
  }

  const cashDiff = counted === "" ? null : Number(counted) - r.cash;
  const maxHour = Math.max(1, ...r.hours);
  const first = r.hours.findIndex((n) => n > 0);
  const last = r.hours.length - 1 - [...r.hours].reverse().findIndex((n) => n > 0);
  const from = first < 0 ? 8 : Math.max(0, first - 1);
  const to = first < 0 ? 20 : Math.min(23, last + 1);

  return (
    <div className="space-y-6">
      {/* the sidebar and top bar don't belong on paper */}
      <style>{`@media print { header, aside, nav, footer, .no-print { display: none !important; } main { padding: 0 !important; } div.pt-16 { padding-top: 0 !important; } }`}</style>

      <div className="no-print grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <ToolCard icon={<LineIcon name="history" size={20} />} label="Pick a date">
          <div className="flex items-center gap-1.5">
            <Button variant="outlined" size="sm" onClick={() => shift(-1)} aria-label="Previous day">
              ‹
            </Button>
            <input type="date" value={date} max={today || undefined} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Report date" className={`${field} min-w-0 flex-1`} />
            <Button variant="outlined" size="sm" onClick={() => shift(1)} disabled={date >= today} aria-label="Next day">
              ›
            </Button>
          </div>
        </ToolCard>

        <ToolCard icon={<LineIcon name="clock" size={20} />} label="Today">
          <div className="flex items-center justify-between gap-2">
            <span className="whitespace-nowrap text-sm font-semibold text-slate-900/90">{today ? fmtShortDay(today) : "—"}</span>
            <Button variant="outlined" size="sm" className="shrink-0 whitespace-nowrap" onClick={() => setDate(today)} disabled={date === today}>
              {date === today ? "Showing today" : "Go to today"}
            </Button>
          </div>
        </ToolCard>

        <ToolCard icon={<LineIcon name="list" size={20} />} label="Copy summary">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs leading-snug text-slate-900/60">Short text to paste in WhatsApp</span>
            <Button variant="outlined" size="sm" className="shrink-0 whitespace-nowrap" onClick={copySummary} disabled={!orders}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </ToolCard>

        <ToolCard icon={<LineIcon name="files" size={20} />} label="Final report">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs leading-snug text-slate-900/60">Print or save as PDF</span>
            <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={() => window.print()} disabled={!orders}>
              Print
            </Button>
          </div>
        </ToolCard>
      </div>

      {/* title only on the printed copy, so the paper still says which shop and day it is */}
      <div className="hidden print:block">
        <h2 className="text-lg font-bold text-slate-900/90">{shopName ? `${shopName}: daily report` : "Daily report"}</h2>
        <p className="text-sm text-slate-900/60">{fmtDay(date)}</p>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {!orders && !error ? (
        <div className="py-16 text-center text-sm text-slate-900/60">Loading report…</div>
      ) : orders && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard icon={<LineIcon name="wallet" size={24} />} label="Revenue" value={`₹${r.revenue}`} hint={r.avg ? `₹${r.avg} per paid order` : "Paid orders only"} />
            <StatCard icon={<LineIcon name="list" size={24} />} label="Orders" value={String(r.orders)} hint={r.cancelled ? `${r.cancelled} cancelled` : "None cancelled"} />
            <StatCard icon={<LineIcon name="files" size={24} />} label="Pages printed" value={String(r.pages)} hint={`B&W ${r.bwPages} · Colour ${r.colorPages}`} />
            <StatCard icon={<LineIcon name="hour" size={24} />} label="Cash to collect" value={`₹${r.cashPending}`} hint={r.pendingCount ? `${r.pendingCount} unpaid order${r.pendingCount > 1 ? "s" : ""}` : "Nothing pending"} tone={r.cashPending ? "danger" : "default"} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader icon={<LineIcon name="wallet" size={24} />} title="Money" subtitle="Paid orders for the day" />
              <dl className="space-y-2.5 px-6 pb-6 text-sm tabular-nums">
                {[
                  ["Cash in the drawer", `₹${r.cash}`],
                  ["Online (UPI / card)", `₹${r.online}`],
                  ["Refunded (not counted above)", `₹${r.refunded}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <dt className="text-slate-900/60">{k}</dt>
                    <dd className="font-semibold text-slate-900/90">{v}</dd>
                  </div>
                ))}
                <div className="flex justify-between border-t border-dashed border-slate-300 pt-3 text-base">
                  <dt className="font-bold text-slate-900/90">Total revenue</dt>
                  <dd className="font-bold text-slate-900/90">₹{r.revenue}</dd>
                </div>
              </dl>
            </Card>

            <Card>
              <CardHeader icon={<LineIcon name="list" size={24} />} title="Orders by status" subtitle="Where today's orders ended up" />
              <div className="grid grid-cols-2 gap-3 px-6 pb-6 sm:grid-cols-3">
                {r.byStatus.map(([s, n]) => (
                  <div key={s} className="rounded-lg border border-slate-200 px-3 py-2.5">
                    <div className="text-xl font-extrabold tabular-nums text-slate-900/90">{n}</div>
                    <div className="text-xs capitalize text-slate-900/60">{s}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader icon={<LineIcon name="clock" size={24} />} title="Busy hours" subtitle={r.orders ? `Busiest around ${hour12(r.busiest)}` : "No orders yet"} />
              <div className="px-6 pb-6">
                <div className="flex h-28 items-end gap-1" role="img" aria-label="Orders per hour">
                  {r.hours.slice(from, to + 1).map((n, i) => (
                    <div key={i} className="flex h-full flex-1 flex-col items-center justify-end">
                      <div className="w-full rounded-t" style={{ height: `${Math.max(n ? 8 : 2, (n / maxHour) * 100)}%`, background: n ? "var(--accent)" : "#e2e8f0" }} title={`${hour12(from + i)}: ${n}`} />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-slate-900/50">
                  <span>{hour12(from)}</span>
                  <span>{hour12(to)}</span>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader icon={<LineIcon name="wallet" size={24} />} title="Cash check" subtitle="Count the drawer and compare" />
              <div className="space-y-3 px-6 pb-6 text-sm">
                <div className="flex justify-between tabular-nums">
                  <span className="text-slate-900/60">Cash the system expects</span>
                  <span className="font-semibold text-slate-900/90">₹{r.cash}</span>
                </div>
                <label className="no-print flex items-center justify-between gap-3">
                  <span className="text-slate-900/60">Cash you counted</span>
                  <span className="flex items-center gap-1">
                    <span className="text-slate-900/60">₹</span>
                    <input inputMode="numeric" value={counted} onChange={(e) => updateCounted(e.target.value)} placeholder="0" aria-label="Cash counted" disabled={!date} className={`${field} w-28 text-right tabular-nums`} />
                  </span>
                </label>
                {counted !== "" && (
                  <div className="hidden justify-between tabular-nums print:flex">
                    <span className="text-slate-900/60">Cash you counted</span>
                    <span className="font-semibold text-slate-900/90">₹{counted}</span>
                  </div>
                )}
                {cashDiff !== null && (
                  <div className={`rounded-lg px-3 py-2 font-semibold ${cashDiff === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                    {cashDiff === 0 ? "Matches: the drawer is correct" : cashDiff > 0 ? `₹${cashDiff} extra in the drawer` : `₹${-cashDiff} short in the drawer`}
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader icon={<LineIcon name="files" size={24} />} title="Paper used" subtitle="Pages by paper size" />
              <div className="space-y-3 px-6 pb-6">
                {r.sizes.length === 0 && <div className="text-sm text-slate-900/60">Nothing printed yet.</div>}
                {r.sizes.map(([size, pages]) => (
                  <div key={size}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-slate-900/80">{size}</span>
                      <span className="tabular-nums text-slate-900/60">{pages} pages</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full" style={{ width: `${(pages / Math.max(1, r.sizes[0][1])) * 100}%`, background: "var(--accent)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
