import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { customerUrl } from "@/lib/shop";

export const runtime = "nodejs";

/** GET /api/qr — returns a PNG QR code that links to the customer upload page */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const shop = await Shop.findOne({ shopId: session.shopId }).select("slug").lean();
  const targetUrl = customerUrl(session.shopId, shop?.slug);

  const pngBuffer = await QRCode.toBuffer(targetUrl, {
    type: "png",
    width: 480,
    margin: 2,
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  return new NextResponse(new Uint8Array(pngBuffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
