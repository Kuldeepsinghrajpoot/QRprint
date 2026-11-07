import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Agent } from "@/models/Agent";
import { Printer } from "@/models/Printer";
import { getSession } from "@/lib/session";
import { isFresh } from "@/lib/printerHosts";

export const runtime = "nodejs";

/** GET /api/agents — computers running the Print Agent, with the printers each one has installed. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const shopId = session.shopId;
  await connectDB();
  const now = new Date();
  const [agents, printers] = await Promise.all([
    Agent.find({ shopId }).sort({ hostname: 1 }).lean(),
    Printer.find({ shopId }).select("name systemPrinterName hosts").lean(),
  ]);

  return NextResponse.json(
    agents.map((a) => ({
      agentId: a.agentId,
      hostname: a.hostname,
      username: a.username,
      manufacturer: a.manufacturer,
      model: a.model,
      os: a.os,
      appVersion: a.appVersion,
      lastSeenAt: a.lastSeenAt,
      online: isFresh({ status: "online", lastSeenAt: a.lastSeenAt }, now),
      printers: printers.flatMap((p) =>
        (p.hosts ?? [])
          .filter((h) => h.agentId === a.agentId)
          .map((h) => ({
            printerId: String(p._id),
            name: p.name,
            port: h.port,
            portType: h.portType,
            ipAddress: h.ipAddress,
            tcpPort: h.tcpPort,
            status: isFresh(h, now) ? h.status : "offline",
          }))
      ),
    }))
  );
}
