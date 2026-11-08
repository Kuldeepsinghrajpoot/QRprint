import type { Metadata } from "next";
import "./globals.css";
import { PALETTE_INIT_SCRIPT } from "@/lib/palettes";

export const metadata: Metadata = {
  title: "QRtoPrint — Upload & Print",
  description: "Scan the shop QR, upload your file, and get it printed instantly.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PALETTE_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
