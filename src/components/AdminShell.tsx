"use client";

import { useState } from "react";
import AdminNav from "@/components/AdminNav";
import AdminTopBar from "@/components/AdminTopBar";
import { LEX_FONT, PAGE_BG } from "@/components/lexical/ui";

/** Lexical-style admin frame: vertical nav (left) + floating top navbar + content. */
export default function AdminShell({
  userName,
  role,
  children,
}: {
  userName: string;
  role: string;
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-1" style={{ fontFamily: LEX_FONT, background: PAGE_BG }}>
      {/* Public Sans — same font Lexical Software uses (React 19 hoists this into <head>) */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;800&display=swap"
        precedence="default"
      />
      <AdminNav role={role} open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col pt-16">
        <AdminTopBar userName={userName} role={role} onMenu={() => setNavOpen(true)} />
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-6">{children}</main>
        <footer className="px-6 pb-5 text-center text-xs text-slate-900/40">
          QRtoPrint · Shop Dashboard
        </footer>
      </div>
    </div>
  );
}
