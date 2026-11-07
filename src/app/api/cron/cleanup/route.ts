import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { runCleanup } from "@/lib/fileCleanup";
import { serverError } from "@/lib/apiError";

export const runtime = "nodejs";

const same = (a: string, b: string) => {
  const x = crypto.createHash("sha256").update(a).digest();
  const y = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(x, y);
};

/**
 * GET /api/cron/cleanup - deletes customer files that are no longer needed (see lib/fileCleanup.ts).
 * Call it from a scheduler (e.g. Vercel Cron, every hour) with the header  Authorization: Bearer <CRON_SECRET>.
 * Disabled until CRON_SECRET is set.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!same(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    return NextResponse.json({ ok: true, ...(await runCleanup()) });
  } catch (err) {
    return serverError(err, "Cleanup failed");
  }
}
