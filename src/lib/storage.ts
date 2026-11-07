import fs from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

/**
 * File storage for customer uploads.
 *
 * DEFAULT — local disk: files are saved in LOCAL_UPLOAD_DIR (default ./.local-uploads), served by
 * /api/files/... and deleted automatically once the order is collected/cancelled. No cloud account needed.
 * Requires the app to run on a PC/server with a normal (persistent) disk — not Vercel/serverless.
 *
 * OPTIONAL — Supabase Storage (free, no card): set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * if you host somewhere without a persistent disk.
 */

/** Strips stray spaces/quotes that often sneak in when pasting values into .env.local. */
function cleanEnv(v?: string): string {
  return (v ?? "").trim().replace(/^["']|["']$/g, "");
}

export const LOCAL_UPLOAD_DIR = cleanEnv(process.env.LOCAL_UPLOAD_DIR)
  ? path.resolve(cleanEnv(process.env.LOCAL_UPLOAD_DIR))
  : path.join(process.cwd(), ".local-uploads");

function localUrl(key: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/files/${key}`;
}

/** Absolute path for a storage key, or null if the key tries to escape the upload folder. */
function localPath(key: string): string | null {
  const full = path.resolve(LOCAL_UPLOAD_DIR, key);
  return full.startsWith(LOCAL_UPLOAD_DIR + path.sep) ? full : null;
}

/* ───────────── Optional: Supabase Storage ───────────── */

function isSupabaseConfigured(): boolean {
  const url = cleanEnv(process.env.SUPABASE_URL);
  const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return Boolean(url && key && !url.startsWith("your_") && !key.startsWith("your_"));
}

const sbBucket = () => cleanEnv(process.env.SUPABASE_BUCKET) || "qrtoprint-files";
const sbBase = () => cleanEnv(process.env.SUPABASE_URL).replace(/\/+$/, "");
const sbKey = () => cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Auth headers for Supabase's server-side calls. New-style keys (sb_secret_...) are NOT JWTs and must be
 * sent ONLY in the `apikey` header — putting them in `Authorization: Bearer` gives "Invalid Compact JWS".
 * Legacy keys (service_role, starts with eyJ...) are JWTs and go in both headers.
 */
function sbAuthHeaders(): Record<string, string> {
  const key = sbKey();
  if (key.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is the *publishable* key. Use the secret key (sb_secret_...) or the legacy service_role key from Supabase → Project Settings → API."
    );
  }
  return key.startsWith("sb_") ? { apikey: key } : { Authorization: `Bearer ${key}`, apikey: key };
}

/** Bucket must be PUBLIC so the Print Agent can download by URL (names are random, not guessable). */
function supabasePublicUrl(key: string): string {
  return `${sbBase()}/storage/v1/object/public/${sbBucket()}/${key}`;
}

async function supabaseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.message || body.error || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

/* ───────────── Public API ───────────── */

function makeKey(fileName: string): string {
  return `orders/${Date.now()}-${randomBytes(6).toString("hex")}-${fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
}

/** True when uploads can go browser -> Supabase directly (skips Vercel's 4.5 MB request-body limit). */
export function isDirectUploadEnabled(): boolean {
  return isSupabaseConfigured();
}

/**
 * Creates a one-time signed upload URL so the browser can PUT the file straight to Supabase Storage.
 * The service-role key never leaves the server.
 */
export async function createSignedUpload(fileName: string): Promise<{ key: string; signedUrl: string; url: string }> {
  const key = makeKey(fileName);
  const res = await fetch(`${sbBase()}/storage/v1/object/upload/sign/${sbBucket()}/${key}`, {
    method: "POST",
    headers: { ...sbAuthHeaders(), "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error(`Supabase could not create an upload link: ${await supabaseErrorMessage(res)}`);
  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error("Supabase did not return an upload link");
  const signedUrl = data.url.startsWith("http") ? data.url : `${sbBase()}/storage/v1${data.url}`;
  return { key, signedUrl, url: supabasePublicUrl(key) };
}

/** Saves an uploaded file and returns its storage key + the URL the Print Agent/staff download it from. */
export async function uploadFile(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const key = makeKey(fileName);

  if (isSupabaseConfigured()) {
    const res = await fetch(`${sbBase()}/storage/v1/object/${sbBucket()}/${key}`, {
      method: "POST",
      headers: { ...sbAuthHeaders(), "Content-Type": contentType },
      body: new Uint8Array(fileBuffer),
    });
    if (!res.ok) throw new Error(`Supabase upload failed: ${await supabaseErrorMessage(res)}`);
    return { key, url: supabasePublicUrl(key) };
  }

  // Vercel / AWS Lambda have no persistent, writable disk — fail early with a clear fix instead of "ENOENT mkdir /var/task/...".
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    throw new Error(
      "This host (Vercel/serverless) has no writable disk. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (and SUPABASE_BUCKET) in the Vercel project's Environment Variables — free, no card — then redeploy."
    );
  }

  try {
    await fs.mkdir(path.join(LOCAL_UPLOAD_DIR, "orders"), { recursive: true });
    await fs.writeFile(path.join(LOCAL_UPLOAD_DIR, key), fileBuffer);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EROFS" || code === "EACCES" || code === "EPERM" || code === "ENOENT") {
      throw new Error(
        "Can't save files on this server's disk (read-only hosting such as Vercel). Run the app on a PC/server with a normal disk, or set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for free cloud storage."
      );
    }
    throw err;
  }
  return { key, url: localUrl(key) };
}

/** Builds the public URL for a storage key server-side (never trust a client-sent URL). */
export function publicUrlForKey(key: string): string {
  return isSupabaseConfigured() ? supabasePublicUrl(key) : localUrl(key);
}

/** Upload keys look like orders/<13-digit ms timestamp>-<random>-<name>; only files with that shape are ever cleaned up. */
const OUR_FILE = /^\d{13}-/;

/** Lists the files currently in storage (name + upload time), for removing uploads that never became an order. */
export async function listStoredFiles(): Promise<{ key: string; createdAt: number }[]> {
  const timeOf = (name: string, fallback: number) => (OUR_FILE.test(name) ? Number(name.slice(0, 13)) : fallback);
  if (isSupabaseConfigured()) {
    const res = await fetch(`${sbBase()}/storage/v1/object/list/${sbBucket()}`, {
      method: "POST",
      headers: { ...sbAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "orders", limit: 1000, offset: 0, sortBy: { column: "created_at", order: "asc" } }),
    });
    if (!res.ok) throw new Error(`Supabase list failed: ${await supabaseErrorMessage(res)}`);
    const rows = (await res.json()) as { name?: string; created_at?: string }[];
    return rows
      .filter((r) => r.name && OUR_FILE.test(r.name))
      .map((r) => ({ key: `orders/${r.name}`, createdAt: timeOf(r.name!, Date.parse(r.created_at ?? "") || Date.now()) }));
  }
  const dir = path.join(LOCAL_UPLOAD_DIR, "orders");
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: { key: string; createdAt: number }[] = [];
  for (const name of names.filter((n) => OUR_FILE.test(n))) {
    const stat = await fs.stat(path.join(dir, name)).catch(() => null);
    out.push({ key: `orders/${name}`, createdAt: timeOf(name, stat?.mtimeMs ?? Date.now()) });
  }
  return out;
}

/** Deletes a stored file — used for the "auto-delete after collection" privacy feature. */
export async function deleteFile(key: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const res = await fetch(`${sbBase()}/storage/v1/object/${sbBucket()}/${key}`, {
      method: "DELETE",
      headers: { ...sbAuthHeaders() },
    });
    if (!res.ok && res.status !== 404) throw new Error(`Supabase delete failed: ${await supabaseErrorMessage(res)}`);
    return;
  }
  const full = localPath(key);
  if (full) await fs.rm(full, { force: true });
}
