import type { IPrinterHost, PrinterStatus } from "@/models/Printer";

/** Agent heartbeat is every ~30s; 2 minutes of silence = that computer is offline. */
export const HOST_STALE_MS = 2 * 60 * 1000;

type HostLike = Pick<IPrinterHost, "status" | "lastSeenAt">;

export const isFresh = (h: HostLike, now = new Date()): boolean =>
  now.getTime() - new Date(h.lastSeenAt).getTime() <= HOST_STALE_MS;

export function isVersionConflictError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("name" in error && error.name === "VersionError") return true;
  return "code" in error && error.code === 11001;
}

export async function withVersionRetry<T>(
  loadLatest: () => Promise<T | null>,
  save: (doc: T) => Promise<void>,
  maxRetries = 4,
): Promise<void> {
  let current = await loadLatest();
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    if (!current) return;
    try {
      await save(current);
      return;
    } catch (error) {
      if (!isVersionConflictError(error) || attempt === maxRetries - 1) throw error;
      current = await loadLatest();
    }
  }
}

/** Higher = worse. A problem seen by ANY fresh computer wins over "online". */
const SEVERITY: Record<PrinterStatus, number> = { paper_jam: 4, out_of_paper: 3, low_ink: 2, online: 1, offline: 0 };

/**
 * One status for a printer installed on one or more computers:
 *  - computers that stopped reporting (> 2 min) are ignored;
 *  - a computer that cannot reach the printer ("offline") is ignored while another one can;
 *  - otherwise the most serious problem wins (jam > out of paper > low ink > online).
 */
export function aggregateStatus(hosts: HostLike[], now = new Date()): { status: PrinterStatus; lastSeenAt?: Date } {
  if (hosts.length === 0) return { status: "offline" };
  const lastSeenAt = new Date(Math.max(...hosts.map((h) => new Date(h.lastSeenAt).getTime())));
  const reachable = hosts.filter((h) => isFresh(h, now) && h.status !== "offline");
  if (reachable.length === 0) return { status: "offline", lastSeenAt };
  const worst = reachable.reduce((a, b) => (SEVERITY[b.status] > SEVERITY[a.status] ? b : a));
  return { status: worst.status, lastSeenAt };
}
