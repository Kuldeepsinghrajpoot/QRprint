import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/components/landing/site";
import { publicSans } from "@/components/landing/fonts";
import PoweredBy from "@/components/PoweredBy";

export const metadata: Metadata = {
  title: `Print Agent for Windows - install and use | ${SITE.name}`,
  alternates: { canonical: "/print-agent" },
  description: "Download, install and use the QRtoPrint Print Agent on your shop's Windows PC.",
};

const RELEASES = "https://github.com/Kuldeepsinghrajpoot/QR-printer-agent/releases/download/v1.0.12/QRtoPrint-Setup-1.0.12.exe";

type Step = { t: string; d: string };

const install: Step[] = [
  { t: "Download the installer", d: "Open the Releases page and, under the newest release (marked Latest), download QRtoPrint-Setup-<version>.exe from Assets. Do not download the Source code files." },
  { t: "Run the installer", d: "Double-click the file. If Windows shows “Windows protected your PC”, click More info, then Run anyway. This appears because the app is new and not yet widely downloaded." },
  { t: "Choose where to install", d: "Pick the folder (the default is fine), click Install and wait for it to finish. The app opens by itself at the end." },
  { t: "Find it later", d: "A QRtoPrint shortcut is added to the Start menu and the desktop. When running, the app also sits in the system tray (bottom right, next to the clock)." },
];

const setup: Step[] = [
  { t: "Create the agent key in your dashboard", d: "Log in, open Settings, go to Print Agent and click Create agent key. Copy the key. It is shown only once; if you lose it, create a new one." },
  { t: "Paste the key into the app", d: "Open the app, go to the Print Agent tab, paste the key under Agent API key and click Add key. The key is then hidden and shows “Key submitted”." },
  { t: "Check the connection", d: "The green dot next to the Print Agent tab and the status at the top show that the agent is connected. Your printers appear under “Printers on this PC” with “Linked to dashboard”." },
  { t: "Set each printer's type", d: "In the dashboard, open Printers and choose B&W, Color or B&W + Color for every printer. The agent shows what Windows detects for each printer so you can match it." },
  { t: "Turn on Start automatically", d: "On the Print Agent tab, tick “Start automatically when this PC turns on” and click Save & restart agent, so printing resumes after a restart." },
];

const usage: Step[] = [
  { t: "Customers order", d: "A customer scans your shop QR code, uploads a file, picks the print options and pays. The order appears in your Live Queue." },
  { t: "The agent prints it", d: "Within a few seconds the agent downloads the file and prints it on the right printer: B&W orders go to a B&W printer, Color orders to a Color printer. It follows copies, paper size, pages per sheet and two-sided printing." },
  { t: "Mark it collected", d: "When the customer picks up the print, press Mark Collected in the dashboard. The customer's file is then deleted. Do this only after the order has printed." },
  { t: "Watch Recent activity", d: "The Print Agent tab lists each order as it prints, and shows the reason if one fails (for example the printer is offline or out of paper)." },
];

const tips: { h: string; p: string }[] = [
  { h: "Run it on one PC only", p: "Install and sign in the agent on a single PC per shop. Two PCs with the same key would both try to print the same order." },
  { h: "Closing the window", p: "Closing the window does not stop printing: the app keeps running in the system tray. To stop it, right-click the tray icon and choose Quit." },
  { h: "Printer status", p: "The Printers tab shows each printer as Connected or Disconnected, and its paper and ink state. Paper jam, Out of paper and Low ink are also sent to your dashboard so you see them on the Printers page." },
  { h: "Test colour / Test B&W", p: "On the Print Agent tab, each printer has Test colour and Test B&W buttons. They print a small page with four coloured squares. If the squares come out grey or black on a colour test, colour is not reaching that printer: check the printer's driver settings." },
  { h: "Updates", p: "When a new version is released an “Update available” button appears at the top right. Click it: the app downloads the update, waits for any running print to finish, installs it and restarts. When you are up to date the header says so and shows the version." },
  { h: "Settings", p: "Check orders (sec) sets how often the agent looks for new orders (default 5). Printer status (sec) sets how often health is sent to the dashboard. The defaults are fine for most shops." },
];

const trouble: { q: string; a: string }[] = [
  { q: "The app does not connect (no green dot)", a: "Check the PC has internet and that the key was added correctly. Click Replace key and paste a new key created in Settings → Print Agent." },
  { q: "No printers are listed", a: "Make sure the printer is installed in Windows (Settings → Printers & scanners), switched on and not set to “Use Printer Offline”. Then click Sync now." },
  { q: "A printer shows Offline", a: "Check power, cable or Wi-Fi. For USB, replug the cable. A paper jam or empty tray can also make Windows mark a printer offline." },
  { q: "Orders stay in the queue", a: "Check the printer is linked and its type matches the order (a Color order needs a Color printer). Open Recent activity for the reason." },
  { q: "No Update button", a: "It only appears when a newer version has been released. Close the app fully (also from the tray) and open it again, then wait about 30 seconds." },
  { q: "Need help?", a: "Open the folder %APPDATA%\\printer-monitor and send the file crash.log to Lexical Software support, with a short description of what happened." },
];

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="mt-4 space-y-3">
      {steps.map((s, i) => (
        <li key={s.t} className="flex gap-4 rounded-xl border border-ink/10 bg-white p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</span>
          <div>
            <div className="font-semibold">{s.t}</div>
            <p className="mt-0.5 leading-relaxed text-ink/75">{s.d}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function PrintAgentPage() {
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
        <h1 className="font-display text-4xl font-extrabold">QRtoPrint Print Agent for Windows</h1>
        <p className="mt-3 text-lg leading-relaxed text-ink/75">
          The Print Agent is a small Windows app that runs on your shop PC. It picks up paid orders from your dashboard and prints them
          on your printers by itself, and tells the dashboard if a printer is offline, jammed or out of paper.
        </p>
        <a
          href={RELEASES}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center rounded-lg bg-brand px-5 py-3 font-semibold text-white hover:opacity-90"
        >
          Download for Windows
        </a>
        <p className="mt-2 text-sm text-ink/60">Opens the Releases page. Choose the newest release and download the .exe file.</p>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold">Before you start</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-ink/80">
            <li>A PC with Windows 10 or Windows 11, switched on during shop hours, with internet.</li>
            <li>Your printers already installed in Windows (USB, Wi-Fi or network) and able to print a test page.</li>
            <li>Your shop account on the dashboard (sign up on the home page if you do not have one).</li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold">1. Install</h2>
          <Steps steps={install} />
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold">2. Connect it to your shop</h2>
          <Steps steps={setup} />
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold">3. Daily use</h2>
          <Steps steps={usage} />
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold">Good to know</h2>
          <div className="mt-4 space-y-4">
            {tips.map((t) => (
              <div key={t.h}>
                <h3 className="font-semibold">{t.h}</h3>
                <p className="mt-0.5 leading-relaxed text-ink/75">{t.p}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold">Troubleshooting</h2>
          <div className="mt-4 space-y-3">
            {trouble.map((t) => (
              <details key={t.q} className="rounded-xl border border-ink/10 bg-white p-4">
                <summary className="cursor-pointer font-semibold">{t.q}</summary>
                <p className="mt-2 leading-relaxed text-ink/75">{t.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-ink/10 py-6">
        <PoweredBy />
      </footer>
    </div>
  );
}
