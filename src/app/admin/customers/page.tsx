"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LineIcon from "@/components/lexical/LineIcon";
import { Avatar, Card, Chip, StatCard } from "@/components/lexical/ui";

interface CustomerRow {
  key: string;
  name: string;
  phone?: string;
  orders: number;
  spent: number;
  pages: number;
  firstOrderAt: string;
  lastOrderAt: string;
}

function ago(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export default function CustomersPage() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [rows, setRows] = useState<CustomerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/customers?q=${encodeURIComponent(debounced)}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Could not load customers");
        return d.customers as CustomerRow[];
      })
      .then((c) => {
        if (alive) {
          setRows(c);
          setError(null);
        }
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not load customers"));
    return () => {
      alive = false;
    };
  }, [debounced]);

  const list = rows ?? [];
  const regulars = list.filter((c) => c.orders >= 2).length;
  const top = list[0];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={<LineIcon name="users" size={24} />} label="Customers" value={String(list.length)} hint={debounced ? "Matching your search" : "Who has ordered from you"} />
        <StatCard icon={<LineIcon name="ok" size={24} />} label="Come back again" value={String(regulars)} hint={list.length ? `${Math.round((regulars / list.length) * 100)}% ordered 2+ times` : "Ordered 2+ times"} />
        <StatCard icon={<LineIcon name="wallet" size={24} />} label="Best customer" value={top ? `₹${top.spent}` : "—"} hint={top ? top.name : "No orders yet"} />
        <StatCard icon={<LineIcon name="list" size={24} />} label="Avg orders each" value={list.length ? (list.reduce((s, c) => s + c.orders, 0) / list.length).toFixed(1) : "—"} hint="Per customer" />
      </div>

      <Card>
        <div className="p-4 sm:p-6">
          <div className="relative max-w-sm">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
              <LineIcon name="search" size={16} className="text-slate-400" />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or phone…"
              aria-label="Search customers"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900/80 outline-none transition focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent)]"
            />
          </div>
        </div>

        {error && <div className="border-t border-slate-100 px-4 py-3 text-sm text-rose-700 sm:px-6">{error}</div>}

        {!error && rows === null && <div className="border-t border-slate-100 px-6 py-10 text-center text-sm text-slate-900/60">Loading customers…</div>}

        {rows && rows.length === 0 && !error && (
          <div className="border-t border-slate-100 px-6 py-12 text-center">
            <div className="text-base font-bold text-slate-900/90">{debounced ? "No customers match your search" : "No customers yet"}</div>
            <p className="mt-1 text-sm text-slate-900/60">{debounced ? "Try a different name or number." : "Customers show up here after their first order."}</p>
          </div>
        )}

        {rows && rows.length > 0 && (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {rows.map((c) => (
              <li key={c.key}>
                <Link
                  href={`/admin/orders?q=${encodeURIComponent(c.phone || c.name)}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition active:bg-slate-50 sm:px-6"
                >
                  <Avatar size={40}>{(c.name || "?").trim().charAt(0).toUpperCase()}</Avatar>
                  <div className="min-w-0 grow">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900/90">{c.name}</span>
                      {c.orders >= 5 ? <Chip color="success" small>Regular</Chip> : c.orders === 1 ? <Chip color="info" small>New</Chip> : null}
                    </div>
                    <div className="text-xs text-slate-900/60">
                      {c.phone || "No number given"} · last order {ago(c.lastOrderAt).toLowerCase()}
                    </div>
                  </div>
                  <div className="hidden text-right sm:block">
                    <div className="text-sm font-semibold tabular-nums text-slate-900/90">{c.orders}</div>
                    <div className="text-xs text-slate-900/50">{c.orders === 1 ? "order" : "orders"}</div>
                  </div>
                  <div className="hidden w-20 text-right sm:block">
                    <div className="text-sm font-semibold tabular-nums text-slate-900/90">{c.pages}</div>
                    <div className="text-xs text-slate-900/50">pages</div>
                  </div>
                  <div className="w-20 text-right">
                    <div className="text-sm font-bold tabular-nums text-slate-900/90">₹{c.spent}</div>
                    <div className="text-xs text-slate-900/50 sm:hidden">{c.orders} {c.orders === 1 ? "order" : "orders"}</div>
                    <div className="hidden text-xs text-slate-900/50 sm:block">spent</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {rows && rows.length >= 200 && <div className="border-t border-slate-100 px-6 py-3 text-center text-xs text-slate-900/50">Showing your top 200 customers.</div>}
      </Card>
    </div>
  );
}
