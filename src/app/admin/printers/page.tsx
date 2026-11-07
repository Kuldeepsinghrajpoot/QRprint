"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import type { PrinterDTO, PrinterHostDTO, AgentDTO, PaperSize } from "@/types/order";
import LineIcon from "@/components/lexical/LineIcon";
import { Card, CardHeader, Chip, Dialog, Field, SelectField, StatCard, TextField, Button, type ChipColor } from "@/components/lexical/ui";

const ALL_PAPER_SIZES: PaperSize[] = ["A4", "A3", "Legal", "Letter", "Photo"];

const STATUS: Record<PrinterDTO["status"], { label: string; color: ChipColor }> = {
  online: { label: "Online", color: "success" },
  offline: { label: "Offline", color: "secondary" },
  paper_jam: { label: "Paper Jam", color: "error" },
  low_ink: { label: "Low Ink", color: "warning" },
  out_of_paper: { label: "Out of Paper", color: "warning" },
};

const TYPE_LABEL: Record<PrinterDTO["type"], string> = {
  both: "B&W + Color",
  bw: "B&W only",
  color: "Color only",
};

const isAttention = (s: PrinterDTO["status"]) => s === "paper_jam" || s === "low_ink" || s === "out_of_paper";

/** "USB001 (USB) · 192.168.1.20:9100" — the port a printer is connected through on one computer. */
function portLabel(h: PrinterHostDTO): string {
  const parts: string[] = [];
  if (h.port) parts.push(h.portType && h.portType !== "Other" ? `${h.port} (${h.portType})` : h.port);
  else if (h.portType) parts.push(h.portType);
  if (h.ipAddress) parts.push(h.tcpPort ? `${h.ipAddress}:${h.tcpPort}` : h.ipAddress);
  else if (h.tcpPort) parts.push(`port ${h.tcpPort}`);
  return parts.join(" · ") || "—";
}

const computerModel = (c: { manufacturer?: string; model?: string }) =>
  [c.manufacturer, c.model].filter(Boolean).join(" ") || "Model unknown";

type Filter = "All" | "Online" | "Offline" | "Needs Attention";
const FILTERS: Filter[] = ["All", "Online", "Offline", "Needs Attention"];

export default function PrintersPage() {
  const [printers, setPrinters] = useState<PrinterDTO[]>([]);
  const [agents, setAgents] = useState<AgentDTO[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"bw" | "color" | "both">("both");
  const [systemPrinterName, setSystemPrinterName] = useState("");
  const [paperSizes, setPaperSizes] = useState<PaperSize[]>(["A4", "Legal", "Letter"]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");
  const [toRemove, setToRemove] = useState<PrinterDTO | null>(null);

  const load = useCallback(async () => {
    const [res, agentsRes] = await Promise.all([
      fetch("/api/printers", { cache: "no-store" }),
      fetch("/api/agents", { cache: "no-store" }),
    ]);
    setPrinters(await res.json());
    if (agentsRes.ok) setAgents(await agentsRes.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  // Esc closes whichever dialog is open
  useEffect(() => {
    if (!showForm && !toRemove) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowForm(false);
        setToRemove(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showForm, toRemove]);

  function togglePaperSize(size: PaperSize) {
    setPaperSizes((prev) => (prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (paperSizes.length === 0) {
      setError("Select at least one paper size this printer is loaded with.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/printers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, systemPrinterName, supportedPaperSizes: paperSizes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add printer");
      setName("");
      setSystemPrinterName("");
      setType("both");
      setPaperSizes(["A4", "Legal", "Letter"]);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add printer");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!toRemove) return;
    const id = toRemove._id;
    setToRemove(null);
    await fetch(`/api/printers/${id}`, { method: "DELETE" });
    load();
  }

  function openForm() {
    setError(null);
    setShowForm(true);
  }

  const hasPhotoPrinter = printers.some((p) => p.supportedPaperSizes?.includes("Photo"));
  const online = printers.filter((p) => p.status === "online").length;
  const attention = printers.filter((p) => isAttention(p.status)).length;
  const offline = printers.filter((p) => p.status === "offline").length;
  const count = (s: PrinterDTO["status"]) => printers.filter((p) => p.status === s).length;
  const problemHint = [
    count("paper_jam") && `${count("paper_jam")} paper jam`,
    count("low_ink") && `${count("low_ink")} low ink`,
    count("out_of_paper") && `${count("out_of_paper")} out of paper`,
  ]
    .filter(Boolean)
    .join(" · ");
  const hostCount = new Set(printers.flatMap((p) => (p.hosts ?? []).map((h) => h.hostname).filter(Boolean))).size;

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return printers.filter((p) => {
      const matchesFilter =
        filter === "All" ||
        (filter === "Online" && p.status === "online") ||
        (filter === "Offline" && p.status === "offline") ||
        (filter === "Needs Attention" && isAttention(p.status));
      return matchesFilter && (!q ||
          `${p.name} ${p.systemPrinterName} ${(p.hosts ?? []).map((h) => `${h.hostname} ${h.model ?? ""} ${portLabel(h)}`).join(" ")}`
            .toLowerCase()
            .includes(q));
    });
  }, [printers, filter, search]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={<LineIcon name="printer" size={24} />}
          label="Total Printers"
          value={String(printers.length)}
          hint={`${hostCount} computer${hostCount === 1 ? "" : "s"}`}
        />
        <StatCard
          icon={<LineIcon name="ok" size={24} />}
          label="Online Printers"
          value={String(online)}
          hint={online ? "Ready to print" : "None online"}
        />
        <StatCard
          icon={<LineIcon name="offline" size={24} />}
          label="Offline Printers"
          value={String(offline)}
          hint={offline ? "Not connected" : "All connected"}
          tone={offline ? "muted" : "default"}
        />
        <StatCard
          icon={<LineIcon name="warn" size={24} />}
          label="Problem Printers"
          value={String(attention)}
          hint={problemHint || "All printers healthy"}
          tone={attention ? "danger" : "default"}
        />
      </div>

      {!hasPhotoPrinter && (
        <div
          className="flex items-start gap-3 rounded-[10px] px-4 py-3 text-sm"
          style={{ background: "rgba(245,158,11,0.12)", color: "#B45309" }}
        >
          <span className="text-lg leading-none">📷</span>
          <span>
            No printer is marked as Photo-paper capable yet. Photo-paper orders will stay queued (not auto-printed)
            until you add one or assign them manually from the Live Queue.
          </span>
        </div>
      )}

      {/* Filter bar */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-6">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md border px-3.5 py-1 text-[13px] font-medium transition ${
                  filter === f
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-white"
                    : "border-slate-300 text-slate-600 active:bg-slate-50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search printers…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900/90 outline-none transition focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent)] sm:w-64"
          />
          <Button onClick={openForm} className="w-full sm:w-auto">
            Add Printer
          </Button>
        </div>
      </Card>

      {/* Connected computers */}
      {agents.length > 0 && (
        <Card>
          <CardHeader
            icon={<span className="text-3xl leading-none">💻</span>}
            title="Connected computers"
            subtitle={`${agents.filter((a) => a.online).length} of ${agents.length} online — the Print Agent runs on these`}
          />
          <div className="grid grid-cols-1 gap-4 px-6 pb-6 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((a) => (
              <div key={a.agentId} className="rounded-[10px] border border-slate-900/10 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-bold text-slate-900/90">{a.hostname || "Unnamed computer"}</div>
                    <div className="truncate text-xs text-slate-900/60">{computerModel(a)}</div>
                    {a.username && <div className="truncate text-xs text-slate-900/60">User: {a.username}</div>}
                    {a.os && <div className="truncate text-xs text-slate-900/40">{a.os}</div>}
                  </div>
                  <Chip color={a.online ? "success" : "secondary"}>{a.online ? "Online" : "Offline"}</Chip>
                </div>
                <div className="mt-1 text-[11px] text-slate-900/40">Last seen {new Date(a.lastSeenAt).toLocaleString()}</div>
                <div className="mt-3 space-y-1.5">
                  {a.printers.length === 0 && <div className="text-xs text-slate-900/50">No printers reported</div>}
                  {a.printers.map((pr) => (
                    <div key={pr.printerId} className="flex items-center justify-between gap-2 rounded-md bg-slate-900/[0.04] px-2.5 py-1.5">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-slate-900/90">{pr.name}</div>
                        <div className="truncate text-[11px] text-slate-900/60">
                          {portLabel({ ...pr, agentId: a.agentId, hostname: a.hostname })}
                        </div>
                      </div>
                      <Chip color={STATUS[pr.status].color} small>
                        {STATUS[pr.status].label}
                      </Chip>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Printer cards */}
      {printers.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <LineIcon name="printer" size={64} />
            <div className="mt-3 text-lg font-bold text-slate-900/90">No printers added yet</div>
            <p className="mt-1 max-w-sm text-sm text-slate-900/60">
              Add one, then point your Print Agent config at it.
            </p>
            <button
              onClick={openForm}
              className="mt-5 rounded-lg bg-[color:var(--accent)] px-5 py-2 text-sm font-medium text-white transition active:bg-[color:var(--accent-dark)]"
            >
              + Add Printer
            </button>
          </div>
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <div className="px-6 py-10 text-center text-sm text-slate-900/60">No printers match your filter.</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const status = STATUS[p.status];
            const isPhoto = p.supportedPaperSizes?.includes("Photo");
            const sizes = p.supportedPaperSizes?.length ? p.supportedPaperSizes : (["A4"] as PaperSize[]);
            return (
              <Card key={p._id} hover className="h-full">
                <div className="flex h-full flex-col gap-4 p-6">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full text-[22px]"
                      style={{
                        background:
                          p.status === "online"
                            ? "rgba(16,185,129,0.16)"
                            : isAttention(p.status)
                              ? "rgba(245,158,11,0.16)"
                              : "rgba(100,116,139,0.16)",
                      }}
                    >
                      <LineIcon name="printer" size={26} />
                    </div>
                    <div className="min-w-0 grow">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[15px] font-bold text-slate-900/90">{p.name}</span>
                        {isPhoto && (
                          <Chip color="purple" small>
                            📷 PHOTO
                          </Chip>
                        )}
                      </div>
                      <div className="truncate text-xs text-slate-900/60">{p.systemPrinterName}</div>
                    </div>
                    <Chip color={status.color}>{status.label}</Chip>
                  </div>

                  <div className="h-px bg-slate-900/10" />

                  <div className="grid grid-cols-2 gap-4">
                    <Field k="Type" v={TYPE_LABEL[p.type]} />
                    <Field k="Orders today" v={p.ordersPrintedToday ?? 0} />
                    <Field k="Pages today" v={p.pagesPrintedToday ?? 0} />
                    <Field k="Last seen" v={p.lastSeenAt ? new Date(p.lastSeenAt).toLocaleString() : "—"} />
                  </div>

                  <div>
                    <div className="mb-1.5 text-xs text-slate-900/60">
                      Installed on {(p.hosts ?? []).length > 1 ? `${p.hosts!.length} computers` : "computer"}
                    </div>
                    {(p.hosts ?? []).length === 0 ? (
                      <div className="text-xs text-slate-900/50">Not reported by any computer yet</div>
                    ) : (
                      <div className="space-y-1.5">
                        {p.hosts!.map((h) => (
                          <div key={h.agentId} className="rounded-lg bg-slate-900/[0.04] px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-[13px] font-semibold text-slate-900/90">💻 {h.hostname || "Unnamed computer"}</span>
                              <Chip color={STATUS[h.status].color} small>
                                {STATUS[h.status].label}
                              </Chip>
                            </div>
                            <div className="truncate text-xs text-slate-900/60">{computerModel(h)}{h.username ? ` · User: ${h.username}` : ""}</div>
                            <div className="truncate text-xs text-slate-900/60">
                              Port: <span className="font-medium text-slate-900/80">{portLabel(h)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-1.5 text-xs text-slate-900/60">Loaded paper</div>
                    <div className="flex flex-wrap gap-1.5">
                      {sizes.map((s) => (
                        <Chip key={s} color={s === "Photo" ? "purple" : "primary"} small>
                          {s === "Photo" ? "📷 Photo" : s}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  <div className="mt-auto flex justify-end pt-1">
                    <button
                      onClick={() => setToRemove(p)}
                      className="rounded-md border border-[#F43F5E]/60 px-3 py-1 text-[13px] font-medium text-[#E11D48] transition active:bg-[#F43F5E]/10"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add printer dialog */}
      <Dialog open={showForm} onClose={() => setShowForm(false)}>
        <form onSubmit={handleAdd}>
          <div className="flex items-center gap-3 px-6 pb-2 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "rgb(var(--accent-rgb) / 0.16)" }}>
              <LineIcon name="printer" size={24} />
            </div>
            <div>
              <div className="text-xl font-semibold text-slate-900/90">Add Printer</div>
              <div className="text-xs text-slate-900/60">Connect a printer to your Print Agent</div>
            </div>
          </div>

          <div className="space-y-5 px-6 pb-2 pt-5">
            {error && (
              <div className="rounded-lg px-3.5 py-2.5 text-sm" style={{ background: "rgba(244,63,94,0.12)", color: "#BE123C" }}>
                {error}
              </div>
            )}

            <TextField label="Display Name" value={name} onChange={setName} required helper="e.g. Counter B&W Printer" />

            <TextField
              label="Windows Printer Name (exact)"
              value={systemPrinterName}
              onChange={setSystemPrinterName}
              required
              helper="e.g. HP LaserJet Pro M15w — must match the exact name in Windows Settings → Printers. The Print Agent uses this to route jobs."
            />

            <SelectField label="Type" value={type} onChange={(v) => setType(v as typeof type)}>
              <option value="both">B&W + Color</option>
              <option value="bw">B&W only</option>
              <option value="color">Color only</option>
            </SelectField>

            <div>
              <div className="mb-2 text-sm font-semibold text-slate-900/90">Loaded Paper Sizes</div>
              <div className="flex flex-wrap gap-2">
                {ALL_PAPER_SIZES.map((size) => {
                  const on = paperSizes.includes(size);
                  return (
                    <button
                      type="button"
                      key={size}
                      onClick={() => togglePaperSize(size)}
                      className={`rounded-full border px-3.5 py-1 text-[13px] font-medium transition ${
                        on
                          ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-white"
                          : "border-slate-300 bg-white text-slate-600 active:bg-slate-50"
                      }`}
                    >
                      {size === "Photo" ? "📷 Photo" : size}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-900/60">
                Only check what&apos;s physically loaded right now. Orders only auto-route here if both the paper size
                and B&amp;W/Color type match — this is what stops a Photo-paper job from landing on a plain A4 printer.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 px-6 pb-5 pt-4">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition active:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[color:var(--accent)] px-5 py-2 text-sm font-medium text-white transition active:bg-[color:var(--accent-dark)] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? "Saving…" : "Add Printer"}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Remove confirmation dialog */}
      <Dialog open={!!toRemove} onClose={() => setToRemove(null)}>
        <div className="px-6 pb-2 pt-6">
          <div className="text-xl font-semibold text-slate-900/90">Remove this printer?</div>
          <p className="mt-2 text-sm text-slate-900/60">
            <span className="font-semibold text-slate-900/90">{toRemove?.name}</span> will be removed from the list.
            New orders won&apos;t be routed to it anymore.
          </p>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-5 pt-4">
          <button
            onClick={() => setToRemove(null)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition active:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="rounded-lg bg-[#F43F5E] px-5 py-2 text-sm font-medium text-white transition active:bg-[#E11D48]"
          >
            Remove
          </button>
        </div>
      </Dialog>
    </div>
  );
}
