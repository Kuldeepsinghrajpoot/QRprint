import {
  Smartphone, Files, Printer, Route, IndianRupee, LayoutGrid, BellRing, ShieldCheck,
  Check, X, Plus, Coffee, Copy, Landmark, GraduationCap,
  Tag, QrCode, BarChart3, Languages, Trash2, MessageCircle, Mail, MapPin, Gift,
} from "./Icon";
import Image from "next/image";
import Link from "next/link";
import { SITE, PLANS } from "./site";
import { LEGAL_LINKS } from "./LegalLinks";
import { publicSans } from "./fonts";
import LoginModal from "./LoginModal";
import MobileMenu from "./MobileMenu";
import InstallGuide from "@/components/InstallGuide";
const AGENT_DOWNLOAD_URL = "https://github.com/Kuldeepsinghrajpoot/QR-printer-agent/releases/download/v1.0.12/QRtoPrint-Setup-1.0.12.exe"

const waReady = /^\d{10,15}$/.test(SITE.whatsapp); // hide WhatsApp button until a real number is set
const wa = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(`Hi, I'd like to know more about ${SITE.name}.`)}`;

const stepIcons = [QrCode, Files, IndianRupee, Printer];
const steps = [
  { t: "Scan your QR", d: "The customer scans the QR at your counter. Your upload page opens in the phone browser. No app, no login." },
  { t: "Upload and choose", d: "Up to 10 PDFs or photos. They pick size, B&W or colour, sides, copies and pages, and see the price before paying." },
  { t: "Pay by UPI or cash", d: "UPI goes straight to your own UPI ID. Or they pick pay at counter." },
  { t: "It prints by itself", d: "The job reaches the right printer. The customer gets an order number and collects the pages." },
];
const before = ["Files on WhatsApp, phone storage full", "Viruses from pen drives", "Customer documents left on your PC", "Queues and wrong prints at rush hour", "Explaining pages and prices to everyone"];
const after = ["Customers scan and upload on their own", "No pen drive, no WhatsApp", "Files deleted once the order is collected", "Many customers at once, no queue", "Price shown before they pay"];

const features = [
  { i: Smartphone, t: "No app for customers", d: "Works in Chrome, Safari or any phone browser." },
  { i: Files, t: "10 files per order", d: "PDFs and photos in one order, one payment. Page ranges like 1-3, 5." },
  { i: Printer, t: "Any Windows printer", d: "HP, Canon, Epson, Brother or a xerox machine, USB or network." },
  { i: Route, t: "Smart routing", d: "Each paper size and colour mode goes to the printer you choose." },
  { i: IndianRupee, t: "UPI direct, 0% cut", d: "Money goes to your UPI ID. We never touch it." },
  { i: LayoutGrid, t: "Photo layouts", d: "1, 2, 4, 6 or 9 photos on a page for passport-size prints." },
  { i: BellRing, t: "New-order alert", d: "A pop-up and sound for every order. Accept, edit or retry." },
  { i: ShieldCheck, t: "Auto-delete files", d: "No Aadhaar or marksheets left behind on your computer." },
  { i: Tag, t: "Your own rates", d: "Set the price per page for size, colour, sides and photo layouts." },
  { i: QrCode, t: "Ready QR poster", d: "Download a poster with your shop name and QR, ready to stick at the counter." },
  { i: BarChart3, t: "Daily earnings", d: "See today's orders, pages printed and money received in one view." },
  { i: Languages, t: "Hindi and English", d: "The customer upload page speaks the language your customers do." },
];

const who = [
  { i: Coffee, t: "Cyber cafes", d: "Handle exam-form and result-day rush without a queue." },
  { i: Copy, t: "Xerox shops", d: "Customers send files from the phone. You just hand over pages." },
  { i: Landmark, t: "CSC centers", d: "Documents arrive clean, get printed, and are gone." },
  { i: GraduationCap, t: "Colleges and libraries", d: "Self-service printing for notes and assignments." },
];

// Plans live in site.ts so /pricing shows the same numbers.
const plans = PLANS;

const faqs = [
  ["Do customers need to install an app?", "No. The upload page opens in the phone browser after scanning your QR."],
  ["Do I need a new Wi-Fi printer?", "No. Any printer installed on your Windows computer works, USB or network."],
  ["Who gets the customer's payment?", "You do. UPI goes to your UPI ID and cash is paid at the counter. 0% commission."],
  ["Where do customer files go?", "They are deleted as soon as the order is collected or cancelled."],
  ["What if the internet or PC is off?", "Orders wait in the queue and print when you are back online. Failed jobs can be retried."],
];

function Btn({ href, children, solid = true }: { href: string; children: React.ReactNode; solid?: boolean }) {
  return (
    <a href={href} className={`inline-flex items-center justify-center rounded-md px-6 py-3 font-semibold transition-colors ${solid ? "bg-brand text-white hover:bg-brand-dark" : "border-2 border-ink/15 text-ink hover:border-brand hover:text-brand"}`}>
      {children}
    </a>
  );
}

function PhoneMock() {
  return (
    <div className="relative mx-auto w-[300px] pb-16">
      <div className="relative z-10 rounded-[2.4rem] border-[9px] border-ink bg-white p-4 shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-ink/20" />
        <p className="font-display text-lg font-bold">Sharma Cyber Cafe</p>
        <p className="mb-3 text-xs text-ink/60">Upload and print</p>
        {["Admit_Card.pdf", "Exam_Form.pdf"].map((f) => (
          <div key={f} className="mb-2 flex items-center gap-3 rounded-xl bg-mist/70 p-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-[10px] font-bold text-white">PDF</span>
            <span className="text-sm"><b className="block font-semibold">{f}</b><i className="text-xs not-italic text-ink/60">2 pages, B&amp;W</i></span>
          </div>
        ))}
        <div className="my-3 flex gap-2 text-xs font-semibold">
          <span className="rounded-full bg-ink px-3 py-1 text-white">B&amp;W</span>
          <span className="rounded-full bg-mist px-3 py-1">Colour</span>
          <span className="rounded-full bg-mist px-3 py-1">2 copies</span>
        </div>
        <div className="flex items-center justify-between border-t border-dashed border-ink/20 pt-3">
          <span className="text-sm text-ink/60">Total</span><span className="font-display text-2xl font-bold">₹40</span>
        </div>
        <div className="mt-3 rounded-md bg-brand py-3 text-center font-semibold text-white">Pay with UPI</div>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-20 mx-auto h-14 w-[340px] -translate-x-5 rounded-md bg-ink">
        <div className="absolute inset-x-6 top-0 h-1.5 rounded-full bg-black" />
        <div className="absolute inset-x-10 top-1 h-24 overflow-hidden">
          <div className="paper-feed h-full rounded-b-md border border-ink/10 bg-white p-2 text-[9px] leading-tight text-ink/50 shadow">
            Order #214<br />Admit_Card.pdf<br />Printing on HP 1020
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className={`landing ${publicSans.variable} font-landing bg-paper text-ink antialiased`}>
      <div className="flex items-center justify-center gap-2 bg-sun px-5 py-2 text-center text-sm font-semibold text-ink"><Gift size={18} className="shrink-0" />Limited-time offer: everything is free. Sign up today and start printing.</div>
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <a href="#" className="flex items-center gap-2.5 font-display text-2xl font-extrabold text-brand"><Image src="/chhapo-logo.svg" alt="" width={36} height={36} />{SITE.name}</a>
          <nav className="hidden gap-7 text-sm font-medium md:flex">
            {[["How it works", "#how"], ["Features", "#features"], ["Pricing", "#pricing"], ["Install", "/print-agent"], ["FAQ", "#faq"]].map(([l, h]) => (
              <a key={h} href={h} className="hover:text-brand">{l}</a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <LoginModal />
            <span className="hidden sm:block"><Btn href="/signup">Start free</Btn></span>
            <MobileMenu />
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-14 md:grid-cols-[1.15fr_1fr] md:pt-20">
          <div>
            <p className="mb-4 inline-block rounded-full bg-mist px-4 py-1.5 text-sm font-medium text-brand-dark">For cyber cafes, xerox shops and CSC centers</p>
            <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              Customers print from their phone. You just hand over the pages.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink/70">
              Customers scan your QR, upload PDFs or photos, pay by UPI straight to you, and the print comes out on your printer. No WhatsApp, no pen drive, no queue.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Btn href="/signup">Start free today</Btn>
              <Btn href="#how" solid={false}>See how it works</Btn>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink/70">
              {["Free for a limited period", "No app for customers", "Any Windows printer", "0% commission"].map((x) => (
                <li key={x} className="flex items-center gap-1.5"><Check size={16} className="text-brand" />{x}</li>
              ))}
            </ul>
          </div>
          <PhoneMock />
        </section>

        <section id="how" className="bg-ink py-20 text-paper">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="max-w-2xl font-display text-4xl font-extrabold">Four steps from scan to print. Zero manual work.</h2>
            <ol className="mt-12 grid gap-8 md:grid-cols-4">
              {steps.map((s, i) => {
                const StepIcon = stepIcons[i];
                return (
                  <li key={s.t} className="border-t-2 border-sun pt-5">
                    <div className="flex items-center justify-between">
                      <span className="font-display text-3xl font-extrabold text-sun">{i + 1}</span>
                      <span className="grid h-11 w-11 place-items-center rounded-md bg-white/10 text-sun"><StepIcon size={22} /></span>
                    </div>
                    <h3 className="mt-3 text-xl font-bold">{s.t}</h3>
                    <p className="mt-2 text-paper/70">{s.d}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-5 py-20 md:grid-cols-2">
          <div className="rounded-md border-2 border-dashed border-ink/20 p-8">
            <h3 className="font-display text-2xl font-bold">Before {SITE.name}</h3>
            <ul className="mt-5 space-y-3">{before.map((b) => <li key={b} className="flex gap-3 text-ink/70"><X size={20} className="mt-0.5 shrink-0 text-red-600" />{b}</li>)}</ul>
          </div>
          <div className="rounded-md bg-brand p-8 text-white">
            <h3 className="font-display text-2xl font-bold">With {SITE.name}</h3>
            <ul className="mt-5 space-y-3">{after.map((a) => <li key={a} className="flex gap-3"><Check size={20} className="mt-0.5 shrink-0 text-sun" />{a}</li>)}</ul>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-5 pb-20">
          <h2 className="max-w-2xl font-display text-4xl font-extrabold">Everything a print counter needs, in one software.</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ i: Icon, t, d }) => (
              <div key={t} className="rounded-md bg-white p-6 ring-1 ring-ink/10 transition-shadow hover:shadow-lg">
                <span className="grid h-12 w-12 place-items-center rounded-md bg-mist text-brand"><Icon size={24} /></span>
                <h3 className="mt-4 text-lg font-bold">{t}</h3>
                <p className="mt-1 text-ink/70">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-mist py-16">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 md:grid-cols-[1fr_1.2fr]">
            <div>
              <h2 className="font-display text-3xl font-extrabold">The file is printed, then gone for good.</h2>
              <p className="mt-3 text-ink/70">Aadhaar cards, marksheets, bank papers. Customer trust comes first, so files are deleted as soon as the order is collected or cancelled.</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-sm font-semibold">
              {[
                { a: "Encrypted upload", b: "HTTPS", Icon: ShieldCheck },
                { a: "Printed", b: "Direct to printer", Icon: Printer },
                { a: "Deleted", b: "When collected", Icon: Trash2 },
              ].map(({ a, b, Icon }) => (
                <div key={a} className="rounded-md bg-white p-4 shadow-sm">
                  <Icon size={22} className="mx-auto mb-2 text-brand" />
                  <p>{a}</p>
                  <p className="mt-1 text-xs font-normal text-ink/60">{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="font-display text-4xl font-extrabold">Built for every print counter.</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {who.map(({ i: Icon, t, d }) => (
              <div key={t} className="rounded-md bg-white p-6 ring-1 ring-ink/10">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-sun/30 text-brand-dark"><Icon size={22} /></span>
                <h3 className="mt-4 text-lg font-bold">{t}</h3>
                <p className="mt-1 text-ink/70">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="bg-ink py-20 text-paper">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="font-display text-4xl font-extrabold">Everything is free for a limited period.</h2>
            <p className="mt-3 max-w-xl text-paper/70">Every feature is included in both plans, at no cost for now. No hidden charges, no auto-renewal.</p>
            <p className="mt-3 text-sm text-paper/70"><Link href="/pricing" className="font-semibold underline hover:text-sun">Full pricing and service details</Link> · <Link href="/refund-policy" className="font-semibold underline hover:text-sun">Refund and cancellation</Link></p>
            <div className="mt-10 grid max-w-3xl gap-5 md:grid-cols-2">
              {plans.map((p) => (
                <div key={p.n} className={`flex flex-col rounded-md p-6 ${p.hot ? "bg-sun text-ink" : "bg-white/8 ring-1 ring-white/15"}`}>
                  <h3 className="text-lg font-bold">{p.n}{p.hot && " (best value)"}</h3>
                  <p className="mt-4 flex items-baseline gap-3"><span className="font-display text-5xl font-extrabold">₹0</span><s className="text-xl opacity-60">₹{p.p}</s></p>
                  <p className="text-sm opacity-70">Free for a limited period. Regular price ₹{p.p} {p.per}.</p>
                  <p className="mt-5 flex flex-1 items-start gap-2 font-semibold"><Check size={20} className="mt-0.5 shrink-0" />{p.o}</p>
                  <Link href={`/signup?plan=${p.n.toLowerCase().replace(" ", "-")}`} className={`mt-6 rounded-md py-3 text-center font-semibold ${p.hot ? "bg-ink text-white" : "bg-white text-ink"}`}>{p.cta}</Link>
                </div>
              ))}
            </div>
          </div>
        </section>


        <section id="faq" className="mx-auto max-w-3xl px-5 py-20">
          <h2 className="font-display text-4xl font-extrabold">Questions, answered.</h2>
          <div className="mt-8 divide-y divide-ink/10 border-y border-ink/10">
            {faqs.map(([q, a]) => (
              <details key={q} className="py-5">
                <summary className="flex items-center justify-between gap-4 text-lg font-semibold">{q}<Plus className="faq-plus shrink-0 text-brand transition-transform" /></summary>
                <p className="mt-3 text-ink/70">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="rounded-md bg-brand px-8 py-14 text-center text-white">
            <h2 className="mx-auto max-w-2xl font-display text-4xl font-extrabold">Set up in about 10 minutes. Free for a limited period.</h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/signup" className="rounded-md bg-sun px-7 py-3 font-semibold text-ink">Start free</Link>
              <a href={wa} className="rounded-md border-2 border-white/40 px-7 py-3 font-semibold">Talk on WhatsApp</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink/10 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <p className="flex items-center gap-2.5 font-display text-2xl font-extrabold text-brand"><Image src="/chhapo-logo.svg" alt="" width={36} height={36} />{SITE.name}</p>
            <p className="mt-2 max-w-sm text-sm text-ink/70">{SITE.description}</p>
          </div>
          <div className="text-sm">
            <p className="font-bold">Product</p>
            <ul className="mt-3 space-y-2 text-ink/70">
              {[["How it works", "#how"], ["Features", "#features"], ["Pricing", "#pricing"], ["FAQ", "#faq"]].map(([l, h]) => <li key={h}><a href={h} className="hover:text-brand">{l}</a></li>)}
            </ul>
          </div>
          <div className="text-sm">
            <p className="font-bold">Contact</p>
            <ul className="mt-3 space-y-2 text-ink/70">
              <li className="flex items-center gap-2"><MessageCircle size={16} className="shrink-0 text-brand" /><a href={wa} className="hover:text-brand">WhatsApp</a></li>
              <li className="flex items-center gap-2"><Mail size={16} className="shrink-0 text-brand" /><a href={`mailto:${SITE.email}`} className="hover:text-brand">{SITE.email}</a></li>
              <li className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-brand" />{SITE.address}</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-ink/10 py-5 text-center text-sm text-ink/60">
          <nav className="mb-2 flex flex-wrap justify-center gap-x-5 gap-y-1 font-medium">
            <Link href="/print-agent" className="hover:text-brand">Print Agent</Link>
            {LEGAL_LINKS.map((l) => <Link key={l.href} href={l.href} className="hover:text-brand">{l.label}</Link>)}
            <Link href="/login" className="hover:text-brand">Login</Link>
            <Link href="/signup" className="hover:text-brand">Sign up</Link>
          </nav>
          © {new Date().getFullYear()} {SITE.name}. Powered by{" "}
          <a href={SITE.poweredBy.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">{SITE.poweredBy.name}</a>
        </div>
      </footer>
      {waReady && (
        <a href={wa} aria-label="Chat on WhatsApp" className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-md bg-[#25D366] text-white shadow-lg hover:brightness-95">
          <MessageCircle size={26} />
        </a>
      )}
    </div>
  );
}
