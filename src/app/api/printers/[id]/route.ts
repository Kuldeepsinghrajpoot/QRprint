import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { Printer } from "@/models/Printer";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["bw", "color", "both"]).optional(),
  systemPrinterName: z.string().min(1).optional(),
  supportedPaperSizes: z.array(z.enum(["A4", "A3", "Legal", "Letter", "Photo"])).min(1).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await connectDB();
  const printer = await Printer.findOneAndUpdate({ _id: id, shopId: session.shopId }, parsed.data, { returnDocument: "after" });
  if (!printer) return NextResponse.json({ error: "Printer not found" }, { status: 404 });
  return NextResponse.json(printer);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();
  await Printer.deleteOne({ _id: id, shopId: session.shopId });
  return NextResponse.json({ ok: true });
}
