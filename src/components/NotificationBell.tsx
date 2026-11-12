"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LineIcon from "@/components/lexical/LineIcon";
import { Chip } from "@/components/lexical/ui";
import type { OrderDTO } from "@/types/order";

const SEEN_KEY = "qrprint_bell_seen";
const POLL_MS = 30000;

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} h ago`;
}

const spec = (o: OrderDTO) => `${o.printType === "bw" ? "B&W" : "Color"} · ${o.paperSize} · ${o.pages}×${o.copies} pages`;

/** Bell in the top bar: orders that are waiting to be printed, with a badge for ones you haven't looked at yet. */
export default function NotificationBell() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState<number | null>(null); // null until read from storage
  const ref = useRef<HTMLDivElement>(null);

  // "Seen" time lives in this browser, so a fresh browser doesn't light up for old orders
  useEffect(() => {
    let t = Date.now();
    try {
      const saved = Number(localStorage.getItem(SEEN_KEY));
      if (saved > 0) t = saved;
      else localStorage.setItem(SEEN_KEY, String(t));
    } catch {
      /* storage blocked: the badge just resets on reload */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage after mount
    setSeenAt(t);
  }, []);

  const load = useCallback(async () => {
    try {
      const d = new Date();
      const res = await fetch(`/api/orders?date=${localToday()}&tz=${d.getTimezoneOffset()}`, { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data)) setOrders(data);
    } catch {
      /* next poll retries */
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- polling an external API
    load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [load]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Orders still to come out of the printer (waiting, or cash not yet paid), newest first
  const incoming = orders
    .filter((o) => o.printStatus === "queued")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const unseen = seenAt === null ? 0 : incoming.filter((o) => new Date(o.createdAt).getTime() > seenAt).length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) markSeen();
  }

  function markSeen() {
    const t = Date.now();
    setSeenAt(t);
    try {
      localStorage.setItem(SEEN_KEY, String(t));
    } catch {
      /* ignore */
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        aria-label={unseen > 0 ? `${unseen} new order${unseen > 1 ? "s" : ""}` : "Notifications"}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-900/[0.05] active:bg-slate-900/[0.08]"
      >
        <LineIcon name="bell" size={22} className="text-slate-600" />
        {unseen > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#F43F5E] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {unseen > 9 ? "9+" : unseen}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-[68px] z-40 overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.16)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+10px)] sm:w-[360px]">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="text-sm font-bold text-slate-900/90">Upcoming orders</div>
            <span className="text-xs text-slate-900/50">{incoming.length} waiting</span>
          </div>
          <div className="h-px bg-slate-900/10" />

          {incoming.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <LineIcon name="bell" size={32} className="mx-auto text-slate-300" />
              <div className="mt-2 text-sm font-semibold text-slate-900/80">No orders waiting</div>
              <div className="text-xs text-slate-900/50">New orders will show up here as soon as customers place them.</div>
            </div>
          ) : (
            <ul className="max-h-[360px] divide-y divide-slate-100 overflow-y-auto">
              {incoming.slice(0, 8).map((o) => (
                <li key={o._id}>
                  <button
                    onClick={() => {
                      setOpen(false);
                      router.push("/admin");
                    }}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition active:bg-slate-50"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-[color:var(--accent)]" style={{ background: "rgb(var(--accent-rgb) / 0.12)" }}>
                      {(o.customerName || "?").trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 grow">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900/90">{o.customerName}</span>
                        <span className="shrink-0 font-mono text-[11px] text-slate-900/50">#{o.token}</span>
                      </span>
                      <span className="block truncate text-xs text-slate-900/60">{spec(o)}</span>
                      <span className="mt-1 flex items-center gap-2">
                        {o.paymentStatus === "pending" ? <Chip color="warning" small>Cash pending</Chip> : <Chip color="success" small>Paid</Chip>}
                        <span className="text-[11px] text-slate-900/50">{ago(o.createdAt)}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900/90">₹{o.totalPrice}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="h-px bg-slate-900/10" />
          <button
            onClick={() => {
              setOpen(false);
              router.push("/admin");
            }}
            className="w-full px-4 py-3 text-center text-sm font-semibold text-[color:var(--accent)] transition active:bg-slate-50"
          >
            Open Live Queue
          </button>
        </div>
      )}
    </div>
  );
}
