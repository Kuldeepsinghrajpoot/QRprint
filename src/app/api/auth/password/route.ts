import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { getSession } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { serverError } from "@/lib/apiError";

export const runtime = "nodejs";

const schema = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(100),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(100),
});

/** PATCH /api/auth/password { currentPassword, newPassword } - the logged-in user changes their own password. */
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid password" }, { status: 400 });
  const { currentPassword, newPassword } = parsed.data;
  if (currentPassword === newPassword) {
    return NextResponse.json({ error: "New password must be different from the current one" }, { status: 400 });
  }
  try {
    await connectDB();
    const user = await User.findOne({ _id: session.userId, shopId: session.shopId });
    if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: "Current password is wrong" }, { status: 400 });
    }
    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, "Could not change the password");
  }
}
