import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITierRate {
  page1: number;
  page2to10: number;
  page11plus: number;
}

export interface IPricingConfig extends Document {
  shopId: string;
  shopName: string;

  // Base per-page tiered rates, per paper size, per print type
  rates: {
    A4: { bw: ITierRate; color: ITierRate };
    A3: { bw: ITierRate; color: ITierRate };
    Legal: { bw: ITierRate; color: ITierRate };
    Letter: { bw: ITierRate; color: ITierRate };
    Photo: { bw: ITierRate; color: ITierRate };
  };

  // Flat add-on charges
  duplexDiscountPercent: number; // % discount on subtotal for double-side printing (paper saving)
  bindingSpiralCharge: number;
  bindingLaminationCharge: number; // per page
  priorityFeePercent: number; // % extra on subtotal for rush print

  gstEnabled: boolean;
  gstPercent: number;

  freePrinting: boolean; // no payment at all (college / office): orders go straight to the queue and earn no revenue
  cashPaymentEnabled: boolean;
  onlinePaymentEnabled: boolean;

  // When true: customers can't place new orders, and the Print Agent stops
  // picking up already-queued ones too (covers both "lunch break" and
  // "printer under maintenance" — in both cases nothing should print).
  printingPaused: boolean;

  // ---- Shop Controls (dashboard page "Shop Controls") ----
  autoPrint: boolean; // true: paid orders go to the printer by themselves; false: staff press "Print now" on each order
  defaultColorPrinterId: string; // printer used for colour jobs that have no printer picked ("" = let the agent choose)
  defaultBwPrinterId: string; // same for black & white jobs
  openingHoursEnabled: boolean; // when on, customers can only place orders during the opening hours below
  openTime: string; // "HH:MM" 24h, shop local time
  closeTime: string; // "HH:MM"; earlier than openTime means the shop closes after midnight
  openDays: number[]; // 0 = Sunday ... 6 = Saturday
  timezone: string; // IANA name, e.g. "Asia/Kolkata"
  minOrderAmount: number; // ₹, 0 = no minimum
  maxPagesPerOrder: number; // 0 = no limit
  maxActiveOrders: number; // waiting + printing orders at once, 0 = no limit
  showWaitTime: boolean; // customers see "N orders ahead, about X min" on the order and tracking pages
  requirePhone: boolean; // customer must enter a mobile number
  customerNotice: string; // short message shown at the top of the customer page
  cashAutoCancelMinutes: number; // unpaid cash orders are cancelled after this many minutes

  updatedAt: Date;
}

const tierRateSchema = {
  page1: { type: Number, required: true },
  page2to10: { type: Number, required: true },
  page11plus: { type: Number, required: true },
};

const PricingConfigSchema = new Schema<IPricingConfig>(
  {
    shopId: { type: String, required: true, unique: true, default: "main" },
    shopName: { type: String, required: true, default: "My Print Shop" },

    rates: {
      A4: {
        bw: tierRateSchema,
        color: tierRateSchema,
      },
      A3: {
        bw: tierRateSchema,
        color: tierRateSchema,
      },
      Legal: {
        bw: tierRateSchema,
        color: tierRateSchema,
      },
      Letter: {
        bw: tierRateSchema,
        color: tierRateSchema,
      },
      Photo: {
        bw: tierRateSchema,
        color: tierRateSchema,
      },
    },

    duplexDiscountPercent: { type: Number, default: 10 },
    bindingSpiralCharge: { type: Number, default: 20 },
    bindingLaminationCharge: { type: Number, default: 5 },
    priorityFeePercent: { type: Number, default: 25 },

    gstEnabled: { type: Boolean, default: false },
    gstPercent: { type: Number, default: 18 },

    freePrinting: { type: Boolean, default: false },
    cashPaymentEnabled: { type: Boolean, default: true },
    onlinePaymentEnabled: { type: Boolean, default: true },

    printingPaused: { type: Boolean, default: false },

    autoPrint: { type: Boolean, default: true },
    defaultColorPrinterId: { type: String, default: "" },
    defaultBwPrinterId: { type: String, default: "" },
    openingHoursEnabled: { type: Boolean, default: false },
    openTime: { type: String, default: "09:00" },
    closeTime: { type: String, default: "21:00" },
    openDays: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },
    timezone: { type: String, default: "Asia/Kolkata" },
    minOrderAmount: { type: Number, default: 0 },
    maxPagesPerOrder: { type: Number, default: 0 },
    maxActiveOrders: { type: Number, default: 0 },
    showWaitTime: { type: Boolean, default: true },
    requirePhone: { type: Boolean, default: false },
    customerNotice: { type: String, default: "" },
    cashAutoCancelMinutes: { type: Number, default: 20 },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

export const PricingConfig: Model<IPricingConfig> =
  mongoose.models.PricingConfig || mongoose.model<IPricingConfig>("PricingConfig", PricingConfigSchema);

/** Default pricing used to seed a new shop's config (matches the reference poster for A4). */
export const DEFAULT_RATES = {
  A4: {
    bw: { page1: 5, page2to10: 4, page11plus: 3 },
    color: { page1: 10, page2to10: 6, page11plus: 4 },
  },
  A3: {
    bw: { page1: 10, page2to10: 8, page11plus: 6 },
    color: { page1: 18, page2to10: 12, page11plus: 8 },
  },
  Legal: {
    bw: { page1: 6, page2to10: 5, page11plus: 4 },
    color: { page1: 12, page2to10: 7, page11plus: 5 },
  },
  Letter: {
    bw: { page1: 5, page2to10: 4, page11plus: 3 },
    color: { page1: 10, page2to10: 6, page11plus: 4 },
  },
  Photo: {
    bw: { page1: 15, page2to10: 12, page11plus: 10 },
    color: { page1: 20, page2to10: 16, page11plus: 12 },
  },
};
