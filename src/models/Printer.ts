import mongoose, { Schema, Document, Model } from "mongoose";

export type PrinterType = "bw" | "color" | "both";
export type PrinterStatus = "online" | "offline" | "paper_jam" | "low_ink" | "out_of_paper";
export type PaperSize = "A4" | "A3" | "Legal" | "Letter" | "Photo";

/** One computer (Print Agent) that has this printer installed, with how it is connected there. */
export interface IPrinterHost {
  agentId: string;
  hostname: string;
  username?: string; // Windows user signed in on that computer
  manufacturer?: string;
  model?: string; // computer model number, e.g. "Latitude 5420"
  port?: string; // Windows port name: USB001, IP_192.168.1.20, WSD-...
  portType?: string;
  ipAddress?: string;
  tcpPort?: number; // e.g. 9100 for network printers
  driver?: string;
  status: PrinterStatus;
  lastSeenAt: Date;
}

export interface IPrinter extends Document {
  shopId: string;
  name: string;
  type: PrinterType;
  systemPrinterName: string; // exact name as registered in Windows, used by the print agent
  // Which paper sizes this physical printer is actually loaded/able to print on.
  // Critical for Photo paper specifically — most shop printers don't have a photo
  // tray loaded, so a Photo order must only auto-route to a printer that has this.
  supportedPaperSizes: PaperSize[];
  status: PrinterStatus;
  lastSeenAt?: Date;
  hosts: IPrinterHost[]; // computers this printer is installed on (reported by their agents)
  tonerYieldPages?: number; // pages one cartridge / ink refill prints; 0 or missing = supplies not tracked for this printer
  tonerRefilledAt?: Date; // when the cartridge was last changed or refilled (pages are counted from here)
  ordersPrintedToday: number;
  createdAt: Date;
}

const PrinterHostSchema = new Schema<IPrinterHost>(
  {
    agentId: { type: String, required: true },
    hostname: { type: String, default: "" },
    username: String,
    manufacturer: String,
    model: String,
    port: String,
    portType: String,
    ipAddress: String,
    tcpPort: Number,
    driver: String,
    status: {
      type: String,
      enum: ["online", "offline", "paper_jam", "low_ink", "out_of_paper"],
      default: "online",
    },
    lastSeenAt: { type: Date, required: true },
  },
  { _id: false }
);

const PrinterSchema = new Schema<IPrinter>(
  {
    shopId: { type: String, required: true, default: "main" },
    name: { type: String, required: true },
    type: { type: String, enum: ["bw", "color", "both"], default: "both" },
    systemPrinterName: { type: String, required: true },
    supportedPaperSizes: {
      type: [String],
      enum: ["A4", "A3", "Legal", "Letter", "Photo"],
      default: ["A4", "Legal", "Letter"],
    },
    status: {
      type: String,
      enum: ["online", "offline", "paper_jam", "low_ink", "out_of_paper"],
      default: "offline",
    },
    lastSeenAt: { type: Date },
    hosts: { type: [PrinterHostSchema], default: [] },
    tonerYieldPages: { type: Number, default: 0 },
    tonerRefilledAt: { type: Date },
    ordersPrintedToday: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Printer: Model<IPrinter> =
  mongoose.models.Printer || mongoose.model<IPrinter>("Printer", PrinterSchema);
