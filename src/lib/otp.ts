import { createHmac, randomInt, timingSafeEqual } from "crypto";

export const OTP_TTL_MS = 10 * 60 * 1000; // a code works for 10 minutes
export const OTP_RESEND_MS = 60 * 1000; // at most one new code per minute
export const OTP_MAX_ATTEMPTS = 5; // wrong guesses before the code is thrown away

const secret = () => process.env.JWT_SECRET || "dev-only-insecure-secret-change-in-production";

/** A random 6-digit code from a cryptographic source, e.g. "048213". */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtp(email: string, code: string): string {
  return createHmac("sha256", secret()).update(`${email.toLowerCase()}:${code}`).digest("hex");
}

export function otpMatches(email: string, code: string, hash: string): boolean {
  const a = Buffer.from(hashOtp(email, code), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
