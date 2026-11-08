"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "./Icon";

const links = [
  ["How it works", "#how"],
  ["Features", "#features"],
  ["Pricing", "#pricing"],
  ["FAQ", "#faq"],
] as const;

/** Hamburger menu for small screens (the desktop nav is hidden below md). */
export default function MobileMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen(!open)}
        className="grid h-11 w-11 place-items-center rounded-md border-2 border-ink/15 hover:border-brand hover:text-brand"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && (
        <nav className="absolute right-0 top-full mt-2 w-56 rounded-md bg-white p-2 text-sm font-semibold shadow-lg ring-1 ring-ink/10">
          {links.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2.5 hover:bg-mist hover:text-brand">
              {label}
            </a>
          ))}
          <a href="/signup" className="mt-1 block rounded-md bg-brand px-3 py-2.5 text-center text-white hover:bg-brand-dark">
            Start free
          </a>
        </nav>
      )}
    </div>
  );
}
