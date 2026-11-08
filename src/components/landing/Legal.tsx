import Image from "next/image";
import Link from "next/link";
import { SITE } from "./site";
import { publicSans } from "./fonts";
import { LEGAL_UPDATED, type LegalSection } from "./legalContent";
import PoweredBy from "@/components/PoweredBy";

export default function Legal({ title, sections }: { title: string; sections: LegalSection[] }) {
  return (
    <div className={`landing ${publicSans.variable} font-landing min-h-screen bg-paper text-ink antialiased`}>
      <header className="border-b border-ink/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2.5 font-display text-xl font-extrabold text-brand">
            <Image src="/chhapo-logo.svg" alt="" width={32} height={32} />
            {SITE.name}
          </Link>
          <Link href="/" className="text-sm font-semibold hover:text-brand">Back to home</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-14">
        <h1 className="font-display text-4xl font-extrabold">{title}</h1>
        <p className="mt-2 text-sm text-ink/60">Last updated {LEGAL_UPDATED}</p>
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
      </main>
      <footer className="border-t border-ink/10 py-6">
        <PoweredBy />
      </footer>
    </div>
  );
}
