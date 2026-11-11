import { serverError } from "@/lib/apiError";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { Printer } from "@/models/Printer";
import { Agent } from "@/models/Agent";
import { getAgentShopId } from "@/lib/agentAuth";
import { aggregateStatus, HOST_STALE_MS, withVersionRetry } from "@/lib/printerHosts";

export const runtime = "nodejs";

const str = (max: number) => z.string().trim().max(max).optional();

const schema = z.object({
  // Which computer is reporting (new agents). Old agents omit this and keep the legacy behaviour.
  agent: z
    .object({
      id: z.string().trim().min(8).max(100),
      hostname: z.string().trim().max(100).default(""),
      username: str(100),
      manufacturer: str(100),
      model: str(100),
      os: str(100),
      appVersion: str(30),
    })
    .optional(),
  printers: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        port: str(200),
        portType: str(60),
        ipAddress: str(100),
        tcpPort: z.number().int().min(0).max(65535).optional(),
        driver: str(200),
        // Windows reports whether the printer can print colour. Omitted by old agents / when Windows can't tell.
        colorCapable: z.boolean().nullish(),
      })
    )
    .max(50),
});

/**
 * POST /api/agent/printers/sync
 * The Print Agent reports every (real) printer installed on its computer, and which computer it is.
 *  - New printers are created automatically (type "bw" when Windows says it can't print colour, otherwise "both"; A4/Legal/Letter) — staff can then adjust type /
 *    loaded paper sizes on Admin → Printers.
 *  - Printers already known keep whatever staff configured.
 *  - With `agent` info, each printer remembers every computer it is installed on (name, model, port, IP…),
 *    so the dashboard can show which computer a printer belongs to when it's installed on several.
 *  - A printer missing from a report is only marked offline when no computer has reported it for 2+ minutes.
 * Responds with the dashboard printers so the agent can map IDs automatically.
 */
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

    const { agent } = parsed.data;
    const reported = new Map(parsed.data.printers.map((p) => [p.name, p]));
    const names = Array.from(reported.keys());
    const now = new Date();
    await connectDB();

    if (names.length > 0) {
      await Printer.bulkWrite(
        names.map((name) => {
          const cc = reported.get(name)?.colorCapable; // true / false when Windows told us, otherwise undefined / null
          return {
          updateOne: {
            filter: { shopId, systemPrinterName: name },
            update: {
              // With agent info the status is computed from the computers below; legacy agents set it directly.
              $set: {
                ...(agent ? { lastSeenAt: now } : { status: "online", lastSeenAt: now }),
                ...(typeof cc === "boolean" ? { colorCapable: cc } : {}),
              },
              $setOnInsert: {
                shopId,
                name,
                systemPrinterName: name,
                // A printer Windows says is B&W only starts as "B&W only" (everything else: "B&W + Color").
                type: cc === false ? ("bw" as const) : ("both" as const),
                supportedPaperSizes: ["A4", "Legal", "Letter"],
                ordersPrintedToday: 0,
                ...(agent ? { status: "online" } : {}),
              },
            },
            upsert: true,
          },
          };
        })
      );
    }

    if (agent) {
      await Agent.updateOne(
        { shopId, agentId: agent.id },
        {
          $set: {
            hostname: agent.hostname,
            username: agent.username,
            manufacturer: agent.manufacturer,
            model: agent.model,
            os: agent.os,
            appVersion: agent.appVersion,
            lastSeenAt: now,
          },
          $setOnInsert: { shopId, agentId: agent.id },
        },
        { upsert: true }
      );

      // Refresh this computer's entry on every printer it reported.
      const docs = await Printer.find({ shopId, systemPrinterName: { $in: names } });
      for (const doc of docs) {
        await withVersionRetry<typeof doc>(
          async () => Printer.findOne({ _id: doc._id, shopId }),
          async (latest) => {
            if (!latest) return;
            const p = reported.get(latest.systemPrinterName)!;
            const existing = latest.hosts.find((h) => h.agentId === agent.id);
            const host = {
              agentId: agent.id,
              hostname: agent.hostname,
              username: agent.username,
              manufacturer: agent.manufacturer,
              model: agent.model,
              port: p.port,
              portType: p.portType,
              ipAddress: p.ipAddress,
              tcpPort: p.tcpPort || undefined,
              driver: p.driver,
              // keep the health the heartbeat last reported; a brand-new entry starts as online
              status: existing?.status ?? "online",
              lastSeenAt: now,
            };
            latest.hosts = [...latest.hosts.filter((h) => h.agentId !== agent.id), host];
            const agg = aggregateStatus(latest.hosts, now);
            latest.status = agg.status;
            latest.lastSeenAt = agg.lastSeenAt ?? now;
            await latest.save();
          }
        );
      }

      // Printers this computer no longer has: drop its entry and recompute.
      const gone = await Printer.find({ shopId, systemPrinterName: { $nin: names }, "hosts.agentId": agent.id });
      for (const doc of gone) {
        await withVersionRetry<typeof doc>(
          async () => Printer.findOne({ _id: doc._id, shopId }),
          async (latest) => {
            if (!latest) return;
            latest.hosts = latest.hosts.filter((h) => h.agentId !== agent.id);
            latest.status = aggregateStatus(latest.hosts, now).status;
            await latest.save();
          }
        );
      }

      // Forget computers that haven't reported for a week (retired PCs).
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      await Printer.updateMany({ shopId, "hosts.lastSeenAt": { $lt: weekAgo } }, { $pull: { hosts: { lastSeenAt: { $lt: weekAgo } } } });
      await Agent.deleteMany({ shopId, lastSeenAt: { $lt: weekAgo } });
    }

    // A printer missing from THIS agent's list is only marked offline if nobody has reported it recently.
    const staleBefore = new Date(now.getTime() - HOST_STALE_MS);
    await Printer.updateMany(
      {
        shopId,
        systemPrinterName: { $nin: names },
        status: { $ne: "offline" },
        $or: [{ lastSeenAt: { $lt: staleBefore } }, { lastSeenAt: { $exists: false } }],
      },
      { $set: { status: "offline" } }
    );

    const printers = await Printer.find({ shopId }).select("systemPrinterName type").lean();
    return NextResponse.json(
      printers.map((p) => ({ id: String(p._id), systemPrinterName: p.systemPrinterName, type: p.type }))
    );
  } catch (err) {
    return serverError(err, "Failed to sync printers");
  }
}
