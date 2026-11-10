import mongoose, { Schema, Document, Model } from "mongoose";

export type PrintType = "bw" | "color";
export type PaperSize = "A4" | "A3" | "Legal" | "Letter" | "Photo";
export type BindingType = "none" | "spiral" | "lamination";
export type PaymentMethod = "cash" | "online" | "free";
export type PaymentStatus = "pending" | "paid" | "refunded";
export type PaymentProvider = "razorpay" | "phonepe" | "paytm";
export type PrintStatus = "queued" | "printing" | "ready" | "collected" | "failed" | "cancelled";

export interface IOrder extends Document {
  token: string;
  shopId: string;
  customerName: string;
  customerPhone?: string;
  fileUrl?: string;
  fileKey?: string;
  fileName?: string;
  // True for Word docs/ZIPs — the agent can't silently print these
  // (no reliable Windows print path for .docx/.zip), so staff open and
  // print them manually, then mark the order ready themselves.
  requiresManualPrint: boolean;
  approvedForPrint?: boolean; // set by staff ("Print now") when the shop has auto-print switched off

  printType: PrintType;
  paperSize: PaperSize;
  duplex: boolean;
  duplexEdge: "long" | "short"; // flip on the long or short edge (only matters when duplex)
  pagesPerSheet: number; // 1, 2, 4, 6, 9 or 16 pages shrunk onto one side of a sheet
  binding: BindingType;
  pages: number;
  pageCountEstimated: boolean; // true when the customer typed a guess (Word/ZIP files aren't auto-counted)
  copies: number;
  priority: boolean;
  queuePosition: number;

  subtotal: number;
  priorityFee: number;
  gstRate: number;
  gstAmount: number;
  onlineFee: number; // gateway charge added for online payments (included in totalPrice)
  onlineFeeGst: number; // GST on that charge (included in totalPrice)
  totalPrice: number;

  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  printStatus: PrintStatus;
  printerId?: mongoose.Types.ObjectId;
  printerError?: string;
  printAgentId?: string; // computer (Print Agent) that printed / is printing this order
  printedOn?: string; // Windows printer name it was sent to
  readyBy?: "agent" | "staff"; // who set "ready": the Print Agent (really printed) or staff by hand (may never have printed)
  razorpayPaymentId?: string;
  // Which gateway took the money. Refunds must go back through the SAME gateway, even if the shop later switches.
  // Orders from before PhonePe/Paytm existed have none of these three and are treated as Razorpay.
  paymentProvider?: PaymentProvider;
  gatewayOrderId?: string; // PhonePe merchantOrderId / Paytm orderId (our own id, one per payment)
  gatewayTxnId?: string; // Paytm transaction id (needed to refund) / PhonePe transaction id
  cancelledAt?: Date;
  cancelledBy?: "customer" | "shop";
  cancelReason?: string;
  cancelKeyHash?: string; // hash of the secret the customer needs to cancel this order

  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    token: { type: String, required: true, unique: true },
    shopId: { type: String, required: true, default: "main" },
    customerName: { type: String, required: true },
    customerPhone: { type: String },
    fileUrl: { type: String },
    fileKey: { type: String },
    fileName: { type: String },
    requiresManualPrint: { type: Boolean, default: false },
    approvedForPrint: { type: Boolean, default: false },

    printType: { type: String, enum: ["bw", "color"], required: true },
    paperSize: { type: String, enum: ["A4", "A3", "Legal", "Letter", "Photo"], default: "A4" },
    duplex: { type: Boolean, default: false },
    duplexEdge: { type: String, enum: ["long", "short"], default: "long" },
    pagesPerSheet: { type: Number, enum: [1, 2, 4, 6, 9, 16], default: 1 },
    binding: { type: String, enum: ["none", "spiral", "lamination"], default: "none" },
    pages: { type: Number, required: true, min: 1 },
    pageCountEstimated: { type: Boolean, default: false },
    copies: { type: Number, required: true, min: 1, default: 1 },
    priority: { type: Boolean, default: false },
    // Default to creation time so orders are naturally FIFO unless staff
    // manually drags one up/down the queue, which rewrites this value.
    queuePosition: { type: Number, default: () => Date.now() },

    subtotal: { type: Number, required: true },
    priorityFee: { type: Number, default: 0 },
    gstRate: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    onlineFee: { type: Number, default: 0 },
    onlineFeeGst: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },

    paymentMethod: { type: String, enum: ["cash", "online", "free"], required: true },
    paymentStatus: { type: String, enum: ["pending", "paid", "refunded"], default: "pending" },
    printStatus: {
      type: String,
      enum: ["queued", "printing", "ready", "collected", "failed", "cancelled"],
      default: "queued",
    },
    printerId: { type: Schema.Types.ObjectId, ref: "Printer" },
    printerError: { type: String },
    printAgentId: { type: String },
    printedOn: { type: String },
    readyBy: { type: String, enum: ["agent", "staff"] },
    razorpayPaymentId: { type: String, unique: true, sparse: true },
    paymentProvider: { type: String, enum: ["razorpay", "phonepe", "paytm"] },
    gatewayOrderId: { type: String, unique: true, sparse: true }, // one payment can only ever pay for one order
    gatewayTxnId: { type: String },
    cancelledAt: { type: Date },
    cancelledBy: { type: String, enum: ["customer", "shop"] },
    cancelReason: { type: String, maxlength: 200 },
    cancelKeyHash: { type: String, select: false },
  },
  { timestamps: true }
);

OrderSchema.index({ shopId: 1, createdAt: -1 });
OrderSchema.index({ shopId: 1, printStatus: 1, paymentStatus: 1 });

export const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);
