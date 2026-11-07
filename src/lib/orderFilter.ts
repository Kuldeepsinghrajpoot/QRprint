/** Shared by the Order History page and the CSV export: turns the URL filters into a MongoDB query. */

const DAY_MS = 24 * 60 * 60 * 1000;
export const shopTimezone = () => process.env.SHOP_TIMEZONE || "Asia/Kolkata";

/** How far the timezone is ahead of UTC at a given moment (ms). */
function offsetMs(at: number, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(at))
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(at / 1000) * 1000;
}

/** Midnight at the start of a "YYYY-MM-DD" day in the shop's timezone, as a UTC Date. */
export function zonedDayStart(day: string, tz = shopTimezone()): Date {
  const guess = Date.parse(`${day}T00:00:00Z`);
  const first = guess - offsetMs(guess, tz);
  return new Date(guess - offsetMs(first, tz));
}

export const todayKey = (tz = shopTimezone()): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export const addDays = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PRINT = ["queued", "printing", "ready", "collected", "failed", "cancelled"];
const PAY = ["pending", "paid", "refunded"];
const METHOD = ["cash", "online", "free"];

export function buildOrderFilter(shopId: string, sp: URLSearchParams): Record<string, unknown> {
  const filter: Record<string, unknown> = { shopId };

  const status = sp.get("status");
  if (status && PRINT.includes(status)) filter.printStatus = status;
  const payment = sp.get("payment");
  if (payment && PAY.includes(payment)) filter.paymentStatus = payment;
  const method = sp.get("method");
  if (method && METHOD.includes(method)) filter.paymentMethod = method;

  // Date range, in the shop's timezone
  const range = sp.get("range") || "all";
  let from: string | undefined;
  let to: string | undefined;
  if (range === "today") from = to = todayKey();
  else if (range === "7") [from, to] = [addDays(todayKey(), -6), todayKey()];
  else if (range === "30") [from, to] = [addDays(todayKey(), -29), todayKey()];
  else if (range === "custom") {
    const f = sp.get("from");
    const t = sp.get("to");
    if (f && DAY_RE.test(f)) from = f;
    if (t && DAY_RE.test(t)) to = t;
  }
  const createdAt: Record<string, Date> = {};
  if (from) createdAt.$gte = zonedDayStart(from);
  if (to) createdAt.$lt = zonedDayStart(addDays(to, 1));
  if (Object.keys(createdAt).length) filter.createdAt = createdAt;

  const q = (sp.get("q") || "").trim().slice(0, 60);
  if (q) {
    const re = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ customerName: re }, { customerPhone: re }, { token: re }];
  }
  return filter;
}
