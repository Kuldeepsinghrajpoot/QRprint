"use client";

import { useEffect, useState } from "react";
import { PALETTES, PALETTE_KEY, type PaletteId } from "@/lib/palettes";

/** Row of colour pills that re-themes the whole app (the accent lives in CSS variables, see globals.css). */
export default function PalettePicker() {
  const [active, setActive] = useState<PaletteId>("ocean");

  useEffect(() => {
    const saved = document.documentElement.getAttribute("data-palette") as PaletteId | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the palette applied before hydration
    if (saved && PALETTES.some((p) => p.id === saved)) setActive(saved);
  }, []);

  function pick(id: PaletteId) {
    setActive(id);
    document.documentElement.setAttribute("data-palette", id);
    try {
      localStorage.setItem(PALETTE_KEY, id);
    } catch {
      // storage blocked — the choice still applies until reload
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-medium text-slate-900/70">Palette</span>
      {PALETTES.map((p) => {
        const on = active === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => pick(p.id)}
            aria-pressed={on}
            className={`flex items-center gap-2 rounded-lg border px-3.5 py-1.5 text-[13px] font-medium transition ${
              on ? "border-[color:var(--accent)] bg-[rgb(var(--accent-rgb)/0.08)] text-slate-900" : "border-slate-300 bg-white text-slate-600 active:bg-slate-50"
            }`}
          >
            <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
