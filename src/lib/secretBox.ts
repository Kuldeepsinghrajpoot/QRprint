import crypto from "crypto";

/**
 * Encrypts a short secret (like a payment gateway key) before it is saved in the database, so a leaked database
 * copy does not leak the key. AES-256-GCM; the encryption key comes from SECRET_ENCRYPTION_KEY, or JWT_SECRET.
 */
const DEV_FALLBACK = "dev-only-insecure-secret-change-in-production";

/** In production a real secret is required: a missing or example value would make the encryption pointless. */
export function encryptionKeyProblem(): string | null {
  const v = process.env.SECRET_ENCRYPTION_KEY || process.env.JWT_SECRET || "";
  if (process.env.NODE_ENV !== "production") return null;
  if (!v || v === DEV_FALLBACK || /^change-this/i.test(v) || v.length < 24) {
    return "The server has no strong SECRET_ENCRYPTION_KEY (or JWT_SECRET) set, so payment keys cannot be stored safely. Set a long random value and redeploy.";
  }
  return null;
}

const keyBytes = () => {
  const problem = encryptionKeyProblem();
  if (problem) throw new Error(problem);
  return crypto
    .createHash("sha256")
    .update(process.env.SECRET_ENCRYPTION_KEY || process.env.JWT_SECRET || DEV_FALLBACK)
    .digest();
};

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

/** Returns null if the value is missing, was tampered with, or the encryption key has changed. */
export function decryptSecret(packed: string | undefined | null): string | null {
  if (!packed) return null;
  try {
    const key = keyBytes();
    const [iv, tag, enc] = packed.split(".").map((p) => Buffer.from(p, "base64"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
