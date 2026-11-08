export type PrintType = "bw" | "color";
export type PaperSize = "A4" | "A3" | "Legal" | "Letter" | "Photo";
export type BindingType = "none" | "spiral" | "lamination";
export type PaymentMethod = "cash" | "online" | "free";
export type PaymentStatus = "pending" | "paid" | "refunded";
export type PrintStatus = "queued" | "printing" | "ready" | "collected" | "failed" | "cancelled";

export interface OrderDTO {
  _id: string;
  token: string;
  cancelledBy?: "customer" | "shop";
  cancelReason?: string;
  cancelKey?: string; // only in the response to placing the order; needed to cancel it
  customerName: string;
  customerPhone?: string;
  fileUrl?: string;
  fileName?: string;
  requiresManualPrint: boolean;
  updatedAt?: string;
  approvedForPrint?: boolean; // staff pressed "Print now" (only matters while auto-print is off)

  printType: PrintType;
  paperSize: PaperSize;
  duplex: boolean;
  duplexEdge?: "long" | "short";
  pagesPerSheet?: number;
  binding: BindingType;
  pages: number;
  pageCountEstimated: boolean;
  copies: number;
  priority: boolean;
  queuePosition: number;

  subtotal: number;
  priorityFee: number;
  gstRate: number;
  gstAmount: number;
  totalPrice: number;

  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  printStatus: PrintStatus;
  printerId?: string;
  printerError?: string;
  printAgentId?: string;
  printedOn?: string;
  readyBy?: "agent" | "staff";

  createdAt: string;
}

export interface TierRate {
  page1: number;
  page2to10: number;
  page11plus: number;
}

export interface PricingConfigDTO {
  _id: string;
  shopId: string;
  shopName: string;
  rates: Record<PaperSize, Record<PrintType, TierRate>>;
  duplexDiscountPercent: number;
  bindingSpiralCharge: number;
  bindingLaminationCharge: number;
  priorityFeePercent: number;
  gstEnabled: boolean;
  gstPercent: number;
  freePrinting?: boolean;
  cashPaymentEnabled: boolean;
  onlinePaymentEnabled: boolean;
  printingPaused: boolean;
  // Shop Controls
  autoPrint?: boolean;
  defaultColorPrinterId?: string;
  defaultBwPrinterId?: string;
  openingHoursEnabled?: boolean;
  openTime?: string;
  closeTime?: string;
  openDays?: number[];
  timezone?: string;
  minOrderAmount?: number;
  maxPagesPerOrder?: number;
  maxActiveOrders?: number;
  showWaitTime?: boolean;
  requirePhone?: boolean;
  customerNotice?: string;
  cashAutoCancelMinutes?: number;
}

/** One computer a printer is installed on, and how it is connected there. */
export interface PrinterHostDTO {
  agentId: string;
  hostname: string;
  username?: string;
  manufacturer?: string;
  model?: string;
  port?: string;
  portType?: string;
  ipAddress?: string;
  tcpPort?: number;
  driver?: string;
  status: "online" | "offline" | "paper_jam" | "low_ink" | "out_of_paper";
  lastSeenAt?: string;
}

/** A computer running the Print Agent (GET /api/agents). */
export interface AgentDTO {
  agentId: string;
  hostname: string;
  username?: string;
  manufacturer?: string;
  model?: string;
  os?: string;
  appVersion?: string;
  lastSeenAt: string;
  online: boolean;
  printers: {
    printerId: string;
    name: string;
    port?: string;
    portType?: string;
    ipAddress?: string;
    tcpPort?: number;
    status: PrinterHostDTO["status"];
  }[];
}

export interface PrinterDTO {
  _id: string;
  name: string;
  type: "bw" | "color" | "both";
  colorCapable?: boolean; // detected by the Print Agent: true = colour capable, false = B&W only, missing = unknown
  systemPrinterName: string;
  supportedPaperSizes: PaperSize[];
  status: "online" | "offline" | "paper_jam" | "low_ink" | "out_of_paper";
  lastSeenAt?: string;
  hosts?: PrinterHostDTO[];
  ordersPrintedToday: number;
  pagesPrintedToday?: number;
}
