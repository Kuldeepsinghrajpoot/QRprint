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
  const copies = Math.max(1, input.copies);
  const baseCost = calcSetPrice(rate, sides) * copies;
  const duplexDiscountBase = sides > 0 ? Math.max(0, baseCost - rate.page1 * copies) : 0;

  const duplexDiscount = input.duplex
    ? Math.min(duplexDiscountBase, Math.round((duplexDiscountBase * input.duplexDiscountPercent) / 100))
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

export const PAPER_SIZES: readonly PaperSize[] = ["A4", "A3", "Legal", "Letter", "Photo"];
export const PRINT_TYPES: readonly PrintType[] = ["bw", "color"];

/** Which paper size + print type combinations a shop can print. A missing entry counts as offered (shops from before this setting). */
export type Availability = Partial<Record<PaperSize, Partial<Record<PrintType, boolean>>>>;

export const isOffered = (a: Availability | null | undefined, size: PaperSize, type: PrintType): boolean => a?.[size]?.[type] !== false;

/** Print types the shop offers on at least one paper size. */
export const offeredTypes = (a: Availability | null | undefined): PrintType[] => PRINT_TYPES.filter((t) => PAPER_SIZES.some((s) => isOffered(a, s, t)));

/** Paper sizes the shop can print in the given type. */
export const offeredSizes = (a: Availability | null | undefined, type: PrintType): PaperSize[] => PAPER_SIZES.filter((s) => isOffered(a, s, type));

/**
 * The nearest combination the shop really offers: keeps the wanted type and size when possible, otherwise keeps the type and
 * takes its first size, otherwise takes the first offered type. null when the shop offers nothing.
 */
export function nearestOffered(a: Availability | null | undefined, size: PaperSize, type: PrintType): { paperSize: PaperSize; printType: PrintType } | null {
  if (isOffered(a, size, type)) return { paperSize: size, printType: type };
  const sameType = offeredSizes(a, type);
  if (sameType.length) return { paperSize: sameType.includes("A4") ? "A4" : sameType[0], printType: type };
  const other = offeredTypes(a)[0];
  if (!other) return null;
  const sizes = offeredSizes(a, other);
  return { paperSize: sizes.includes(size) ? size : sizes.includes("A4") ? "A4" : sizes[0], printType: other };
}

/** Default online payment charge (Razorpay: 2% per transaction + 18% GST on that fee). */
export const DEFAULT_ONLINE_FEE_PERCENT = 2;
export const DEFAULT_ONLINE_FEE_GST_PERCENT = 18;

export interface OnlineFee {
  fee: number; // gateway charge passed on to the customer, e.g. 2% of the order total
  gst: number; // GST charged on that fee, e.g. 18% of `fee`
  total: number; // fee + gst
}

/**
 * Online payment charge added on top of the order total when the customer pays by UPI/card.
 * Example: Rs 100 order, 2% + 18% GST -> fee 2, GST 0.36 -> rounds to 0, so Rs 2 extra; Rs 500 -> fee 10 + GST 2 = Rs 12.
 * Returns zeros when the shop has not turned it on, so callers can add `.total` unconditionally.
 */
export function calcOnlineFee(orderTotal: number, enabled: boolean, feePercent: number, gstPercent: number): OnlineFee {
  if (!enabled || orderTotal <= 0 || feePercent <= 0) return { fee: 0, gst: 0, total: 0 };
  const fee = Math.round((orderTotal * feePercent) / 100);
  const gst = Math.round((fee * Math.max(0, gstPercent)) / 100);
  return { fee, gst, total: fee + gst };
}

/** Generates a short, human-friendly order token, e.g. "A247" */
export function generateToken(): string {
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const num = Math.floor(100 + Math.random() * 899);
  return `${letter}${num}`;
}
