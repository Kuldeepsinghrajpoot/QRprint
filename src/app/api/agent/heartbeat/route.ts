import { serverError } from "@/lib/apiError";
import { getAgentShopId } from "@/lib/agentAuth";
import { connectDB } from "@/lib/mongodb";
import { Agent } from "@/models/Agent";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  agentId: z.string().trim().min(8).max(100),
  agent: z.object({
    hostname: z.string().trim().max(100),
    appVersion: z.string().trim().max(30),
  }),
  status: z.enum(["online", "offline"]),
  seq: z.number().int().nonnegative(),
  sentAt: z.string().datetime(),
  printers: z.object({
    total: z.number().int().nonnegative(),
    online: z.number().int().nonnegative(),
  }),
});

/** POST /api/agent/heartbeat — record an agent's online/offline state for its shop. */
export async function POST(req: NextRequest) {
  const shopId = await getAgentShopId(req);
  if (!shopId) {
    return NextResponse.json({ error: "Invalid or missing agent key" }, { status: 401 });
  }

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await connectDB();
    const now = new Date();
    const { agentId, agent, status } = parsed.data;
    await Agent.updateOne(
      { shopId, agentId },
      {
        $set: {
          hostname: agent.hostname,
          appVersion: agent.appVersion,
          status,
          lastSeenAt: now,
        },
        $setOnInsert: { shopId, agentId },
      },
      { upsert: true },
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, "Failed to record agent heartbeat");
  }
}
