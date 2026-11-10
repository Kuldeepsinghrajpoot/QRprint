/**
 * Page ranges typed by the customer, like "1-3, 5, 8-10". Pure functions (no browser or server imports).
 */
export type RangeResult = { ok: true; pages: number[] } | { ok: false; error: string };

/** Turns "1-3, 5" into [1,2,3,5] for a document with `total` pages. Empty text = every page. Duplicates are dropped. */
export function parsePageRange(text: string, total: number): RangeResult {
  const all = Array.from({ length: Math.max(0, total) }, (_, i) => i + 1);
  const t = text.trim();
  if (!t) return { ok: true, pages: all };

  const seen = new Set<number>();
  const pages: number[] = [];
  const add = (n: number) => {
    if (!seen.has(n)) {
      seen.add(n);
      pages.push(n);
    }
  };

  for (const raw of t.split(",")) {
    const part = raw.trim();
    if (!part) continue; // "1,,2" and a trailing comma are harmless
    const m = /^(\d+)\s*(?:[-–]\s*(\d+))?$/.exec(part);
    if (!m) return { ok: false, error: `"${part}" is not a page number or range. Use something like 1-3, 5` };
    const from = Number(m[1]);
    const to = m[2] === undefined ? from : Number(m[2]);
    if (from < 1 || to < 1) return { ok: false, error: "Page numbers start at 1" };
    if (from > total || to > total) return { ok: false, error: `This file has only ${total} page${total === 1 ? "" : "s"}` };
    if (to < from) return { ok: false, error: `"${part}" is backwards. Write it as ${to}-${from}` };
    for (let n = from; n <= to; n++) add(n);
  }
  if (pages.length === 0) return { ok: true, pages: all };
  return { ok: true, pages };
}

/** "1,2,3,5,6" -> "1-3, 5-6" (for the file name and the summary shown to the customer). */
export function describePages(pages: number[]): string {
  const sorted = [...pages].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    out.push(j > i ? `${sorted[i]}-${sorted[j]}` : String(sorted[i]));
    i = j + 1;
  }
  return out.join(", ");
}
