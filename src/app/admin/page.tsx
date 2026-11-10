"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { OrderDTO, PrinterDTO, PricingConfigDTO } from "@/types/order";
import LineIcon from "@/components/lexical/LineIcon";
import { CANCEL_WINDOW_MS } from "@/lib/orderTiming";
import { Alert, Avatar, Button, Card, Chip, StatCard, Switch, type Tone } from "@/components/lexical/ui";

const POLL_INTERVAL_MS = 3000;

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "queued", label: "Queued (reorder)" },
  { key: "printing", label: "Printing" },
  { key: "ready", label: "Ready" },
  { key: "collected", label: "Collected" },
  { key: "cancelled", label: "Cancelled" },
  { key: "failed", label: "Failed" },
];

const ALERT_KEY = "qrprint_new_order_alert";

function useCurrentTime(intervalMs: number) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    const initialUpdate = setTimeout(update, 0);
    const interval = setInterval(update, intervalMs);
    return () => {
      clearTimeout(initialUpdate);
      clearInterval(interval);
    };
  }, [intervalMs]);

  return now;
}

/** Two short rising tones (Web Audio, no sound file needed). Browsers allow it once the owner has clicked anywhere on the page. */
function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 1175].forEach((freq, i) => {
      const start = ctx.currentTime + i * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
    setTimeout(() => ctx.close(), 700);
  } catch {
    // audio blocked or unsupported: the banner and tab title still show the new order
  }
}

export default function AdminQueuePage() {
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [printers, setPrinters] = useState<PrinterDTO[]>([]);
  const [config, setConfig] = useState<PricingConfigDTO | null>(null);
  const [filter, setFilter] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [search, setSearch] = useState("");
  const [banner, setBanner] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [pauseToggling, setPauseToggling] = useState(false);
  const knownReadyIds = useRef<Set<string>>(new Set());
  const knownOrderIds = useRef<Set<string> | null>(null); // null until the first load, so old orders don't ring
  const alertEnabledRef = useRef(true);
  const unseenCount = useRef(0);
  const baseTitle = useRef("");

  const fetchOrders = useCallback(async () => {
    try {
      // Only today's orders (the browser's local day), so the queue starts fresh after midnight
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const res = await fetch(`/api/orders?date=${today}&tz=${d.getTimezoneOffset()}`, { cache: "no-store" });
      const data: OrderDTO[] = await res.json();
      if (Array.isArray(data)) setOrders(data);

      // New-order alert: anything we haven't seen before (the first load only records what is already there)
      if (Array.isArray(data)) {
        const known = knownOrderIds.current;
        if (known === null) {
          knownOrderIds.current = new Set(data.map((o) => o._id));
        } else {
          const fresh = data.filter((o) => !known.has(o._id));
          fresh.forEach((o) => known.add(o._id));
          if (fresh.length > 0 && alertEnabledRef.current) {
            beep();
            const first = fresh[0];
            setBanner(`New order: ${first.customerName} (#${first.token}) ₹${first.totalPrice}${fresh.length > 1 ? ` and ${fresh.length - 1} more` : ""}`);
            setTimeout(() => setBanner(null), 6000);
            if (document.hidden) {
              unseenCount.current += fresh.length;
              document.title = `(${unseenCount.current}) New order · ${baseTitle.current}`;
            }
          }
        }
      }
    } catch {
      // network hiccup — next poll will retry
    }
  }, []);

  const fetchPrinters = useCallback(async () => {
    try {
      const res = await fetch("/api/printers", { cache: "no-store" });
      setPrinters(await res.json());
    } catch {
      // ignore
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/pricing", { cache: "no-store" });
      setConfig(await res.json());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncing with an external polling API
    fetchOrders();
    fetchPrinters();
    fetchConfig();
    const interval = setInterval(() => {
      fetchOrders();
      fetchConfig();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchOrders, fetchPrinters, fetchConfig]);

  // remember the alert switch on this device
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a saved setting once after the page loads
      if (localStorage.getItem(ALERT_KEY) === "0") setAlertEnabled(false);
    } catch {
      // storage blocked: default stays on
    }
  }, []);
  useEffect(() => {
    alertEnabledRef.current = alertEnabled;
  }, [alertEnabled]);

  // put the tab title back when the owner returns to the tab
  useEffect(() => {
    baseTitle.current = document.title;
    const clear = () => {
      if (document.hidden) return;
      unseenCount.current = 0;
      document.title = baseTitle.current;
    };
    document.addEventListener("visibilitychange", clear);
    window.addEventListener("focus", clear);
    return () => {
      document.removeEventListener("visibilitychange", clear);
      window.removeEventListener("focus", clear);
      document.title = baseTitle.current;
    };
  }, []);

  function changeAlert(v: boolean) {
    setAlertEnabled(v);
    try {
      localStorage.setItem(ALERT_KEY, v ? "1" : "0");
    } catch {
      // ignore
    }
    if (v) beep(); // lets the owner hear what it sounds like (and unlocks audio)
  }

  function announce(name: string) {
    if (!voiceEnabled) return;
    if (!("speechSynthesis" in window)) return;
    const utter = new SpeechSynthesisUtterance(`${name}, aapka print ready hai`);
    utter.lang = "hi-IN";
    utter.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }

  async function updateOrder(
    id: string,
    patch: Partial<Pick<OrderDTO, "paymentStatus" | "printStatus">> & { printerId?: string; confirmPrinted?: boolean }
  ) {
    const { confirmPrinted: _confirm, ...shown } = patch; // confirmPrinted is only for the server
    void _confirm;
    setOrders((prev) => prev.map((o) => (o._id === id ? { ...o, ...shown } : o)));

    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      // The server said no (for example: collecting an order that has not printed). Undo the optimistic change and say why.
      const err = await res.json().catch(() => ({}));
      setBanner(`⚠️ ${typeof err.error === "string" ? err.error : "That change was not saved."}`);
      setTimeout(() => setBanner(null), 8000);
      fetchOrders();
      return;
    }
    const updated: OrderDTO = await res.json();

    if (patch.printStatus === "ready" && !knownReadyIds.current.has(id)) {
      knownReadyIds.current.add(id);
      setBanner(`✅ ${updated.customerName} (#${updated.token}) — Print Ready! Counter se collect karein.`);
      announce(updated.customerName);
      setTimeout(() => setBanner(null), 5000);
    }

    fetchOrders();
  }

  /** Shop cancels a print (queued / printing / failed). The server refunds online payments and deletes the file. */
  async function cancelOrder(id: string, reason: string) {
    const res = await fetch(`/api/orders/${id}/shop-cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      window.alert(typeof data.error === "string" ? data.error : "Could not cancel this print.");
    } else {
      const o: OrderDTO = data.order;
      const notes = [
        data.refundIssued ? "Online payment refunded." : "",
        data.cashToReturn ? `Return ₹${data.cashToReturn} cash to the customer.` : "",
        data.wasPrinting ? "It was already sent to the printer, so paper may still come out." : "",
      ].filter(Boolean);
      setBanner(`Cancelled ${o.customerName} (#${o.token}). ${notes.join(" ")}`.trim());
      setTimeout(() => setBanner(null), 6000);
      if (data.refundFailed) {
        window.alert(`The automatic refund for #${o.token} did not go through. Please refund ₹${o.totalPrice} from your payment dashboard.`);
      }
    }
    fetchOrders();
  }

  const [autoPrintBusy, setAutoPrintBusy] = useState(false);

  /** Auto-print on/off (any staff member). Off = paid orders wait for "Print now". */
  async function toggleAutoPrint() {
    if (!config) return;
    const next = config.autoPrint === false; // currently off -> turn on
    setAutoPrintBusy(true);
    try {
      const res = await fetch("/api/settings/controls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoPrint: next }),
      });
      if (res.ok) setConfig({ ...config, autoPrint: next });
    } finally {
      setAutoPrintBusy(false);
    }
  }

  async function approveAll() {
    const res = await fetch("/api/orders/approve-all", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setBanner(`Sent ${data.approved ?? 0} order${data.approved === 1 ? "" : "s"} to the printer.`);
      setTimeout(() => setBanner(null), 4000);
    }
    fetchOrders();
  }

  async function togglePause() {
    if (!config) return;
    setPauseToggling(true);
    try {
      const res = await fetch("/api/settings/pause", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ printingPaused: !config.printingPaused }),
      });
      setConfig(await res.json());
    } finally {
      setPauseToggling(false);
    }
  }

  // Reordering only makes sense for the "queued" view — sorted the same
  // way the Print Agent will actually pick them up (priority jobs first,
  // then by queuePosition). Dragging updates queuePosition for everyone
  // in this list; priority orders still print before non-priority ones
  // regardless of where they sit here, since that ordering rule is fixed.
  const queuedSorted = [...orders]
    .filter((o) => o.printStatus === "queued")
    .sort((a, b) => (b.priority === a.priority ? a.queuePosition - b.queuePosition : b.priority ? 1 : -1));

  function handleDrop(dropIndex: number) {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      return;
    }
    const reordered = [...queuedSorted];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    setDragIndex(null);

    const newPositionById = new Map(reordered.map((o, idx) => [o._id, idx]));
    setOrders((prev) =>
      prev.map((o) => (newPositionById.has(o._id) ? { ...o, queuePosition: newPositionById.get(o._id)! } : o))
    );

    fetch("/api/orders/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds: reordered.map((o) => o._id) }),
    }).catch(() => {});
  }

  const q = search.trim().toLowerCase();
  const matchesSearch = (o: OrderDTO) =>
    !q || o.customerName.toLowerCase().includes(q) || o.token.toLowerCase().includes(q) || (o.customerPhone ?? "").includes(q);
  // dragging to reorder only makes sense on the full queue, not on a search result
  const isReorderView = filter === "queued" && !q;
  const baseList = filter === "queued" ? queuedSorted : filter ? orders.filter((o) => o.printStatus === filter) : orders;
  const visibleOrders = baseList.filter(matchesSearch);

  const totalOrders = orders.length;
  const pendingCash = orders.filter((o) => o.paymentStatus === "pending").length;
  const readyCount = orders.filter((o) => o.printStatus === "ready").length;
  const autoPrintOff = config?.autoPrint === false;
  const waitingForOk = autoPrintOff
    ? orders.filter((o) => o.printStatus === "queued" && o.paymentStatus === "paid" && !o.approvedForPrint && !o.requiresManualPrint).length
    : 0;
  const needsPaperChange = orders.filter(
    (o) => o.paperSize !== "A4" && !o.printerId && o.printStatus === "queued" && o.paymentStatus !== "pending"
  );
  const todayRevenue = orders
    .filter((o) => o.paymentStatus === "paid" && new Date(o.createdAt).toDateString() === new Date().toDateString())
    .reduce((sum, o) => sum + o.totalPrice, 0);

  const countFor = (key: string) => (key ? orders.filter((o) => o.printStatus === key).length : orders.length);

  return (
    <div className="space-y-6">
      {config?.printingPaused && (
        <Alert tone="warning" icon="⏸️">
          <b>PRINTING PAUSED</b> — new orders are on hold and the Print Agent won&apos;t pick up queued jobs until you resume.
        </Alert>
      )}

      {banner && (
        <div
          className="banner-slide rounded-[10px] px-4 py-3.5 text-sm font-bold text-white"
          style={{ background: "linear-gradient(90deg, var(--accent) 0%, var(--accent-light) 100%)", boxShadow: "0 4px 12px rgb(var(--accent-light-rgb) / 0.35)" }}
        >
          {banner}
        </div>
      )}

      {needsPaperChange.length > 0 && (
        <Alert tone="warning" icon="📄">
          <b>
            {needsPaperChange.length} order{needsPaperChange.length > 1 ? "s" : ""} waiting on special paper
          </b>{" "}
          (Photo/A3/Legal) — load the right paper tray, then assign a printer below to release{" "}
          {needsPaperChange.length > 1 ? "them" : "it"} for printing.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={<LineIcon name="list" size={24} />} label="Total Orders" value={String(totalOrders)} hint={`${orders.filter((o) => o.printStatus === "queued").length} in queue`} />
        <StatCard icon={<LineIcon name="hour" size={24} />} label="Cash Pending" value={String(pendingCash)} hint={pendingCash ? "Waiting for payment" : "Nothing pending"} />
        <StatCard icon={<LineIcon name="ok" size={24} />} label="Ready" value={String(readyCount)} hint="Waiting for pickup" />
        <StatCard icon={<LineIcon name="wallet" size={24} />} label="Today's Revenue" value={`₹${todayRevenue}`} hint="Paid orders only" />
      </div>

      <Card>
        <div className="px-4 pt-4 sm:px-6 sm:pt-6">
          <div className="relative sm:max-w-sm">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
              <LineIcon name="search" size={16} className="text-slate-400" />
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone or token…"
              aria-label="Search the queue"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900/80 outline-none transition focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent)]"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-6">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3.5 py-1 text-[13px] font-medium whitespace-nowrap transition ${
                  filter === f.key
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-white"
                    : "border-slate-300 text-slate-600 active:bg-slate-50"
                }`}
              >
                {f.label}
                <span
                  className={`rounded-full px-1.5 text-[11px] ${filter === f.key ? "bg-white/25" : "bg-slate-900/[0.06]"}`}
                >
                  {countFor(f.key)}
                </span>
              </button>
            ))}
          </div>
          <div className="grid w-full grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Switch
              checked={alertEnabled}
              onChange={changeAlert}
              title="🔔 New-order alert"
              description="Beep when a new order arrives"
            />
            <Switch
              checked={voiceEnabled}
              onChange={setVoiceEnabled}
              title="🔊 Voice announcement"
              description="Hindi voice when an order is marked ready"
            />
            {config && (
              <div className="rounded-lg border border-slate-900/10 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900/90">⏯️ Printing</div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.printingPaused ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {config.printingPaused ? "Paused" : "Live"}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-slate-900/60">
                  {config.printingPaused ? "New orders are on hold." : config.autoPrint === false ? "New orders are being accepted." : "New orders print automatically."}
                </div>
                <Button
                  size="sm"
                  className="mt-2.5"
                  variant={config.printingPaused ? undefined : "light"}
                  tone={config.printingPaused ? "primary" : "warning"}
                  onClick={togglePause}
                  disabled={pauseToggling}
                >
                  {config.printingPaused ? "Resume Printing" : "Pause Printing"}
                </Button>
              </div>
            )}
            {config && (
              <div className="rounded-lg border border-slate-900/10 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900/90">🖨️ Auto-print</div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.autoPrint === false ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>
                    {config.autoPrint === false ? "Off" : "On"}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-slate-900/60">
                  {config.autoPrint === false ? "Paid orders wait until you press Print now." : "Paid orders go to the printer by themselves."}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {config.autoPrint === false && waitingForOk > 0 && (
                    <Button size="sm" onClick={approveAll}>
                      Print all waiting ({waitingForOk})
                    </Button>
                  )}
                  <Button size="sm" variant="light" tone={config.autoPrint === false ? "primary" : "secondary"} onClick={toggleAutoPrint} disabled={autoPrintBusy}>
                    {config.autoPrint === false ? "Turn auto-print on" : "Turn auto-print off"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {isReorderView && visibleOrders.length > 1 && (
        <Alert tone="info" icon="🖐️">
          Drag cards to reorder the print queue (e.g. move a VIP customer up). ⚡ Priority orders always print first
          regardless of position here.
        </Alert>
      )}

      <div className="space-y-4">
        {visibleOrders.length === 0 && (
          <Card>
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <LineIcon name="list" size={56} />
              <div className="mt-3 text-lg font-bold text-slate-900/90">No orders in this view yet</div>
              <p className="mt-1 text-sm text-slate-900/60">New orders will appear here automatically. Older orders are in Order History.</p>
            </div>
          </Card>
        )}

        {visibleOrders.map((o, index) => (
          <div
            key={o._id}
            draggable={isReorderView}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(index)}
            className={isReorderView ? "cursor-grab active:cursor-grabbing" : ""}
          >
            <OrderCard order={o} printers={printers} onUpdate={updateOrder} onAnnounce={announce} onCancel={cancelOrder} draggableHint={isReorderView} autoPrintOff={autoPrintOff} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** "SHOP-PC-01 (Kulde), FRONT-DESK-PC" — the computer(s) a printer is installed on. */
function computersLabel(p?: PrinterDTO): string {
  return (p?.hosts ?? [])
    .map((h) => (h.username ? `${h.hostname || "Unnamed computer"} (${h.username})` : h.hostname || "Unnamed computer"))
    .join(", ");
}

/** "🖨️ HP LaserJet · 💻 SHOP-PC-01 (Kulde)" — where an order is printing / printed (or assigned to). */
function orderWhere(order: OrderDTO, printers: PrinterDTO[]): string {
  if (order.printAgentId) {
    const host = printers.flatMap((p) => p.hosts ?? []).find((h) => h.agentId === order.printAgentId);
    const pc = host ? (host.username ? `${host.hostname} (${host.username})` : host.hostname) : "";
    return [order.printedOn && `🖨️ ${order.printedOn}`, pc && `💻 ${pc}`].filter(Boolean).join(" · ");
  }
  const assigned = printers.find((p) => p._id === order.printerId);
  const pcs = computersLabel(assigned);
  return assigned ? `🖨️ ${assigned.name}${pcs ? ` · 💻 ${pcs}` : ""}` : "";
}

/** "On hold" countdown: the customer can still cancel, so the order isn't sent to the printer yet. */
function HoldChip({ createdAt }: { createdAt: string }) {
  const now = useCurrentTime(1000);
  const left = now === null ? null : Math.ceil((new Date(createdAt).getTime() + CANCEL_WINDOW_MS - now) / 1000);
  if (left === null || left <= 0) return null;
  return <Chip color="info">On hold, customer can still cancel · prints in {left}s</Chip>;
}

function NotCollectedChip({ updatedAt }: { updatedAt: string }) {
  const now = useCurrentTime(60_000);
  if (now === null) return null;

  const age = now - new Date(updatedAt).getTime();
  if (age <= 15 * 60_000) return null;
  const minutes = Math.round(age / 60_000);
  return <Chip color="warning">Not collected for {minutes} min</Chip>;
}

function OrderCard({
  order,
  printers,
  onUpdate,
  onAnnounce,
  onCancel,
  draggableHint,
  autoPrintOff,
}: {
  order: OrderDTO;
  printers: PrinterDTO[];
  onUpdate: (
    id: string,
    patch: Partial<Pick<OrderDTO, "paymentStatus" | "printStatus" | "approvedForPrint">> & { printerId?: string; confirmPrinted?: boolean }
  ) => void;
  onAnnounce: (name: string) => void;
  onCancel: (id: string, reason: string) => Promise<void>;
  draggableHint?: boolean;
  autoPrintOff?: boolean;
}) {
  const needsPaperChange =
    order.paperSize !== "A4" && !order.printerId && order.printStatus === "queued" && order.paymentStatus !== "pending";

  const awaitingOk =
    autoPrintOff && order.printStatus === "queued" && order.paymentStatus === "paid" && !order.approvedForPrint && !order.requiresManualPrint;

  const avatarTone: Tone =
    order.printStatus === "ready" || order.printStatus === "collected"
      ? "success"
      : order.printStatus === "failed"
        ? "error"
        : order.printStatus === "cancelled"
          ? "secondary"
          : order.printStatus === "printing"
            ? "info"
            : "primary";

  const [confirming, setConfirming] = useState(false);
  // Skipping the printer (Mark Ready) and collecting an order that never printed both ask first: they can't be undone.
  const [confirmReady, setConfirmReady] = useState(false);
  const [confirmCollect, setConfirmCollect] = useState(false);
  const [reason, setReason] = useState("Customer asked");
  const [cancelling, setCancelling] = useState(false);
  const canCancel = ["queued", "printing", "failed"].includes(order.printStatus);
  const refundHint =
    order.paymentStatus === "paid"
      ? order.paymentMethod === "online"
        ? "The online payment will be refunded automatically."
        : order.paymentMethod === "free"
          ? "This was a free order. Nothing to refund."
          : `Return ₹${order.totalPrice} cash to the customer.`
      : "No payment has been taken yet.";
  const where = orderWhere(order, printers);
  const showReadyBtn = (order.printStatus === "queued" || order.printStatus === "printing") && order.paymentStatus !== "pending";
  const pill = "rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600";

  return (
    <div className={`overflow-hidden rounded-[10px] border bg-white ${needsPaperChange || order.priority ? "border-amber-300" : "border-slate-200"}`}>
      {/* who, when, how much */}
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <Avatar color={avatarTone}>{(order.customerName || "?").trim().charAt(0).toUpperCase()}</Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {draggableHint && <span className="text-slate-300">⠿</span>}
            <span className="text-base font-bold text-slate-900/90">{order.customerName}</span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[12px] font-semibold text-slate-600">#{order.token}</span>
            {order.priority && (
              <Chip color="warning" small>
                Priority
              </Chip>
            )}
          </div>
          <div className="mt-0.5 text-xs text-slate-900/50">{new Date(order.createdAt).toLocaleTimeString()}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-extrabold leading-tight text-slate-900/90">₹{order.totalPrice}</div>
          <div className="text-xs text-slate-900/50">
            {order.pages}×{order.copies} pages
          </div>
        </div>
      </div>

      {/* what to print + status */}
      <div className="flex flex-wrap gap-1.5 px-4 pb-4 sm:px-5">
        <span className={pill}>{order.printType === "bw" ? "B&W" : "Color"}</span>
        <span className={pill}>{order.paperSize}</span>
        {order.duplex && <span className={pill}>Duplex · {order.duplexEdge === "short" ? "short edge" : "long edge"}</span>}
        {(order.pagesPerSheet ?? 1) > 1 && <span className={pill}>{order.pagesPerSheet}-up</span>}
        {order.binding !== "none" && <span className={pill}>{order.binding}</span>}
        {order.paymentStatus === "pending" && <Chip color="warning">Cash Pending</Chip>}
        {order.paymentStatus === "paid" && <Chip color="success">Paid</Chip>}
        {order.paymentStatus === "refunded" && <Chip color="warning">Refunded</Chip>}
        {awaitingOk && <Chip color="warning">Waiting for your OK, auto-print is off</Chip>}
        {order.printStatus === "ready" && order.updatedAt && <NotCollectedChip updatedAt={order.updatedAt} />}
        {!awaitingOk && order.printStatus === "queued" && order.paymentStatus !== "pending" && <HoldChip createdAt={order.createdAt} />}
        {order.printStatus === "printing" && <Chip color="info">Printing…</Chip>}
        {order.printStatus === "ready" && <Chip color="success">Ready</Chip>}
        {order.printStatus === "collected" && <Chip color="secondary">Collected</Chip>}
        {order.printStatus === "cancelled" && (
          <Chip color="secondary">
            Cancelled by {order.cancelledBy === "shop" ? "shop" : "customer"}
            {order.cancelReason ? `: ${order.cancelReason}` : ""}
          </Chip>
        )}
        {order.printStatus === "failed" && <Chip color="error">Failed{order.printerError ? `: ${order.printerError}` : ""}</Chip>}
        {where && <Chip color="secondary">{where}</Chip>}
        {needsPaperChange && <Chip color="warning">Needs {order.paperSize} paper, won&apos;t auto-print</Chip>}
        {order.requiresManualPrint && order.printStatus === "queued" && (
          <Chip color="purple">Word/ZIP file: open &amp; print manually, then Mark Ready</Chip>
        )}
        {order.pageCountEstimated && <Chip color="warning">Page count estimated by customer, verify before printing</Chip>}
      </div>

      {order.printStatus === "failed" && (
        <div className="mx-4 mb-4 rounded-md border border-rose-200 bg-rose-50 p-3.5 sm:mx-5">
          <div className="text-[13px] font-semibold text-rose-700">Printing failed. Choose what to do.</div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => onUpdate(order._id, { printStatus: "queued" })}>
              Retry print
            </Button>
            {order.fileUrl && (
              <a
                href={order.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-md bg-slate-100 px-3 py-1 text-[13px] font-medium text-slate-700 transition active:bg-slate-200"
              >
                Open file &amp; print manually
              </a>
            )}
            <Button variant="light" tone="success" size="sm" onClick={() => onUpdate(order._id, { printStatus: "ready" })}>
              Printed manually, mark ready
            </Button>
            {printers.length > 0 && (
              <select
                defaultValue=""
                onChange={(e) => e.target.value && onUpdate(order._id, { printerId: e.target.value, printStatus: "queued" })}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-900/80 outline-none transition focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent)]"
              >
                <option value="">Retry on another printer…</option>
                {printers.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.status}){computersLabel(p) ? ` — ${computersLabel(p)}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
          {!order.fileUrl && <div className="mt-2 text-xs text-slate-900/60">The file is no longer available. Ask the customer to send it again.</div>}
        </div>
      )}

      {confirmReady && (
        <div className="mx-4 mb-4 rounded-md border border-amber-200 bg-amber-50 p-3.5 sm:mx-5">
          <div className="text-[13px] font-semibold text-amber-800">This order has not finished printing</div>
          <p className="mt-1 text-xs text-slate-900/70">
            {order.printStatus === "printing"
              ? "It is with the printer right now. Marking it ready tells the customer it is done, even if nothing came out."
              : "Marking it ready skips the printer, so it will NOT be printed. Choose this only if you printed it yourself."}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Button variant="light" tone="secondary" size="sm" onClick={() => setConfirmReady(false)}>
              {order.printStatus === "printing" ? "Wait for the printer" : "Keep it in the queue"}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setConfirmReady(false);
                onUpdate(order._id, { printStatus: "ready" });
              }}
            >
              I printed it myself, mark ready
            </Button>
          </div>
        </div>
      )}

      {confirmCollect && (
        <div className="mx-4 mb-4 rounded-md border border-amber-200 bg-amber-50 p-3.5 sm:mx-5">
          <div className="text-[13px] font-semibold text-amber-800">This order was marked ready by hand. Was it printed?</div>
          <p className="mt-1 text-xs text-slate-900/70">
            Collecting deletes the customer&apos;s file for good, so it can no longer be printed. If it never came out of the printer, print it again first.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setConfirmCollect(false);
                onUpdate(order._id, { printStatus: "queued" });
              }}
            >
              Not printed, print it now
            </Button>
            <Button
              variant="light"
              tone="secondary"
              size="sm"
              onClick={() => {
                setConfirmCollect(false);
                onUpdate(order._id, { printStatus: "collected", confirmPrinted: true });
              }}
            >
              Yes, printed. Mark collected
            </Button>
            <Button variant="light" tone="secondary" size="sm" onClick={() => setConfirmCollect(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {confirming && (
        <div className="mx-4 mb-4 rounded-md border border-rose-200 bg-rose-50 p-3.5 sm:mx-5">
          <div className="text-[13px] font-semibold text-rose-700">Cancel this print?</div>
          <p className="mt-1 text-xs text-slate-900/70">
            {order.printStatus === "printing" ? "It was already sent to the printer, so paper may still come out. " : ""}
            {refundHint} The customer is told and the file is deleted.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-label="Reason"
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-900/80 outline-none transition focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent)]"
            >
              <option>Customer asked</option>
              <option>Wrong or bad file</option>
              <option>Printer problem</option>
              <option>Other</option>
            </select>
            <Button
              size="sm"
              tone="error"
              disabled={cancelling}
              onClick={async () => {
                setCancelling(true);
                await onCancel(order._id, reason);
                setCancelling(false);
                setConfirming(false);
              }}
            >
              {cancelling ? "Cancelling…" : "Yes, cancel print"}
            </Button>
            <Button variant="light" tone="secondary" size="sm" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>
        </div>
      )}

      {/* actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
        {order.paymentStatus === "pending" && (
          <Button variant="light" tone="warning" size="sm" className="flex-1 sm:flex-none" onClick={() => onUpdate(order._id, { paymentStatus: "paid" })}>
            Cash Received
          </Button>
        )}
        {awaitingOk && (
          <Button size="sm" className="flex-1 sm:flex-none" onClick={() => onUpdate(order._id, { approvedForPrint: true })}>
            Print now
          </Button>
        )}
        {showReadyBtn && (
          <Button
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={() => (order.requiresManualPrint ? onUpdate(order._id, { printStatus: "ready" }) : setConfirmReady(true))}
          >
            {order.printStatus === "printing" ? "Mark Ready (manual)" : "Mark Ready"}
          </Button>
        )}
        {order.printStatus === "ready" && (
          <>
            <Button
              variant="light"
              tone="secondary"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() =>
                // marked ready by hand and never printed by the agent: collecting would delete the file for good
                order.readyBy === "staff" && !order.requiresManualPrint ? setConfirmCollect(true) : onUpdate(order._id, { printStatus: "collected" })
              }
            >
              Mark Collected
            </Button>
            {order.fileUrl && !order.requiresManualPrint && (
              <Button variant="light" tone="primary" size="sm" className="flex-1 sm:flex-none" onClick={() => onUpdate(order._id, { printStatus: "queued" })}>
                Print again
              </Button>
            )}
            <Button variant="light" tone="success" size="sm" className="flex-1 sm:flex-none" onClick={() => onAnnounce(order.customerName)}>
              Announce again
            </Button>
            {!order.fileUrl && !order.requiresManualPrint && (
              <span className="text-xs text-slate-900/50">The customer&apos;s file is already deleted, so it can&apos;t be printed again.</span>
            )}
          </>
        )}
        {canCancel && !confirming && (
          <Button variant="light" tone="error" size="sm" onClick={() => setConfirming(true)}>
            Cancel print
          </Button>
        )}
        {printers.length > 0 && order.printStatus === "queued" && (
          <select
            defaultValue=""
            onChange={(e) => e.target.value && onUpdate(order._id, { printerId: e.target.value })}
            aria-label="Assign printer"
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-900/80 outline-none transition focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent)]"
          >
            <option value="">Assign printer…</option>
            {printers.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} ({p.status}){computersLabel(p) ? ` — ${computersLabel(p)}` : ""}
              </option>
            ))}
          </select>
        )}
        <span className="ml-auto flex items-center gap-4 text-[13px] font-medium text-[color:var(--accent)]">
          {order.fileUrl && ["queued", "printing", "ready"].includes(order.printStatus) && (
            <a href={order.fileUrl} target="_blank" rel="noreferrer" className="active:underline">
              Open file
            </a>
          )}
          {order.printStatus !== "cancelled" && (
            <a href={`/api/orders/${order._id}/invoice`} target="_blank" rel="noreferrer" className="active:underline">
              Invoice
            </a>
          )}
        </span>
      </div>
    </div>
  );
}
