"use client";

import Image from "next/image";
import { useState } from "react";
import {
  AGENT_DOWNLOAD_URL,
  AGENT_RELEASES_URL,
  AGENT_VERSION,
  INSTALL_STEPS,
  REQUIREMENTS,
  type Bilingual,
} from "@/lib/agentInstall";

type Lang = "both" | "en" | "hi";

const LANGS: { key: Lang; label: string }[] = [
  { key: "both", label: "हिंदी + English" },
  { key: "en", label: "English" },
  { key: "hi", label: "हिंदी" },
];

/** Shows the English and/or Hindi text of a pair, depending on the chosen language. */
function T({ t, lang, hiFirst = false, className = "", hiClassName = "" }: { t: Bilingual; lang: Lang; hiFirst?: boolean; className?: string; hiClassName?: string }) {
  const en = <span className={`block ${className}`}>{t.en}</span>;
  const hi = <span lang="hi" className={`block ${hiClassName || className}`}>{t.hi}</span>;
  if (lang === "en") return en;
  if (lang === "hi") return hi;
  return hiFirst ? <>{hi}{en}</> : <>{en}{hi}</>;
}

/**
 * Step-by-step Windows install guide (Hindi + English) with a screenshot per step.
 * Screenshots live in /public/install/<n>-<name>.webp. Replace a file with a real
 * screenshot of the same name to update the guide, no code change needed.
 */
export default function InstallGuide() {
  const [lang, setLang] = useState<Lang>("both");

  return (
    <div className="space-y-6">
      {/* Download card */}
      <div
        className="overflow-hidden rounded-2xl p-6 text-white sm:p-8"
        style={{ background: "linear-gradient(120deg, var(--accent-dark) 0%, var(--accent) 55%, var(--accent-light) 100%)" }}
      >
        <div className="text-xs font-semibold uppercase tracking-widest text-white/70">QRtoPrint Print Agent · Windows · v{AGENT_VERSION}</div>
        <h2 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">
          <T t={{ en: "Install the Print Agent on your shop PC", hi: "अपनी दुकान के PC पर Print Agent इंस्टॉल करें" }} lang={lang} hiFirst />
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/85">
          <T
            t={{
              en: "A small app that prints your customers' paid orders automatically.",
              hi: "यह छोटी ऐप ग्राहकों के पेड ऑर्डर अपने आप प्रिंट करती है। लगभग 5 मिनट लगते हैं।",
            }}
            lang={lang}
          />
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a
            href={AGENT_DOWNLOAD_URL}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-bold shadow-lg transition hover:brightness-95"
            style={{ color: "var(--accent-dark)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="m7 10 5 5 5-5" />
              <path d="M12 15V3" />
            </svg>
            Download for Windows
          </a>
      
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {REQUIREMENTS.map((r) => (
            <span key={r.en} className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
              {lang === "hi" ? r.hi : lang === "en" ? r.en : `${r.en} · ${r.hi}`}
            </span>
          ))}
        </div>
      </div>

      {/* Language switch + step index */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Language" className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
          {LANGS.map((l) => (
            <button
              key={l.key}
              role="tab"
              aria-selected={lang === l.key}
              onClick={() => setLang(l.key)}
              className={`rounded-md px-3.5 py-1.5 text-sm font-semibold transition ${lang === l.key ? "text-white" : "text-slate-600 hover:bg-slate-50"}`}
              style={lang === l.key ? { background: "var(--accent)" } : undefined}
            >
              {l.label}
            </button>
          ))}
        </div>
        <nav aria-label="Steps" className="flex flex-wrap gap-1.5">
          {INSTALL_STEPS.map((_, i) => (
            <a
              key={i}
              href={`#step-${i + 1}`}
              className="grid h-8 w-8 place-items-center rounded-full border border-slate-300 bg-white text-sm font-bold text-slate-600 transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            >
              {i + 1}
            </a>
          ))}
        </nav>
      </div>

      {/* Steps */}
      <ol className="space-y-5">
        {INSTALL_STEPS.map((s, i) => (
          <li key={s.image} id={`step-${i + 1}`} className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex gap-4 p-5 sm:p-6">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg font-extrabold text-white"
                style={{ background: "var(--accent)" }}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold leading-snug text-slate-900/90">
                    <T t={s.title} lang={lang} />
                  </h3>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${s.where === "dash" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}
                  >
                    {s.where === "dash" ? "Dashboard · डैशबोर्ड" : "Shop PC · दुकान का PC"}
                  </span>
                </div>
                <p className="mt-1.5 space-y-1 text-[15px] leading-relaxed text-slate-900/75">
                  <T t={s.body} lang={lang} />
                </p>
              </div>
            </div>
            <a href={`/install/${s.image}.webp`} target="_blank" rel="noopener noreferrer" className="block border-t border-slate-100 bg-slate-50 p-3 sm:p-4">
              <Image
                src={`/install/${s.image}.webp`}
                alt={`Step ${i + 1}: ${s.title.en}`}
                width={1440}
                height={810}
                sizes="(min-width: 1024px) 860px, 100vw"
                className="h-auto w-full rounded-lg border border-slate-200"
                loading={i < 2 ? "eager" : "lazy"}
              />
            </a>
          </li>
        ))}
      </ol>

      <p className="text-center text-xs text-slate-900/50">
        Screens may look slightly different on your PC. · आपके PC पर स्क्रीन थोड़ी अलग दिख सकती है।
      </p>
    </div>
  );
}
