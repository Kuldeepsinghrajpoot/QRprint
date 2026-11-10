import { describe, it, expect } from "vitest";
import { collectBlocked } from "@/lib/collectGuard";
import { contactSchema, isContactComplete } from "@/lib/shopContact";
import { aggregateStatus, isFresh, HOST_STALE_MS } from "@/lib/printerHosts";
import { assignPrinters, type RoutablePrinter } from "@/lib/printerRouting";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/uploadRules";
import { CANCEL_WINDOW_MS } from "@/lib/orderTiming";
import { PALETTES } from "@/lib/palettes";

describe("collectBlocked", () => {
  it("allows ready orders and already-collected ones", () => {
    expect(collectBlocked({ printStatus: "ready" }, false)).toBeNull();
    expect(collectBlocked({ printStatus: "collected" }, false)).toBeNull();
  });
  it("blocks orders that have not printed", () => {
    expect(collectBlocked({ printStatus: "queued" }, true)?.error).toMatch(/not printed yet/);
    expect(collectBlocked({ printStatus: "printing" }, true)?.error).toMatch(/not printed yet/);
  });
  it("blocks failed/cancelled orders", () => {
    expect(collectBlocked({ printStatus: "failed" }, true)?.error).toMatch(/"failed"/);
    expect(collectBlocked({ printStatus: "cancelled" }, true)?.error).toMatch(/"cancelled"/);
  });
  it("hand-marked ready needs confirmation", () => {
    const r = collectBlocked({ printStatus: "ready", readyBy: "staff" }, false);
    expect(r?.needsConfirm).toBe(true);
    expect(collectBlocked({ printStatus: "ready", readyBy: "staff" }, true)).toBeNull();
    expect(collectBlocked({ printStatus: "ready", readyBy: "staff", requiresManualPrint: true }, false)).toBeNull();
    expect(collectBlocked({ printStatus: "ready", readyBy: "agent" }, false)).toBeNull();
  });
});

describe("contactSchema / isContactComplete", () => {
  const ok = { phone: "+91 98765-43210", email: " Shop@Mail.com ", address: "12 Main Road, Pune" };
  it("normalises valid input", () => {
    const r = contactSchema.parse(ok);
    expect(r.phone).toBe("+919876543210");
    expect(r.email).toBe("shop@mail.com");
  });
  it.each([
    [{ ...ok, phone: "12345" }],
    [{ ...ok, phone: "abcdefghij" }],
    [{ ...ok, email: "nope" }],
    [{ ...ok, address: "short" }],
  ])("rejects %j", (bad) => expect(contactSchema.safeParse(bad).success).toBe(false));
  it("isContactComplete", () => {
    expect(isContactComplete({ contactPhone: "9876543210", contactEmail: "a@b.co", contactAddress: "A long enough address" })).toBe(true);
    expect(isContactComplete({ contactPhone: "9876543210" })).toBe(false);
    expect(isContactComplete(null)).toBe(false);
  });
});

describe("printer host status", () => {
  const now = new Date("2026-11-10T10:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);
  it("empty = offline", () => expect(aggregateStatus([], now).status).toBe("offline"));
  it("isFresh boundary", () => {
    expect(isFresh({ status: "online", lastSeenAt: ago(HOST_STALE_MS) }, now)).toBe(true);
    expect(isFresh({ status: "online", lastSeenAt: ago(HOST_STALE_MS + 1) }, now)).toBe(false);
  });
  it("stale hosts are ignored", () => {
    const r = aggregateStatus([{ status: "paper_jam", lastSeenAt: ago(10 * 60_000) }, { status: "online", lastSeenAt: ago(1000) }], now);
    expect(r.status).toBe("online");
  });
  it("all stale => offline but keeps newest lastSeenAt", () => {
    const newest = ago(5 * 60_000);
    const r = aggregateStatus([{ status: "online", lastSeenAt: ago(9 * 60_000) }, { status: "online", lastSeenAt: newest }], now);
    expect(r.status).toBe("offline");
    expect(r.lastSeenAt?.getTime()).toBe(newest.getTime());
  });
  it("an offline host is ignored while another can reach the printer", () => {
    expect(aggregateStatus([{ status: "offline", lastSeenAt: ago(1) }, { status: "online", lastSeenAt: ago(1) }], now).status).toBe("online");
  });
  it("worst problem wins", () => {
    const h = (s: "online" | "low_ink" | "out_of_paper" | "paper_jam") => ({ status: s, lastSeenAt: ago(1) });
    expect(aggregateStatus([h("online"), h("low_ink")], now).status).toBe("low_ink");
    expect(aggregateStatus([h("low_ink"), h("out_of_paper")], now).status).toBe("out_of_paper");
    expect(aggregateStatus([h("out_of_paper"), h("paper_jam"), h("online")], now).status).toBe("paper_jam");
  });
});

describe("assignPrinters", () => {
  const now = Date.now();
  const P = (id: string, over: Partial<RoutablePrinter> = {}): RoutablePrinter => ({
    _id: id, type: "both", supportedPaperSizes: ["A4"], status: "online", lastSeenAt: new Date(now - 1000), ...over,
  });
  const defaults = new Map([["bw" as const, { id: "p1", sizes: ["A4"] }]]);
  const O = (over: Record<string, unknown> = {}) => ({ printType: "bw" as const, paperSize: "A4", printerId: undefined as unknown, ...over });

  it("uses the default printer when idle", () => {
    const o = [O()];
    assignPrinters(o, defaults, [P("p1"), P("p2")], [], now);
    expect(o[0].printerId).toBe("p1");
  });
  it("spreads a batch over idle printers", () => {
    const o = [O(), O(), O()];
    assignPrinters(o, defaults, [P("p1"), P("p2")], [], now);
    expect(o.map((x) => x.printerId)).toEqual(["p1", "p2", "p1"]);
  });
  it("skips a busy default for an idle printer", () => {
    const o = [O()];
    assignPrinters(o, defaults, [P("p1"), P("p2")], ["p1"], now);
    expect(o[0].printerId).toBe("p2");
  });
  it("stays with the default when every printer is busy", () => {
    const o = [O()];
    assignPrinters(o, defaults, [P("p1"), P("p2")], ["p1", "p2"], now);
    expect(o[0].printerId).toBe("p1");
  });
  it("skips offline, jammed, stale or incompatible printers", () => {
    const printers = [
      P("p1", { status: "paper_jam" }),
      P("p2", { status: "offline" }),
      P("p3", { lastSeenAt: new Date(now - 10 * 60_000) }),
      P("p4", { type: "color" }),
      P("p5", { supportedPaperSizes: ["A3"] }),
      P("p6", { status: "low_ink" }),
    ];
    const o = [O()];
    assignPrinters(o, defaults, printers, [], now);
    expect(o[0].printerId).toBe("p6");
  });
  it("keeps hand-assigned orders and treats their printer as busy", () => {
    const o = [O({ printerId: "p1" }), O()];
    assignPrinters(o, defaults, [P("p1"), P("p2")], [], now);
    expect(o[0].printerId).toBe("p1");
    expect(o[1].printerId).toBe("p2");
  });
  it("leaves orders alone when there is no default or the default can't do the paper size", () => {
    const o = [O({ printType: "color" as const }), O({ paperSize: "A3" })];
    assignPrinters(o, defaults, [P("p1")], [], now);
    expect(o[0].printerId).toBeUndefined();
    expect(o[1].printerId).toBeUndefined();
  });
});

describe("constants", () => {
  it("upload rules", () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(25 * 1024 * 1024);
    expect(ALLOWED_MIME_TYPES.has("application/pdf")).toBe(true);
    expect(ALLOWED_MIME_TYPES.has("application/x-msdownload")).toBe(false);
    expect(ALLOWED_MIME_TYPES.has("text/html")).toBe(false);
  });
  it("cancel window covers the 30s countdown", () => expect(CANCEL_WINDOW_MS).toBeGreaterThan(30_000));
  it("palettes have unique ids and hex colours", () => {
    expect(new Set(PALETTES.map((p) => p.id)).size).toBe(PALETTES.length);
    for (const p of PALETTES) expect(p.color).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
