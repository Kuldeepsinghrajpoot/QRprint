import { Agent } from "@/models/Agent";
import { isAgentOnline } from "@/lib/printerHosts";

export async function isShopOnline(shopId: string, now = new Date()): Promise<boolean> {
  const agents = await Agent.find({ shopId }).select("status lastSeenAt").lean();
  return agents.some((agent) => isAgentOnline(agent, now));
}
