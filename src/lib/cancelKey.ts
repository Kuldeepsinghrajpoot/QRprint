import crypto from "crypto";

/** Secret the customer's browser gets when the order is placed; needed to cancel that order. Only its hash is stored. */
export const newCancelKey = (): string => crypto.randomBytes(16).toString("hex");

export const hashCancelKey = (key: string): string => crypto.createHash("sha256").update(key).digest("hex");

export function cancelKeyMatches(key: string | undefined, storedHash: string | undefined): boolean {
  if (!key || !storedHash) return false;
  const a = Buffer.from(hashCancelKey(key));
  const b = Buffer.from(storedHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
