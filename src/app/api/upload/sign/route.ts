import { serverError } from "@/lib/apiError";
import { NextRequest, NextResponse } from "next/server";
import { createSignedUpload, isDirectUploadEnabled } from "@/lib/storage";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES } from "@/lib/uploadRules";

export const runtime = "nodejs";

/**
 * POST /api/upload/sign   { fileName, fileType, fileSize }
 *
 * With Supabase configured, returns a signed URL so the browser uploads the file DIRECTLY to storage
 * (no Vercel 4.5 MB request-body limit). Otherwise returns { direct: false } and the client falls back
 * to the classic multipart POST /api/upload.
 */
export async function POST(req: NextRequest) {
  const { ok } = rateLimit(`upload-sign:${getClientIp(req)}`, 40, 5 * 60 * 1000);
  if (!ok) {
    return NextResponse.json({ error: "Too many uploads from this network — please wait a few minutes." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
    const fileType = typeof body.fileType === "string" ? body.fileType : "";
    const fileSize = Number(body.fileSize);

    if (!fileName || fileName.length > 200) {
      return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.has(fileType)) {
      return NextResponse.json(
        { error: "Only PDF, Word (.doc/.docx), ZIP, JPEG, and PNG files are accepted" },
        { status: 415 }
      );
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "File is too large — max size is 25MB" }, { status: 413 });
    }

    if (!isDirectUploadEnabled()) {
      return NextResponse.json({ direct: false });
    }

    const { key, signedUrl, url } = await createSignedUpload(fileName);
    return NextResponse.json({ direct: true, key, signedUrl, fileUrl: url, fileName });
  } catch (err) {
    return serverError(err, "Could not start the upload");
  }
}
