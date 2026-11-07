import { serverError } from "@/lib/apiError";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { Printer } from "@/models/Printer";
import { getAgentShopId } from "@/lib/agentAuth";
import { aggregateStatus } from "@/lib/printerHosts";

export const runtime = "nodejs";

const schema = z.object({
  status: z.enum(["online", "offline", "paper_jam", "low_ink", "out_of_paper"]),
  // Which computer is reporting (new agents). Lets one printer installed on several computers keep a status per computer.
  agentId: z.string().trim().min(8).max(100).optional(),
});

/**
 * PATCH /api/printers/:id/status
 * The Electron Print Agent calls this periodically (heartbeat) so the
 * shop dashboard shows real-time printer health (online/offline/jam/etc.).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const shopId = await getAgentShopId(req);
  if (!shopId) {
    return NextResponse.json({ error: "Invalid or missing agent key" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await connectDB();
    const { status, agentId } = parsed.data;
    const now = new Date();

    const printer = await Printer.findOne({ _id: id, shopId });
    if (!printer) return NextResponse.json({ error: "Printer not found" }, { status: 404 });

    const host = agentId ? printer.hosts.find((h) => h.agentId === agentId) : undefined;
    if (host) {
      // Per-computer status; the printer's overall status is derived from all its computers.
      host.status = status;
      host.lastSeenAt = now;
      const agg = aggregateStatus(printer.hosts, now);
      printer.status = agg.status;
      printer.lastSeenAt = agg.lastSeenAt ?? now;
    } else {
      printer.status = status;
      printer.lastSeenAt = now;
    }
    await printer.save();

    return NextResponse.json(printer);
  } catch (err) {
    return serverError(err, "Failed to update printer status");
  }
}
