import { SITE } from "@/components/landing/site";

/** "Powered by Lexical Software" with a link to the website. One component so every page says it the same way. */
export default function PoweredBy({ className = "", light = false }: { className?: string; light?: boolean }) {
  return (
    <p className={`text-center text-xs ${light ? "text-white/70" : "text-slate-900/50"} ${className}`}>
      Powered by{" "}
      <a
        href={SITE.poweredBy.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`font-semibold hover:underline ${light ? "text-white" : "text-[color:var(--accent)]"}`}
      >
        {SITE.poweredBy.name}
      </a>
    </p>
  );
}
