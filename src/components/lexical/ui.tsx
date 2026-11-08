"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Tailwind port of the Lexical Software (Materio / MUI) building blocks.
 * Palette: theme accent (see globals.css) + Slate. Font: Public Sans.
 */

export const LEX_FONT = "var(--font-public-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";

// Every page banner uses the same blue as the landing page.
const BLUE = "linear-gradient(120deg, var(--accent-dark) 0%, var(--accent) 55%, var(--accent-light) 100%)";
export const GRADIENTS = {
  indigo: BLUE,
  teal: BLUE,
  purple: BLUE,
  orange: BLUE,
  blue: BLUE,
} as const;

// Cards are flat: no shadow, just a thin light border.
export const CARD_BORDER = "border border-slate-200";

// Plain, calm page background behind every dashboard / sign-in page.
export const PAGE_BG = "#F6F8F7";

/* ───────────────────────── Card ───────────────────────── */

export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-[10px] ${CARD_BORDER} ${
        hover ? "transition duration-150 " : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-4">
      <div className="flex min-w-0 items-center gap-3">
        {icon}
        <div className="min-w-0">
          <div className="text-lg font-medium leading-snug tracking-[0.15px] text-slate-900/90">{title}</div>
          {subtitle && <div className="mt-0.5 text-sm text-slate-900/50">{subtitle}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ───────────────────────── Hero / stats ───────────────────────── */

export function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  /** "muted" for offline/neutral, "danger" for problems. */
  tone?: "default" | "muted" | "danger";
}) {
  const tile = {
    default: "bg-[rgb(var(--accent-rgb)/0.08)] text-[color:var(--accent)]",
    muted: "bg-slate-100 text-slate-500",
    danger: "bg-rose-50 text-rose-600",
  }[tone];
  return (
    <Card>
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-md ${tile}`}>{icon}</span>
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold uppercase tracking-wide text-slate-900/55">{label}</div>
          <div className="mt-0.5 text-2xl font-extrabold leading-tight text-slate-900/90">{value}</div>
          {hint && <div className="mt-0.5 text-xs text-slate-900/55">{hint}</div>}
        </div>
      </div>
    </Card>
  );
}

/* ───────────────────────── Chip / Avatar / Field ───────────────────────── */

export type Tone = "primary" | "success" | "warning" | "error" | "secondary" | "purple" | "info";

export const TONES: Record<Tone, { bg: string; fg: string; main: string }> = {
  primary: { bg: "rgb(var(--accent-rgb) / 0.16)", fg: "var(--accent)", main: "var(--accent)" },
  success: { bg: "rgba(16,185,129,0.16)", fg: "#059669", main: "#10B981" },
  warning: { bg: "rgba(245,158,11,0.16)", fg: "#D97706", main: "#F59E0B" },
  error: { bg: "rgba(244,63,94,0.16)", fg: "#E11D48", main: "#F43F5E" },
  secondary: { bg: "rgba(100,116,139,0.16)", fg: "#475569", main: "#64748B" },
  purple: { bg: "rgba(168,85,247,0.16)", fg: "#9333EA", main: "#A855F7" },
  info: { bg: "rgba(14,165,233,0.16)", fg: "#0284C7", main: "#0EA5E9" },
};

export type ChipColor = Tone;

/** MUI "light skin, rounded" chip. */
export function Chip({
  color = "secondary",
  children,
  small = false,
}: {
  color?: Tone;
  children: ReactNode;
  small?: boolean;
}) {
  const c = TONES[color];
  return (
    <span
      className={`inline-flex items-center rounded-md font-medium whitespace-nowrap ${
        small ? "px-2 py-[1px] text-[11px]" : "px-3 py-[3px] text-[13px]"
      }`}
      style={{ background: c.bg, color: c.fg }}
    >
      {children}
    </span>
  );
}

export function Avatar({
  children,
  color = "primary",
  size = 46,
}: {
  children: ReactNode;
  color?: Tone;
  size?: number;
}) {
  const c = TONES[color];
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{ width: size, height: size, background: c.bg, color: c.fg, fontSize: size * 0.4 }}
    >
      {children}
    </div>
  );
}

export function Field({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-slate-900/60">{k}</div>
      <div className="truncate text-sm font-semibold text-slate-900/90">{v}</div>
    </div>
  );
}

/* ───────────────────────── Buttons / alerts / switch ───────────────────────── */

type BtnVariant = "contained" | "light" | "outlined" | "text";

export function Button({
  variant = "contained",
  tone = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; tone?: Tone; size?: "sm" | "md" }) {
  const c = TONES[tone];
  const pad = size === "sm" ? "px-3 py-1 text-[13px]" : "px-5 py-2 text-sm";
  const style =
    variant === "contained"
      ? { background: c.main, color: "#fff" }
      : variant === "light"
        ? { background: c.bg, color: c.fg }
        : variant === "outlined"
          ? { border: `1px solid ${c.main}99`, color: c.fg }
          : { color: c.fg };
  return (
    <button
      {...props}
      style={style}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 ${pad} ${className}`}
    />
  );
}

export function Alert({
  tone = "warning",
  icon,
  children,
  className = "",
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const c = TONES[tone];
  return (
    <div
      className={`flex items-start gap-3 rounded-[10px] px-4 py-3 text-sm ${className}`}
      style={{ background: c.bg.replace("0.16", "0.12"), color: c.fg }}
    >
      {icon && <span className="text-lg leading-none">{icon}</span>}
      <div className="min-w-0 grow">{children}</div>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  title,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 rounded-lg border border-slate-900/10 px-4 py-3 ${disabled ? "opacity-50" : ""}`}>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900/90">{title}</div>
        {description && <div className="mt-0.5 text-xs text-slate-900/60">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-[22px] w-[40px] shrink-0 rounded-full transition disabled:cursor-not-allowed ${checked ? "bg-[color:var(--accent)]" : "bg-slate-300"}`}
      >
        <span
          className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-[21px]" : "left-[3px]"}`}
        />
      </button>
    </div>
  );
}

/* ───────────────────────── Inputs ───────────────────────── */

const FIELD_CLS =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-[13px] text-sm text-slate-900/90 outline-none transition focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent)]";

/** Outlined text field with a floating label, like MUI <TextField />. */
export function TextField({
  label,
  value,
  onChange,
  required,
  helper,
  type = "text",
  placeholder,
  min,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  required?: boolean;
  helper?: string;
  type?: string;
  placeholder?: string;
  min?: number;
}) {
  return (
    <div>
      <div className="relative">
        <input
          type={type}
          min={min}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder ?? " "}
          className={`peer ${FIELD_CLS}`}
        />
        <label className="pointer-events-none absolute left-2.5 top-0 -translate-y-1/2 bg-white px-1 text-xs text-slate-900/60 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-sm peer-focus:top-0 peer-focus:text-xs peer-focus:text-[color:var(--accent)]">
          {label}
          {required && " *"}
        </label>
      </div>
      {helper && <p className="mt-1.5 px-3.5 text-xs text-slate-900/60">{helper}</p>}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  helper?: string;
}) {
  return (
    <TextField label={label} type="number" min={0} value={value} onChange={(v) => onChange(Number(v))} helper={helper} />
  );
}

export function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={FIELD_CLS}>
        {children}
      </select>
      <label className="pointer-events-none absolute left-2.5 top-0 -translate-y-1/2 bg-white px-1 text-xs text-slate-900/60">
        {label}
      </label>
    </div>
  );
}

/** Compact number input for table cells. */
export function CellInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      min={0}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900/90 outline-none transition focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent)]"
    />
  );
}

/* ───────────────────────── Dialog ───────────────────────── */

export function Dialog({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-[10px] bg-white shadow-2xl"
      >
        {children}
      </div>
    </div>
  );
}
