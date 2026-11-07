export type Mode = "bw" | "color";

export interface RoutablePrinter {
  _id: unknown;
  type: "bw" | "color" | "both";
  supportedPaperSizes?: string[];
  status: string;
  lastSeenAt?: Date | string | null;
}

export interface RoutableOrder {
  printType: Mode;
  paperSize: string;
  printerId?: unknown;
}

/**
 * Chooses a printer for every order nobody assigned. The shop's default printer for the order's colour mode goes first;
 * if it is busy with a job (or offline / jammed), the order goes to another printer that can print it and has no job
 * right now. When every suitable printer is busy the order stays with the default and waits its turn there.
 *
 * `busyIds` = printers that are printing right now. Orders the staff assigned by hand count as busy too, and so does
 * each printer this function hands an order to, so a batch spreads over the idle printers.
 */
export function assignPrinters<O extends RoutableOrder>(
  orders: O[],
  defaults: Map<Mode, { id: string; sizes: string[] }>,
  printers: RoutablePrinter[],
  busyIds: Iterable<unknown>,
  nowMs: number = Date.now()
): void {
  const busy = new Set([...busyIds].map(String));
  for (const o of orders) if (o.printerId) busy.add(String(o.printerId));

  const usable = (p: RoutablePrinter) =>
    (p.status === "online" || p.status === "low_ink") && (!p.lastSeenAt || nowMs - new Date(p.lastSeenAt).getTime() < 3 * 60 * 1000);
  const canDo = (p: RoutablePrinter, o: O) => (p.type === "both" || p.type === o.printType) && (p.supportedPaperSizes ?? []).includes(o.paperSize);

  for (const o of orders) {
    if (o.printerId) continue;
    const d = defaults.get(o.printType);
    if (!d || !d.sizes.includes(o.paperSize)) continue;
    const ordered = [...printers].sort((x, y) => Number(String(y._id) === d.id) - Number(String(x._id) === d.id));
    const free = ordered.find((p) => usable(p) && canDo(p, o) && !busy.has(String(p._id)));
    const chosen = free ? String(free._id) : d.id;
    busy.add(chosen);
    o.printerId = chosen;
  }
}
