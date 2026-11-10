import Link from "next/link";

/** The four policy pages. One list so the landing page, the legal pages and every shop page link to the same set. */
export const LEGAL_LINKS = [
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Refund & Cancellation", href: "/refund-policy" },
  { label: "Pricing & Services", href: "/pricing" },
] as const;

/**
 * `base` is "" for the QRtoPrint pages. On a shop's pages it is the shop's path ("/pradeepcsc"), or "" on the shop's
 * own sub-address, so each link opens that shop's own policy.
 */
export default function LegalLinks({ className = "", light = false, base = "" }: { className?: string; light?: boolean; base?: string }) {
  return (
    <nav
      aria-label="Policies"
      className={`flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs ${light ? "text-white/70" : "text-slate-900/50"} ${className}`}
    >
      {LEGAL_LINKS.map((l) => (
        <Link key={l.href} href={`${base}${l.href}`} className="hover:underline">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
