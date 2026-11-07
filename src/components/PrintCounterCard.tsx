"use client";

import { useEffect, useState } from "react";
import LineIcon from "@/components/lexical/LineIcon";
import { Card, CardHeader } from "@/components/lexical/ui";

type Split = { bw: number; color: number; total: number };
type Period = "all" | "month" | "today";
interface Counts {
  pages: Record<Period, Split>;
  orders: Record<Period, Split>;
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "month", label: "This month" },
  { key: "today", label: "Today" },
];

/** Shop Controls card: how many pages the shop has printed, black & white vs colour. */
export default function PrintCounterCard() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [failed, setFailed] = useState(false);
  const [period, setPeriod] = useState<Period>("all");

  useEffect(() => {
    fetch("/api/stats/print-count", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setCounts)
      .catch(() => setFailed(true));
  }, []);

  const pages = counts?.pages[period];
  const orders = counts?.orders[period];
  const tiles: { label: string; key: keyof Split; dot: string }[] = [
    { label: "Black & white", key: "bw", dot: "bg-slate-700" },
    { label: "Colour", key: "color", dot: "bg-[color:var(--accent)]" },
    { label: "Total pages", key: "total", dot: "bg-emerald-500" },
  ];

  return (
    <Card>
      <CardHeader icon={<LineIcon name="bar" size={24} />} title="Print counter" subtitle="Pages your shop has printed (finished orders only)" />
      <div className="space-y-4 px-6 pb-6">
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                period === p.key ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-white" : "border-slate-300 text-slate-600 active:bg-slate-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {failed ? (
          <p className="text-sm text-slate-900/60">Could not load the print count. Please refresh.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {tiles.map((t) => (
              <div key={t.key} className="rounded-lg border border-slate-900/10 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-900/50">
                  <span className={`h-2 w-2 rounded-full ${t.dot}`} />
                  {t.label}
                </div>
                <div className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900/90">{pages ? pages[t.key].toLocaleString("en-IN") : "…"}</div>
                <div className="text-xs text-slate-900/60">
                  {orders ? `${orders[t.key].toLocaleString("en-IN")} ${orders[t.key] === 1 ? "order" : "orders"}` : " "}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
