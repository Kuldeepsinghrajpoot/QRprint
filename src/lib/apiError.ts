import { NextResponse } from "next/server";

/**
 * Safe 500 response: the full error goes to the server log, the browser gets a short generic message
 * (raw error text can expose database or storage details). In development the real message is shown to help debugging.
 */
export function serverError(err: unknown, fallback: string, status = 500) {
  console.error(`[api] ${fallback}:`, err);
  const detail = process.env.NODE_ENV !== "production" && err instanceof Error ? err.message : fallback;
  return NextResponse.json({ error: detail }, { status });
}
