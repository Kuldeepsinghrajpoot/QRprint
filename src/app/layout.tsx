import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { PALETTE_INIT_SCRIPT } from "@/lib/palettes";
import { publicSans } from "@/components/landing/fonts";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.qr.lexicalsoftware.in";
const DESCRIPTION =
  "QRtoPrint: customers scan the shop QR code, upload a file from their phone, pay by UPI and the print comes out automatically. Software for cyber cafes, xerox shops and CSC centers.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "QRtoPrint | Scan, Upload & Print", template: "%s" },
  description: DESCRIPTION,
  applicationName: "QRtoPrint",
  keywords: ["print via QR", "QR printing", "online printing", "xerox shop software", "cyber cafe software", "print shop order system", "upload and print"],
  authors: [{ name: "Lexical Software", url: "https://lexicalsoftware.in" }],
  creator: "Lexical Software",
  openGraph: { type: "website", siteName: "QRtoPrint", title: "QRtoPrint | Scan, Upload & Print", description: DESCRIPTION, locale: "en_IN" },
  twitter: { card: "summary", title: "QRtoPrint | Scan, Upload & Print", description: DESCRIPTION },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <Script
          id="palette-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: PALETTE_INIT_SCRIPT }}
        />
      </head>
      <body className={`${publicSans.className} min-h-full flex flex-col`}>{children}</body>
    </html>
  );
}
