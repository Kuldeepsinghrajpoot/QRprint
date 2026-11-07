"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OrderDTO } from "@/types/order";
import LineIcon from "@/components/lexical/LineIcon";
import { Button, Card, Chip, StatCard, type ChipColor } from "@/components/lexical/ui";

type Summary = { orders: number; revenue: number; cash: number; online: number; refunded: number; cancelled: number };
type HistoryResponse = { orders: OrderDTO[]; total: number; page: number; pages: number; summary: Summary };

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom dates" },
];
const PRINT_STATUS = ["queued", "printing", "ready", "collected", "failed", "cancelled"];
const PAY_COLOR: Record<string, ChipColor> = { paid: "success", pending: "warning", refunded: "secondary" };
const PRINT_COLOR: Record<string, ChipColor> = {
  queued: "info",
  printing: "info",
  ready: "success",
  collected: "secondary",
  failed: "error",
  cancelled: "secondary",
};
const field =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900/80 outline-none transition focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent)]";

const spec = (o: OrderDTO) =>
  `${o.printType === "bw" ? "B&W" : "Color"} · ${o.paperSize} · ${o.pages}×${o.copies}${o.duplex ? " · Duplex" : ""}`;
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function OrderHistoryPage() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [range, setRange] = useState("7");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [method, setMethod] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  // Coming from the Customers page (?q=...): search that customer across all time
  useEffect(() => {
    const incoming = new URLSearchParams(window.location.search).get("q");
    if (incoming) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL on arrival
      setQ(incoming);
      setRange("all");
    }
  }, []);

  // wait until the user stops typing before searching
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const params = useCallback(() => {
    const p = new URLSearchParams({ range });
    if (debouncedQ.trim()) p.set("q", debouncedQ.trim());
    if (status) p.set("status", status);
    if (payment) p.set("payment", payment);
    if (method) p.set("method", method);
    if (range === "custom") {
      if (from) p.set("from", from);
      if (to) p.set("to", to);
    }
    return p;
  }, [range, debouncedQ, status, payment, method, from, to]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const p = params();
      p.set("page", String(page));
      const res = await fetch(`/api/orders/history?${p}`, { cache: "no-store" });
      const json = await res.json();
      if (id !== requestId.current) return; // a newer search already replaced this one
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not load orders");
      setData(json);
      setError(null);
    } catch (err) {
      if (id === requestId.current) setError(err instanceof Error ? err.message : "Could not load orders");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [params, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: loading data from the API when the filters change
    load();
  }, [load]);

  const change = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(1);
  };
  const s = data?.summary;
  const exportHref = `/api/orders/export?${params()}`;
  const anyFilter = !!(q || status || payment || method || range !== "7");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={<LineIcon name="list" size={24} />} label="Orders" value={String(s?.orders ?? 0)} hint={s?.cancelled ? `${s.cancelled} cancelled` : "In this view"} />
        <StatCard icon={<LineIcon name="wallet" size={24} />} label="Revenue" value={`₹${s?.revenue ?? 0}`} hint="Paid orders only" />
        <StatCard icon={<LineIcon name="wallet" size={24} />} label="Cash" value={`₹${s?.cash ?? 0}`} hint="Collected at the counter" />
        <StatCard icon={<LineIcon name="ok" size={24} />} label="Online" value={`₹${s?.online ?? 0}`} hint={s?.refunded ? `₹${s.refunded} refunded` : "UPI / card"} />
      </div>

      <Card>
        <div className="space-y-3 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <LineIcon name="search" size={16} className="text-slate-400" />
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, phone or token…"
                aria-label="Search orders"
                className={`${field} w-full pl-9`}
              />
            </div>
            <a
              href={exportHref}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-medium text-white transition active:brightness-95"
              style={{ background: "var(--accent)" }}
            >
              <LineIcon name="download" size={16} className="text-white" />
              Export CSV
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={range} onChange={(e) => change(setRange)(e.target.value)} aria-label="Date range" className={field}>
              {RANGES.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
            {range === "custom" && (
              <>
                <input type="date" value={from} max={to || undefined} onChange={(e) => change(setFrom)(e.target.value)} aria-label="From date" className={field} />
                <span className="text-sm text-slate-900/50">to</span>
                <input type="date" value={to} min={from || undefined} onChange={(e) => change(setTo)(e.target.value)} aria-label="To date" className={field} />
              </>
            )}
            <select value={status} onChange={(e) => change(setStatus)(e.target.value)} aria-label="Print status" className={field}>
              <option value="">All print statuses</option>
              {PRINT_STATUS.map((x) => (
                <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>
              ))}
            </select>
            <select value={payment} onChange={(e) => change(setPayment)(e.target.value)} aria-label="Payment status" className={field}>
              <option value="">Any payment</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="refunded">Refunded</option>
            </select>
            <select value={method} onChange={(e) => change(setMethod)(e.target.value)} aria-label="Payment method" className={field}>
              <option value="">Cash &amp; online</option>
              <option value="cash">Cash</option>
              <option value="online">Online</option>
            </select>
            {anyFilter && (
              <Button
                variant="text"
                tone="secondary"
                size="sm"
                onClick={() => {
                  setQ("");
                  setStatus("");
                  setPayment("");
                  setMethod("");
                  setRange("7");
                  setPage(1);
                }}
              >
                Reset filters
              </Button>
            )}
          </div>
        </div>

        {error && <div className="border-t border-slate-100 px-4 py-3 text-sm text-rose-700 sm:px-6">{error}</div>}

        {/* desktop table */}
        <div className={`hidden overflow-x-auto border-t border-slate-100 md:block ${loading ? "opacity-60" : ""}`}>
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-900/50">
              <tr>
                <th className="px-6 py-3 font-semibold">When</th>
                <th className="px-3 py-3 font-semibold">Order</th>
                <th className="px-3 py-3 font-semibold">Print</th>
                <th className="px-3 py-3 text-right font-semibold">Amount</th>
                <th className="px-3 py-3 font-semibold">Payment</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.orders.map((o) => (
                <tr key={o._id}>
                  <td className="whitespace-nowrap px-6 py-3 text-slate-900/70">{when(o.createdAt)}</td>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-slate-900/90">{o.customerName}</div>
                    <div className="text-xs text-slate-900/50">#{o.token}{o.customerPhone ? ` · ${o.customerPhone}` : ""}</div>
                  </td>
                  <td className="px-3 py-3 text-slate-900/70">{spec(o)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-900/90">₹{o.totalPrice}</td>
                  <td className="px-3 py-3">
                    <Chip color={PAY_COLOR[o.paymentStatus] ?? "secondary"} small>
                      {o.paymentStatus} · {o.paymentMethod}
                    </Chip>
                  </td>
                  <td className="px-3 py-3">
                    <Chip color={PRINT_COLOR[o.printStatus] ?? "secondary"} small>
                      {o.printStatus === "cancelled" ? `cancelled by ${o.cancelledBy ?? "customer"}` : o.printStatus}
                    </Chip>
                  </td>
                  <td className="whitespace-nowrap px-6 py-3 text-right">
                    {o.printStatus !== "cancelled" && (
                      <a href={`/api/orders/${o._id}/invoice`} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-[color:var(--accent)] active:underline">
                        Invoice
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* phone list */}
        <div className={`divide-y divide-slate-100 border-t border-slate-100 md:hidden ${loading ? "opacity-60" : ""}`}>
          {data?.orders.map((o) => (
            <div key={o._id} className="space-y-1.5 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900/90">{o.customerName} <span className="font-mono text-xs text-slate-900/50">#{o.token}</span></div>
                  <div className="text-xs text-slate-900/50">{when(o.createdAt)}{o.customerPhone ? ` · ${o.customerPhone}` : ""}</div>
                </div>
                <div className="font-extrabold text-slate-900/90">₹{o.totalPrice}</div>
              </div>
              <div className="text-xs text-slate-900/60">{spec(o)}</div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip color={PAY_COLOR[o.paymentStatus] ?? "secondary"} small>{o.paymentStatus} · {o.paymentMethod}</Chip>
                <Chip color={PRINT_COLOR[o.printStatus] ?? "secondary"} small>{o.printStatus}</Chip>
                {o.printStatus !== "cancelled" && (
                  <a href={`/api/orders/${o._id}/invoice`} target="_blank" rel="noreferrer" className="ml-auto text-[13px] font-medium text-[color:var(--accent)]">Invoice</a>
                )}
              </div>
            </div>
          ))}
        </div>

        {data && data.orders.length === 0 && !loading && (
          <div className="border-t border-slate-100 px-6 py-14 text-center">
            <div className="text-lg font-bold text-slate-900/90">No orders match these filters</div>
            <p className="mt-1 text-sm text-slate-900/60">Try a wider date range or clear the search.</p>
          </div>
        )}

        {data && data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-6">
            <span className="text-sm text-slate-900/60">
              Page {data.page} of {data.pages} · {data.total} order{data.total === 1 ? "" : "s"}
            </span>
            <div className="flex gap-2">
              <Button variant="light" tone="secondary" size="sm" disabled={data.page <= 1 || loading} onClick={() => setPage(data.page - 1)}>
                Previous
              </Button>
              <Button variant="light" tone="secondary" size="sm" disabled={data.page >= data.pages || loading} onClick={() => setPage(data.page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
