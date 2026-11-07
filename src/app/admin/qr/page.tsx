"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card } from "@/components/lexical/ui";

interface ShopInfo {
  name: string;
  slug: string;
  url: string;
}

export default function QrPage() {
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [qrUrl] = useState(() => `/api/qr?t=${Date.now()}`);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/shop", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setShop({ name: d.name || "", slug: d.slug || "", url: d.url || window.location.origin }))
      .catch(() => setShop({ name: "", slug: "", url: window.location.origin }));
  }, []);

  async function copyLink() {
    if (!shop) return;
    try {
      await navigator.clipboard.writeText(shop.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: the link is still selectable on screen
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      {/* print: only the poster, no sidebar or top bar */}
      <style>{`@media print { header, aside, nav, footer, .no-print { display: none !important; } main { padding: 0 !important; } div.pt-16 { padding-top: 0 !important; } .poster { border: 0 !important; box-shadow: none !important; } }`}</style>

      <Card className="poster">
        <div className="flex flex-col items-center px-6 py-8 text-center">
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900/90">{shop?.name || "Scan to print"}</h2>
          <p className="mt-1 text-sm text-slate-900/60">Scan, upload your file, pay and collect.</p>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG from our own API */}
            <img src={qrUrl} alt="Shop QR code" className="h-64 w-64" />
          </div>

          <div className="mt-5 break-all text-sm font-semibold text-slate-900/80">{shop ? shop.url.replace(/^https?:\/\//, "") : " "}</div>
        </div>
      </Card>

      <div className="no-print space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outlined" onClick={copyLink} disabled={!shop}>
            {copied ? "Link copied" : "Copy link"}
          </Button>
          <Button variant="outlined" onClick={() => window.print()}>
            Print
          </Button>
        </div>
        <a
          href={qrUrl}
          download="shop-qr.png"
          className="flex w-full items-center justify-center rounded-lg bg-[color:var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition active:brightness-95"
        >
          Download QR image
        </a>

        {shop && !shop.slug && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800">
            This link uses your fixed shop code, so it never changes. Want a short readable one? Pick it in{" "}
            <Link href="/admin/settings" className="font-semibold underline">
              Settings
            </Link>
            . QR codes you printed earlier keep working.
          </p>
        )}
        <p className="text-center text-xs text-slate-900/50">Print it at A5 or bigger and stick it where customers can see it.</p>
      </div>
    </div>
  );
}
