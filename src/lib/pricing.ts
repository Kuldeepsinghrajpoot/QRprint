export type PrintType = "bw" | "color";
export type PaperSize = "A4" | "A3" | "Legal" | "Letter" | "Photo";
export type BindingType = "none" | "spiral" | "lamination";

export interface TierRate {
  page1: number;
  page2to10: number;
  page11plus: number;
}

export type RatesTable = Record<PaperSize, Record<PrintType, TierRate>>;

/** Fallback rates used only if no PricingConfig exists yet (matches the reference poster for A4). */
export const FALLBACK_RATES: RatesTable = {
  A4: { bw: { page1: 5, page2to10: 4, page11plus: 3 }, color: { page1: 10, page2to10: 6, page11plus: 4 } },
  A3: { bw: { page1: 10, page2to10: 8, page11plus: 6 }, color: { page1: 18, page2to10: 12, page11plus: 8 } },
  Legal: { bw: { page1: 6, page2to10: 5, page11plus: 4 }, color: { page1: 12, page2to10: 7, page11plus: 5 } },
  Letter: { bw: { page1: 5, page2to10: 4, page11plus: 3 }, color: { page1: 10, page2to10: 6, page11plus: 4 } },
  Photo: { bw: { page1: 15, page2to10: 12, page11plus: 10 }, color: { page1: 20, page2to10: 16, page11plus: 12 } },
};

function calcSetPrice(rate: TierRate, pages: number): number {
  if (pages <= 0) return 0;
  // Closed-form equivalent of "loop through every page and add its tier
  // rate" — kept O(1) regardless of how large `pages` is, rather than a
  // for-loop that a maliciously large value could use to peg the CPU.
  const midPages = Math.max(0, Math.min(pages, 10) - 1); // pages 2–10
  const highPages = Math.max(0, pages - 10); // pages 11+
  return rate.page1 + midPages * rate.page2to10 + highPages * rate.page11plus;
}

/** "Pages per sheet" choices (like the browser's print dialog): several pages shrunk onto one side of a sheet. */
export const PAGES_PER_SHEET_OPTIONS = [1, 2, 4, 6, 9, 16] as const;
export type PagesPerSheet = (typeof PAGES_PER_SHEET_OPTIONS)[number];
/** Which edge the double-sided pages flip on (like the browser's "Flip on long edge / short edge"). */
export type DuplexEdge = "long" | "short";

/**
 * MongoDB expression for the printed sides of one order line (all copies): pages shrunk by "pages per sheet", times copies.
 * Used by every counter that measures real printing (print counter, printer totals, toner, wait estimate).
 */
export const PRINTED_SIDES_EXPR = {
  $multiply: [{ $ceil: { $divide: ["$pages", { $ifNull: ["$pagesPerSheet", 1] }] } }, "$copies"],
};

/** Printed sides: N pages per sheet shrinks `pages` pages onto ceil(pages / N) sides. */
export function countSides(pages: number, pagesPerSheet: number = 1): number {
  const n = Math.max(1, Math.floor(pagesPerSheet) || 1);
  return Math.max(0, Math.ceil(Math.max(0, pages) / n));
}

/** Physical sheets of paper: double-sided puts two sides on each sheet. */
export function countSheets(pages: number, pagesPerSheet: number, duplex: boolean): number {
  const sides = countSides(pages, pagesPerSheet);
  return duplex ? Math.ceil(sides / 2) : sides;
}

export interface PriceBreakdownInput {
  rates: RatesTable;
  paperSize: PaperSize;
  printType: PrintType;
  pages: number;
  pagesPerSheet?: number; // 1 when omitted (older callers)
  copies: number;
  duplex: boolean;
  binding: BindingType;
  priority: boolean;
  duplexDiscountPercent: number;
  bindingSpiralCharge: number;
  bindingLaminationCharge: number; // per page
  priorityFeePercent: number;
  gstEnabled: boolean;
  gstPercent: number;
}

export interface PriceBreakdown {
  sides: number; // printed sides after "pages per sheet"
  sheets: number; // physical sheets (sides, halved when double-sided)
  baseCost: number;
  duplexDiscount: number;
  bindingCharge: number;
  subtotal: number;
  priorityFee: number;
  gstAmount: number;
  total: number;
}

export function calcOrderPrice(input: PriceBreakdownInput): PriceBreakdown {
  const rate = input.rates[input.paperSize][input.printType];
  // Both settings work together: pages-per-sheet shrinks the pages to fewer printed sides, and those sides are what is
  // priced; double-sided then halves the sheets of paper (and keeps its own discount).
  const sides = countSides(input.pages, input.pagesPerSheet ?? 1);
  const sheets = countSheets(input.pages, input.pagesPerSheet ?? 1, input.duplex);
  const baseCost = calcSetPrice(rate, sides) * Math.max(1, input.copies);

  const duplexDiscount = input.duplex
    ? Math.round((baseCost * input.duplexDiscountPercent) / 100)
    : 0;

  let bindingCharge = 0;
  if (input.binding === "spiral") bindingCharge = input.bindingSpiralCharge * input.copies;
  if (input.binding === "lamination") bindingCharge = input.bindingLaminationCharge * sheets * input.copies;

  const subtotal = Math.max(0, baseCost - duplexDiscount + bindingCharge);
  const priorityFee = input.priority ? Math.round((subtotal * input.priorityFeePercent) / 100) : 0;
  const preTax = subtotal + priorityFee;
  const gstAmount = input.gstEnabled ? Math.round((preTax * input.gstPercent) / 100) : 0;
  const total = preTax + gstAmount;

  return { sides, sheets, baseCost, duplexDiscount, bindingCharge, subtotal, priorityFee, gstAmount, total };
}

/** Generates a short, human-friendly order token, e.g. "A247" */
export function generateToken(): string {
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const num = Math.floor(100 + Math.random() * 899);
  return `${letter}${num}`;
}
