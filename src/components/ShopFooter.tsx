"use client";

import { useEffect, useState } from "react";
import LegalLinks from "@/components/landing/LegalLinks";
import PoweredBy from "@/components/PoweredBy";

type Info = { name: string; email: string; phone: string; address: string };

/**
 * Footer of a shop's customer page: the shop's name and business details (saved by the owner in Settings),
 * links to that shop's own policy pages, and "Powered by". `shop` is the slug or id; `base` is where the policies live.
 */
export default function ShopFooter({ shop, base }: { shop: string; base: string }) {
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    if (!shop) return;
    let live = true;
    fetch(`/api/shop/public?shop=${encodeURIComponent(shop)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live && d) setInfo(d);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [shop]);

  return (
    <footer className="mt-6 border-t border-slate-200 px-2 pt-5 text-center text-xs text-slate-900/60">
      {info && (info.address || info.phone || info.email) && (
        <div className="mb-4 space-y-1">
          {info.name && <p className="text-[13px] font-semibold text-slate-900/80">{info.name}</p>}
          {info.address && <p className="whitespace-pre-line">{info.address}</p>}
          {(info.phone || info.email) && (
            <p>
              {info.phone && <a href={`tel:${info.phone}`} className="hover:underline">{info.phone}</a>}
              {info.phone && info.email && " · "}
              {info.email && <a href={`mailto:${info.email}`} className="hover:underline">{info.email}</a>}
            </p>
          )}
        </div>
      )}
      <LegalLinks base={base} />
      <PoweredBy className="mt-2" />
    </footer>
  );
}
