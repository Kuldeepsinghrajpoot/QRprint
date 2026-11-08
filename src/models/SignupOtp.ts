import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * A sign-up waiting for its email code. The account is NOT created until the code is entered,
 * so nobody can register with an address they don't own. Documents delete themselves when `expiresAt` passes.
 */
export interface ISignupOtp extends Document {
  email: string;
  codeHash: string; // HMAC of the 6-digit code, never the code itself
  attempts: number; // wrong guesses so far
  resendAt: Date; // earliest time another code may be sent
  expiresAt: Date;
  name: string;
  shopName: string;
  slug: string;
  passwordHash: string; // already bcrypt-hashed, the plain password is never stored
}

const SignupOtpSchema = new Schema<ISignupOtp>({
  email: { type: String, required: true, unique: true, lowercase: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  resendAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  name: { type: String, required: true },
  shopName: { type: String, required: true },
  slug: { type: String, required: true },
  passwordHash: { type: String, required: true },
});

export const SignupOtp: Model<ISignupOtp> = mongoose.models.SignupOtp || mongoose.model<ISignupOtp>("SignupOtp", SignupOtpSchema);
