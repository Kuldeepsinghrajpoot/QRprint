import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { isShopHost } from "@/lib/shopUrl";

export async function proxy(req: NextRequest) {
  // Shop sub-addresses (ravi-xerox.qr.lexicalsoftware.in) only serve the customer pages. The dashboard, login and
  // sign-up live on the main address, so send anyone who lands on them from a shop address there.
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(":")[0];
  const path = req.nextUrl.pathname;
  if (isShopHost(host) && (path.startsWith("/admin") || path === "/login" || path === "/signup")) {
    const main = process.env.NEXT_PUBLIC_APP_URL;
    if (main) return NextResponse.redirect(new URL(path + req.nextUrl.search, main));
  }

  if (!path.startsWith("/admin")) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login", "/signup"],
};
