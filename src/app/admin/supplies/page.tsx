"use client";

import { useCallback, useEffect, useState } from "react";
import LineIcon from "@/components/lexical/LineIcon";
import { Alert, Button, Card, NumberField } from "@/components/lexical/ui";

interface Supply {
  _id: string;
  name: string;
  type: "bw" | "color" | "both";
  yieldPages: number;
  refilledAt: string | null;
  usedPages: number;
  leftPages: number | null;
}

const TYPE_LABEL = { bw: "Black & white", color: "Colour", both: "B&W + colour" } as const;
const fmt = (n: number) => n.toLocaleString("en-IN");

function level(s: Supply): { label: string; badge: string; bar: string } | null {
  if (!s.yieldPages) return null;
  const left = s.leftPages ?? 0;
  if (left <= 0) return { label: "Empty: refill now", badge: "bg-rose-100 text-rose-700", bar: "bg-rose-500" };
  if (left / s.yieldPages <= 0.2) return { label: "Running low", badge: "bg-amber-100 text-amber-700", bar: "bg-amber-500" };
  return { label: "OK", badge: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" };
}

export default function SuppliesPage() {
  const [items, setItems] = useState<Supply[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [yields, setYields] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/supplies", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) throw new Error(data?.error || "Could not load supplies");
      setItems(data);
      setYields(Object.fromEntries(data.map((s: Supply) => [s._id, s.yieldPages])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load supplies");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load
    load();
  }, [load]);

  async function patch(id: string, body: object) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/supplies/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(null);
    }
  }

  if (!items) {
    return error ? (
      <Alert tone="error" icon="⚠️">
        {error}
      </Alert>
    ) : (
      <div className="flex items-center justify-center gap-3 py-24 text-sm text-slate-900/60">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--accent)] border-t-transparent" />
        Loading supplies…
      </div>
    );
  }

  const attention = items.filter((s) => {
    const l = level(s);
    return l && l.label !== "OK";
  });

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-900/60">
        Enter how many pages one cartridge or ink refill prints. We count the pages each printer prints from then on and warn you before it runs out.
      </p>

      {error && (
        <Alert tone="error" icon="⚠️">
          {error}
        </Alert>
      )}
      {attention.length > 0 && (
        <Alert tone="warning" icon="🧴">
          {attention.map((s) => s.name).join(", ")} {attention.length === 1 ? "needs" : "need"} a new cartridge or ink soon.
        </Alert>
      )}

      {items.length === 0 ? (
        <Card>
          <div className="px-6 py-14 text-center text-sm text-slate-900/60">No printers yet. They appear here once the Print Agent has found them.</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {items.map((s) => {
            const lv = level(s);
            const pct = s.yieldPages ? Math.min(100, Math.round((s.usedPages / s.yieldPages) * 100)) : 0;
            const dirty = (yields[s._id] ?? 0) !== s.yieldPages;
            return (
              <Card key={s._id}>
                <div className="space-y-4 p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ background: "rgb(var(--accent-rgb) / 0.08)" }}>
                        <LineIcon name="droplet" size={22} />
                      </div>
                      <div>
                        <div className="text-base font-bold text-slate-900/90">{s.name}</div>
                        <div className="text-xs text-slate-900/60">{TYPE_LABEL[s.type]}</div>
                      </div>
                    </div>
                    {lv ? (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${lv.badge}`}>{lv.label}</span>
                    ) : (
                      <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">Not tracked</span>
                    )}
                  </div>

                  {lv ? (
                    <div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${lv.bar}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-1.5 flex justify-between text-xs text-slate-900/60">
                        <span>
                          {fmt(s.usedPages)} of {fmt(s.yieldPages)} pages used
                        </span>
                        <span className="font-semibold text-slate-900/80">{fmt(s.leftPages ?? 0)} left</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-900/60">Set the cartridge size below to start counting.</p>
                  )}

                  <div className="text-xs text-slate-900/50">
                    {s.refilledAt ? `Last refilled ${new Date(s.refilledAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}` : "Counting from when the printer was added"}
                  </div>

                  <div className="flex flex-wrap items-end gap-3">
                    <div className="w-44">
                      <NumberField label="Cartridge size (pages)" value={yields[s._id] ?? 0} onChange={(v) => setYields({ ...yields, [s._id]: v })} />
                    </div>
                    <Button variant="light" size="sm" disabled={!dirty || busy === s._id} onClick={() => patch(s._id, { tonerYieldPages: Math.round(yields[s._id] ?? 0) })}>
                      Save size
                    </Button>
                    <Button
                      size="sm"
                      className="ml-auto"
                      disabled={busy === s._id}
                      onClick={() => window.confirm(`Mark ${s.name} as refilled? Its page count starts again from zero.`) && patch(s._id, { refilled: true })}
                    >
                      Mark refilled
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
