"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LineIcon from "@/components/lexical/LineIcon";
import { Avatar, Chip } from "@/components/lexical/ui";
import { NAV_SECTIONS } from "@/components/AdminNav";
import NotificationBell from "@/components/NotificationBell";

export default function AdminTopBar({
  userName,
  role,
  onMenu,
}: {
  userName: string;
  role: string;
  onMenu: () => void;
}) {
  const router = useRouter();
  const [shopName, setShopName] = useState("");
  const [paused, setPaused] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Shop name + live/paused status (public endpoint)
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/settings/pricing", { cache: "no-store" });
        const data = await res.json();
        if (!alive) return;
        setShopName(data.shopName ?? "");
        setPaused(!!data.printingPaused);
      } catch {
        // ignore — next poll retries
      }
    }
    load();
    const t = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // Ctrl/Cmd + K focuses search; click outside closes menus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setMenuOpen(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  const pages = useMemo(
    () => NAV_SECTIONS.flatMap((s) => s.items).filter((i) => !i.ownerOnly || role === "owner"),
    [role]
  );
  const results = pages.filter((p) => p.label.toLowerCase().includes(query.trim().toLowerCase()));

  function go(href: string) {
    setQuery("");
    setSearchOpen(false);
    searchRef.current?.blur();
    router.push(href);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const initial = (userName || "U").trim().charAt(0).toUpperCase();

  return (
    <header
      // Attached to the top edge and to the sidebar (left: 260px on desktop), fixed while the page scrolls.
      className="fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6 lg:left-[260px]"
    >
      {/* mobile menu */}
      <button
        onClick={onMenu}
        aria-label="Open menu"
        className="flex h-9 w-9 items-center justify-center rounded-md text-xl text-slate-900/70 transition active:bg-slate-900/[0.05] lg:hidden"
      >
        ☰
      </button>

      {/* quick search */}
      <div className="relative w-full max-w-sm">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-900/40">🔍</span>
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) go(results[0].href);
          }}
          placeholder="Search pages…"
          className="w-full rounded-md bg-slate-900/[0.04] py-2 pl-9 pr-12 text-sm text-slate-900/90 outline-none transition placeholder:text-slate-900/40 focus:bg-white focus:ring-1 focus:ring-[color:var(--accent)]"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-300 px-1.5 text-[10px] font-semibold text-slate-900/40 sm:block">
          Ctrl K
        </kbd>
        {searchOpen && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] overflow-hidden rounded-md bg-white py-1.5 shadow-[0_10px_30px_rgba(15,23,42,0.15)]">
            {results.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-900/50">No pages found</div>
            ) : (
              results.map((r) => (
                <button
                  key={r.href}
                  onMouseDown={() => go(r.href)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-slate-900/80 transition active:bg-[rgb(var(--accent-rgb)/0.08)]"
                >
                  <LineIcon name={r.icon} size={20} className="text-slate-600" />
                  {r.label}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        {shopName && (
          <span className="hidden items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-slate-900/70 md:flex">
            <LineIcon name="user" size={18} className="text-slate-900/50" />
            {shopName}
          </span>
        )}

        <button onClick={() => router.push("/admin")} title="Go to Live Queue">
          <Chip color={paused ? "warning" : "success"}>{paused ? (
              <>⏸ <span className="sm:hidden">Paused</span><span className="hidden sm:inline">Printing Paused</span></>
            ) : (
              <>● <span className="sm:hidden">Live</span><span className="hidden sm:inline">Printing Live</span></>
            )}</Chip>
        </button>

        <NotificationBell />

        {/* user menu */}
        <div ref={menuRef} className="relative">
          <button onClick={() => setMenuOpen((v) => !v)} className="relative block rounded-full" aria-label="Account menu">
            <Avatar size={38}>{initial}</Avatar>
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[color:var(--accent-light)]" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-[calc(100%+10px)] w-56 overflow-hidden rounded-md bg-white py-2 shadow-[0_10px_30px_rgba(15,23,42,0.15)]">
              <div className="flex items-center gap-3 px-4 pb-3 pt-2">
                <Avatar size={40}>{initial}</Avatar>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900/90">{userName || "User"}</div>
                  <div className="text-xs text-slate-900/50">{role === "owner" ? "Owner" : "Staff"}</div>
                </div>
              </div>
              <div className="my-1 h-px bg-slate-900/10" />
              {role === "owner" && (
                <>
                  <MenuItem onClick={() => { setMenuOpen(false); router.push("/admin/pricing"); }}>💰 Pricing</MenuItem>
                  <MenuItem onClick={() => { setMenuOpen(false); router.push("/admin/settings"); }}>⚙️ Settings</MenuItem>
                </>
              )}
              <MenuItem onClick={() => { setMenuOpen(false); router.push("/admin/qr"); }}>🔗 Shop QR Code</MenuItem>
              <div className="my-1 h-px bg-slate-900/10" />
              <MenuItem onClick={handleLogout} danger>
                ↩ Logout
              </MenuItem>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition active:bg-slate-900/[0.04] ${
        danger ? "text-[#E11D48]" : "text-slate-900/80"
      }`}
    >
      {children}
    </button>
  );
}
