/** Opening-hours check shared by the customer page (what to show) and POST /api/orders (what to enforce). */
export interface HoursConfig {
  openingHoursEnabled?: boolean;
  openTime?: string;
  closeTime?: string;
  openDays?: number[];
  timezone?: string;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const toMinutes = (hhmm: string | undefined, fallback: number) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : fallback;
};

/** "21:00" -> "9:00 PM" */
export function fmtTime(hhmm: string | undefined): string {
  const mins = toMinutes(hhmm, 0);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Day of week (0 = Sunday) and minutes since midnight in the shop's own time zone. */
function shopLocalNow(timezone: string, now: Date): { day: number; minutes: number } {
  let tz = timezone || "Asia/Kolkata";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    tz = "Asia/Kolkata";
  }
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day: day < 0 ? 0 : day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function shopOpenStatus(c: HoursConfig, now: Date = new Date()): { open: boolean; message: string } {
  if (!c.openingHoursEnabled) return { open: true, message: "" };
  const days = c.openDays?.length ? c.openDays : [0, 1, 2, 3, 4, 5, 6];
  const open = toMinutes(c.openTime, 9 * 60);
  const close = toMinutes(c.closeTime, 21 * 60);
  const { day, minutes } = shopLocalNow(c.timezone || "Asia/Kolkata", now);

  let isOpen: boolean;
  if (open === close) isOpen = days.includes(day); // same time twice = open all day
  else if (open < close) isOpen = days.includes(day) && minutes >= open && minutes < close;
  else isOpen = (days.includes(day) && minutes >= open) || (days.includes((day + 6) % 7) && minutes < close); // closes after midnight

  if (isOpen) return { open: true, message: "" };
  const hours = `${fmtTime(c.openTime)} to ${fmtTime(c.closeTime)}`;
  const openOn = days.length === 7 ? "every day" : days.map((d) => DAY_NAMES[d].slice(0, 3)).join(", ");
  return { open: false, message: `We're closed right now. We take orders ${hours}, ${openOn}.` };
}
