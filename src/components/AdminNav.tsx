"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LineIcon, { type LineIconName } from "@/components/lexical/LineIcon";

export interface NavItem {
  href: string;
  label: string;
  icon: LineIconName;
  ownerOnly?: boolean;
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Insights",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: "bar" },
      { href: "/admin/report", label: "Daily Report", icon: "files", ownerOnly: true },
    ],
  },
  {
    title: "Shop",
    items: [
      { href: "/admin", label: "Live Queue", icon: "list" },
      { href: "/admin/orders", label: "Order History", icon: "history" },
      { href: "/admin/customers", label: "Customers", icon: "users", ownerOnly: true },
      { href: "/admin/printers", label: "Printers", icon: "printer" },
      { href: "/admin/supplies", label: "Supplies", icon: "droplet" },
    ],
  },
  {
    title: "Manage",
    items: [
      { href: "/admin/pricing", label: "Pricing", icon: "wallet", ownerOnly: true },
      { href: "/admin/settings", label: "Settings", icon: "gear", ownerOnly: true },
      { href: "/admin/controls", label: "Shop Controls", icon: "sliders", ownerOnly: true },
      { href: "/admin/qr", label: "Shop QR Code", icon: "qr" },
    ],
  },
];

export default function AdminNav({
  role,
  open,
  onClose,
}: {
  role: string;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* mobile backdrop */}
      {open && <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-[1px_0_0_rgba(15,23,42,0.08)] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand */}
        <Link href="/admin" onClick={onClose} className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-900/10 px-6">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-[10px]"
            style={{ background: "linear-gradient(135deg, var(--accent-dark) 0%, var(--accent) 60%, var(--accent-light) 100%)", boxShadow: "0 4px 10px rgb(var(--accent-rgb) / 0.4)" }}
          >
            <LineIcon name="printer" size={24} className="text-white" />
          </span>
          <span>
            <span className="block text-[1.25rem] font-extrabold leading-tight tracking-tight text-slate-900/90">QRtoPrint</span>
            <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-900/40">Shop Dashboard</span>
          </span>
        </Link>

        <nav className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
          {NAV_SECTIONS.map((section) => {
            const items = section.items.filter((i) => !i.ownerOnly || role === "owner");
            if (items.length === 0) return null;
            return (
              <div key={section.title} className="mt-4 first:mt-0">
                <div className="mb-2 flex items-center gap-2 px-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.4px] text-slate-900/40">{section.title}</span>
                  <span className="h-px grow bg-slate-900/10" />
                </div>
                <ul className="space-y-1">
                  {items.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className={`flex items-center gap-3 rounded-md px-3 py-[9px] text-[0.9375rem] transition ${
                            active
                              ? "font-medium text-white"
                              : "text-slate-900/75 active:bg-slate-900/[0.04]"
                          }`}
                          style={
                            active
                              ? {
                                  background: "var(--accent)",
                                }
                              : undefined
                          }
                        >
                          <LineIcon name={item.icon} size={22} className={active ? "text-white" : "text-slate-600"} />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
