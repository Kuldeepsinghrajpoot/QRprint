import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { LOCAL_UPLOAD_DIR } from "@/lib/storage";

export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".zip": "application/zip",
};

const INLINE = new Set([".pdf", ".png", ".jpg", ".jpeg"]);

/** GET /api/files/orders/<file> — serves files saved on the local disk (the default storage). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const rel = key.join("/");
  const full = path.resolve(LOCAL_UPLOAD_DIR, rel);
  if (!/^orders\/[A-Za-z0-9._-]+$/.test(rel) || !full.startsWith(LOCAL_UPLOAD_DIR + path.sep)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const data = await fs.readFile(full);
    const ext = path.extname(full).toLowerCase();
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPES[ext] || "application/octet-stream",
        // PDFs and images open in the browser; Word/ZIP files are downloaded, never rendered.
        "Content-Disposition": `${INLINE.has(ext) ? "inline" : "attachment"}; filename="${path.basename(full).replace(/"/g, "")}"`,
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex",
        "Referrer-Policy": "no-referrer",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
