"use client";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/* ── Button ─────────────────────────────────────────────────────── */
type Variant = "primary" | "gold" | "ghost" | "outline" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-gradient-to-b from-sindoor to-sindoor-deep text-white shadow-[0_8px_24px_-8px_rgb(var(--sindoor)/0.7)] hover:brightness-110",
  gold: "bg-gradient-to-b from-gold to-marigold text-[#2a1306] shadow-[0_8px_24px_-8px_rgb(var(--gold)/0.6)] hover:brightness-105",
  ghost: "text-muted hover:bg-panel2 hover:text-text",
  outline: "border border-line/20 bg-panel/40 text-text hover:border-gold/50 hover:bg-panel2",
  danger: "border border-sindoor/40 bg-sindoor/10 text-sindoor hover:bg-sindoor/20",
};
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean; icon?: ReactNode }
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = "outline", size = "md", loading, icon, className, children, disabled, ...p }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-xs" : size === "lg" ? "h-12 px-6 text-[15px]" : "h-10 px-4 text-sm",
        VARIANTS[variant],
        className,
      )}
      {...p}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

/* ── Form controls ──────────────────────────────────────────────── */
const field = "w-full rounded-xl border border-line/15 bg-bg2/70 px-3.5 text-sm text-text placeholder:text-muted/60 transition focus:border-gold/60 focus:bg-bg2 focus:outline-none focus:ring-4 focus:ring-gold/10";
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(field, "h-10", className)} {...p} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(field, "min-h-[84px] py-2.5", className)} {...p} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return (
    <select ref={ref} className={cn(field, "h-10 appearance-none bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-8", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23E9B452' fill='none' stroke-width='1.6'/%3E%3C/svg%3E\")" }} {...p}>
      {children}
    </select>
  );
});
export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted">{label}</span>
      {children}
      {error ? <span className="block text-xs text-sindoor">{error}</span> : hint ? <span className="block text-xs text-muted/80">{hint}</span> : null}
    </label>
  );
}

/* ── Card ───────────────────────────────────────────────────────── */
export function Card({ children, className, plain, title, action, subtitle, delay = 0 }: { children: ReactNode; className?: string; plain?: boolean; title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.55, delay, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn("paar-card", plain && "plain", className)}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pb-1 pt-5">
          <div>
            {title && <h3 className="font-display text-[17px] font-semibold tracking-tight">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </motion.section>
  );
}

/* ── Badge ──────────────────────────────────────────────────────── */
type Tone = "red" | "gold" | "green" | "blue" | "muted" | "orange";
const TONES: Record<Tone, string> = {
  red: "bg-sindoor/12 text-sindoor ring-sindoor/25",
  gold: "bg-gold/12 text-gold ring-gold/25",
  green: "bg-leaf/12 text-leaf ring-leaf/25",
  blue: "bg-sky/12 text-sky ring-sky/25",
  muted: "bg-muted/10 text-muted ring-muted/20",
  orange: "bg-stem/12 text-stem ring-stem/25",
};
export function Badge({ tone = "muted", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset", TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export const STATUS_TONE: Record<string, Tone> = {
  NEW: "blue", PICKED: "orange", PACKED: "gold", DISPATCHED: "green", DELIVERED: "muted", CANCELLED: "red", RETURNED: "red",
  PRESENT: "green", LATE: "orange", HALF_DAY: "gold", ABSENT: "red", LEAVE: "blue", NOT_IN: "muted",
  PENDING: "gold", APPROVED: "green", REJECTED: "red", TODO: "muted", IN_PROGRESS: "orange", DONE: "green",
  RESTOCKED: "green", WRITTEN_OFF: "red", RECEIVED: "blue", ISSUED: "green", DRAFT: "gold", PAID: "green",
  OK: "green", LOW: "gold", OUT: "red", MATCHED: "green", SHORT: "red", HIGH: "red", MEDIUM: "gold", LOW_P: "muted",
};
export const statusLabel = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={STATUS_TONE[status] ?? "muted"} dot>{statusLabel(status === "NOT_IN" ? "Not in yet" : status)}</Badge>;

/* ── Misc ───────────────────────────────────────────────────────── */
export const Skeleton = ({ className }: { className?: string }) => <div className={cn("skeleton h-4", className)} />;

export function Avatar({ name, hue = 20, size = 36, className }: { name: string; hue?: number; size?: number; className?: string }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <div
      className={cn("grid shrink-0 place-items-center rounded-full font-display font-semibold text-white ring-2 ring-gold/25", className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, hsl(${hue} 70% 46%), hsl(${(hue + 40) % 360} 75% 32%))` }}
    >
      {initials}
    </div>
  );
}

export function ChannelDot({ color, name, className }: { color: string; name: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs font-medium", className)}>
      <span className="h-2.5 w-2.5 rounded-full shadow-[0_0_10px_currentColor]" style={{ background: color, color }} />
      {name}
    </span>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cn("relative inline-flex rounded-xl border border-line/15 bg-bg2/60 p-1", className)}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={cn("relative z-10 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors", value === o.value ? "text-text" : "text-muted hover:text-text")}>
          {value === o.value && <motion.span layoutId={`seg-${options.map((x) => x.value).join("")}`} className="absolute inset-0 -z-10 rounded-lg bg-panel2 shadow-glow" transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, body, icon, action }: { title: string; body?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-line/15 bg-panel2 text-gold">{icon}</div>
      <div className="font-display text-lg">{title}</div>
      {body && <p className="max-w-sm text-sm text-muted">{body}</p>}
      {action}
    </div>
  );
}
