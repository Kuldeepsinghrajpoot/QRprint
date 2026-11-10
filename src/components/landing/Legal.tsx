import Image from "next/image";
import Link from "next/link";
import { SITE } from "./site";
import { publicSans } from "./fonts";
import { LEGAL_UPDATED, type LegalSection } from "./legalContent";
import LegalLinks from "./LegalLinks";
import PoweredBy from "@/components/PoweredBy";

/**
 * One layout for every policy page. The QRtoPrint pages use the defaults; a shop's pages pass its name (`brand`),
 * the page to go back to (`homeHref`), the path its policy links live under (`linksBase`) and extra content
 * (`before` the sections, `after` them).
 */
export default function Legal({
  title,
  sections,
  brand,
  homeHref = "/",
  linksBase = "",
  before,
  after,
}: {
  title: string;
  sections: LegalSection[];
  brand?: string;
  homeHref?: string;
  linksBase?: string;
  before?: React.ReactNode;
  after?: React.ReactNode;
}) {
  return (
    <div className={`landing ${publicSans.variable} font-landing min-h-screen bg-paper text-ink antialiased`}>
      <header className="border-b border-ink/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <Link href={homeHref} className="flex min-w-0 items-center gap-2.5 font-display text-xl font-extrabold text-brand">
            {!brand && <Image src="/chhapo-logo.svg" alt="" width={32} height={32} />}
            <span className="truncate">{brand || SITE.name}</span>
          </Link>
          <Link href={homeHref} className="shrink-0 text-sm font-semibold hover:text-brand">{brand ? "Place an order" : "Back to home"}</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-14">
        <h1 className="font-display text-4xl font-extrabold">{title}</h1>
        <p className="mt-2 text-sm text-ink/60">Last updated {LEGAL_UPDATED}</p>
        {before}
        <div className="mt-10 space-y-8">
          {sections.map((s) => (
            <section key={s.h}>
              <h2 className="font-display text-xl font-bold">{s.h}</h2>
              {s.p.map((x) => (
                <p key={x} className="mt-2 leading-relaxed text-ink/80">{x}</p>
              ))}
            </section>
          ))}
        </div>
        {after}
      </main>
      <footer className="border-t border-ink/10 py-6">
        <LegalLinks base={linksBase} className="mb-3 px-5" />
        <PoweredBy />
      </footer>
    </div>
  );
}
