import { serverError } from "@/lib/apiError";
import { NextRequest, NextResponse } from "next/server";
import { uploadFile } from "@/lib/storage";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES } from "@/lib/uploadRules";

export const runtime = "nodejs";


/**
 * POST /api/upload
 * Accepts a multipart/form-data file, saves it (local disk by default),
 * and returns the download URL + storage key to be attached to the order.
 *
 * Size/type are validated here, not just via the <input accept> on the
 * client — that attribute is just a UI hint and anyone can POST any file
 * directly to this endpoint.
 *
 * NOTE: If the file can't be saved (e.g. read-only hosting), this route
 * returns a clear error so the frontend can show a helpful message
 * instead of failing silently.
 */
export async function POST(req: NextRequest) {
  // Public endpoint that writes files to storage — throttle scripted abuse
  // (generous: a shop's customers often share one WiFi IP).
  const { ok } = rateLimit(`upload:${getClientIp(req)}`, 40, 5 * 60 * 1000);
  if (!ok) {
    return NextResponse.json({ error: "Too many uploads from this network — please wait a few minutes." }, { status: 429 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "File is too large — max size is 25MB" }, { status: 413 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Only PDF, Word (.doc/.docx), ZIP, JPEG, and PNG files are accepted" },
        { status: 415 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { key, url } = await uploadFile(buffer, file.name, file.type || "application/octet-stream");

    return NextResponse.json({ fileKey: key, fileUrl: url, fileName: file.name });
  } catch (err) {
    return serverError(err, "Upload failed");
  }
}
