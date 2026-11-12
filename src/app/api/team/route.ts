import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { getSession } from "@/lib/session";
import { hashPassword, type SessionPayload } from "@/lib/auth";
import { serverError } from "@/lib/apiError";

export const runtime = "nodejs";

const MAX_STAFF = 3;

const createSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
});

/** The signed-in owner, or the ready-made error response to return. */
async function ownerSession(): Promise<SessionPayload | NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "Only the shop owner can manage the team" }, { status: 403 });
  return session;
}

/** GET /api/team - everyone who can log in to this shop's dashboard (owner only). */
export async function GET() {
  const session = await ownerSession();
  if (session instanceof NextResponse) return session;
  try {
    await connectDB();
    const members = await User.find({ shopId: session.shopId }).select("name email role createdAt").sort({ role: 1, createdAt: 1 }).lean();
    return NextResponse.json({ members, max: MAX_STAFF });
  } catch (err) {
    return serverError(err, "Could not load the team");
  }
}

/** POST /api/team - the owner adds a staff login. Staff see the queue, printers and orders, but not settings or refunds. */
export async function POST(req: Request) {
  const session = await ownerSession();
  if (session instanceof NextResponse) return session;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid details" }, { status: 400 });
  }
  try {
    await connectDB();
    if ((await User.countDocuments({ shopId: session.shopId, role: "staff" })) >= MAX_STAFF) {
      return NextResponse.json({ error: `You can add up to ${MAX_STAFF} staff logins.` }, { status: 400 });
    }
    const user = await User.create({
      shopId: session.shopId,
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      role: "staff",
    });
    return NextResponse.json({ _id: user._id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt }, { status: 201 });
  } catch (err) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "That email already has an account." }, { status: 409 });
    }
    return serverError(err, "Could not add the staff login");
  }
}
