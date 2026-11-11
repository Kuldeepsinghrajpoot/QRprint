import mongoose, { Schema, Document, Model } from "mongoose";

/** A computer running the Print Agent. Created/refreshed by every printer sync (heartbeat). */
export interface IAgent extends Omit<Document, "model"> {
  shopId: string;
  agentId: string; // random id generated once per agent install
  hostname: string; // Windows computer name
  username?: string; // Windows user signed in on that computer
  manufacturer?: string;
  model?: string; // computer model number
  os?: string;
  appVersion?: string;
  status?: "online" | "offline";
  lastSeenAt: Date;
}

const AgentSchema = new Schema<IAgent>(
  {
    shopId: { type: String, required: true, default: "main" },
    agentId: { type: String, required: true },
    hostname: { type: String, default: "" },
    username: String,
    manufacturer: String,
    model: String,
    os: String,
    appVersion: String,
    status: { type: String, enum: ["online", "offline"], default: "online" },
    lastSeenAt: { type: Date, required: true },
  },
  { timestamps: true }
);
AgentSchema.index({ shopId: 1, agentId: 1 }, { unique: true });

export const Agent: Model<IAgent> = mongoose.models.Agent || mongoose.model<IAgent>("Agent", AgentSchema);
