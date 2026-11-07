import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { getSession } from "@/lib/session";
import { hashPassword } from "@/lib/auth";
import { serverError } from "@/lib/apiError";

export const runtime = "nodejs";

type StaffDoc = NonNullable<Awaited<ReturnType<typeof User.findOne>>>;

/** The staff member to act on, or the ready-made error response to return. */
async function guard(params: Promise<{ id: string }>): Promise<StaffDoc | NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "Only the shop owner can manage the team" }, { status: 403 });
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await connectDB();
  // Only staff of this shop: an owner login can never be changed or removed from here.
  const member = await User.findOne({ _id: id, shopId: session.shopId, role: "staff" });
  if (!member) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
  return member;
}

/** PATCH /api/team/:id { password } - owner sets a new password for a staff login. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await guard(params);
  if (member instanceof NextResponse) return member;
  const parsed = z.object({ password: z.string().min(8, "Password must be at least 8 characters").max(100) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid password" }, { status: 400 });
  try {
    member.passwordHash = await hashPassword(parsed.data.password);
    await member.save();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, "Could not change the password");
  }
}

/** DELETE /api/team/:id - owner removes a staff login. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await guard(params);
  if (member instanceof NextResponse) return member;
  try {
    await member.deleteOne();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, "Could not remove the staff login");
  }
}
