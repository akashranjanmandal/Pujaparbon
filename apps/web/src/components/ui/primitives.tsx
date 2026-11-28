"use client";
import { Tr } from "@/lib/i18n";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { ProductGlyph } from "./ProductGlyph";

/* ── Button ─────────────────────────────────────────────────────── */
type Variant = "primary" | "gold" | "ghost" | "outline" | "danger" | "peach";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-white shadow-[0_1px_0_rgb(255_255_255/0.15)_inset,0_6px_16px_-8px_rgb(var(--primary)/0.7)] hover:bg-primary/90",
  gold: "bg-text text-white hover:bg-text/85",
  peach: "bg-peach text-white hover:bg-peach/90",
  ghost: "text-muted hover:bg-line/[0.05] hover:text-text",
  outline: "border border-line/[0.12] bg-panel text-text shadow-[0_1px_2px_rgb(var(--line)/0.05)] hover:border-line/25 hover:bg-panel2",
  danger: "border border-sindoor/25 bg-sindoor/[0.07] text-sindoor hover:bg-sindoor/[0.12]",
};
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean; icon?: ReactNode }
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = "outline", size = "md", loading, icon, className, children, disabled, ...p }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
        size === "sm" ? "h-8 px-3 text-[14px]" : size === "lg" ? "h-12 px-6 text-[16px]" : "h-10 px-4 text-[15px]",
        VARIANTS[variant],
        className,
      )}
      {...p}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      <Tr>{children}</Tr>
    </button>
  );
});

/* ── Form controls ──────────────────────────────────────────────── */
const field = "w-full rounded-xl border border-line/[0.14] bg-panel px-3.5 text-[16px] text-text placeholder:text-muted/60 transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary-soft/50";
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(field, "h-11", className)} {...p} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(field, "min-h-[90px] py-2.5", className)} {...p} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return (
    <select ref={ref} className={cn(field, "h-11 appearance-none bg-[length:12px] bg-[right_14px_center] bg-no-repeat pr-9", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23606678' fill='none' stroke-width='1.6'/%3E%3C/svg%3E\")" }} {...p}>
      {children}
    </select>
  );
});
export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-[14.5px] font-semibold text-text/80"><Tr>{label}</Tr></span>
      {children}
      {error ? <span className="block text-[14px] text-sindoor">{error}</span> : hint ? <span className="block text-[14px] text-muted"><Tr>{hint}</Tr></span> : null}
    </label>
  );
}

/* ── Card ───────────────────────────────────────────────────────── */
export function Card({ children, className, plain, title, action, subtitle, delay = 0 }: { children: ReactNode; className?: string; plain?: boolean; title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn("paar-card", plain && "plain", className)}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-6 pb-2 pt-5">
          <div>
            {title && <h3 className="text-[17px] font-semibold tracking-tight"><Tr>{title}</Tr></h3>}
            {subtitle && <p className="mt-0.5 text-[15px] text-muted"><Tr>{subtitle}</Tr></p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </motion.section>
  );
}

/* ── Badge ──────────────────────────────────────────────────────── */
type Tone = "red" | "gold" | "green" | "blue" | "muted" | "orange" | "lav";
const TONES: Record<Tone, string> = {
  red: "bg-sindoor/[0.09] text-sindoor",
  gold: "bg-marigold/[0.12] text-marigold",
  green: "bg-leaf/[0.10] text-leaf",
  blue: "bg-primary-tint text-primary",
  muted: "bg-line/[0.06] text-muted",
  orange: "bg-peach-tint text-peach",
  lav: "bg-lav-tint text-lav",
};
export function Badge({ tone = "muted", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13.5px] font-semibold", TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export const STATUS_TONE: Record<string, Tone> = {
  NEW: "blue", PICKED: "lav", PACKED: "orange", DISPATCHED: "green", DELIVERED: "muted", CANCELLED: "red", RETURNED: "red",
  PRESENT: "green", LATE: "orange", HALF_DAY: "gold", ABSENT: "red", LEAVE: "lav", CL: "blue", SICK: "blue", EVENT: "lav", EARNED: "blue", NOT_IN: "muted",
  PENDING: "gold", APPROVED: "green", REJECTED: "red", TODO: "muted", IN_PROGRESS: "lav", DONE: "green",
  RESTOCKED: "green", WRITTEN_OFF: "red", RECEIVED: "blue", ISSUED: "green", DRAFT: "gold", PAID: "green",
  OK: "green", LOW: "orange", OUT: "red", MATCHED: "green", SHORT: "red", HIGH: "red", MEDIUM: "orange",
};
const LEAVE_NAME: Record<string, string> = { CL: "Casual leave", SICK: "Sick leave", EVENT: "Event leave", EARNED: "Earned leave" };
export const statusLabel = (s: string) => LEAVE_NAME[s] ?? s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={STATUS_TONE[status] ?? "muted"} dot>{statusLabel(status === "NOT_IN" ? "Not in yet" : status)}</Badge>;

/* ── Misc ───────────────────────────────────────────────────────── */
export const Skeleton = ({ className }: { className?: string }) => <div className={cn("skeleton h-4", className)} />;

const PASTELS = [["--primary-tint", "--primary"], ["--lav-tint", "--lav"], ["--peach-tint", "--peach"]] as const;
export function Avatar({ name, hue = 20, size = 36, className }: { name: string; hue?: number; size?: number; className?: string }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  const [bg, fg] = PASTELS[Math.abs(Math.round(hue / 37)) % 3];
  return (
    <div className={cn("grid shrink-0 place-items-center rounded-full font-semibold ring-2 ring-panel", className)} style={{ width: size, height: size, fontSize: size * 0.36, background: `rgb(var(${bg}))`, color: `rgb(var(${fg}))` }}>
      {initials}
    </div>
  );
}

export function ChannelDot({ color, name, className }: { color: string; name: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[15px] font-medium", className)}>
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {name}
    </span>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cn("relative inline-flex rounded-xl bg-bg2 p-1", className)}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={cn("relative z-10 rounded-lg px-3.5 py-1.5 text-[14.5px] font-semibold transition-colors", value === o.value ? "text-text" : "text-muted hover:text-text")}>
          {value === o.value && <motion.span layoutId={`seg-${options.map((x) => x.value).join("")}`} className="absolute inset-0 -z-10 rounded-lg bg-panel shadow-soft" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />}
          <Tr>{o.label}</Tr>
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, body, icon, action }: { title: string; body?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-tint text-primary">{icon}</div>
      <div className="text-[17px] font-semibold"><Tr>{title}</Tr></div>
      {body && <p className="max-w-sm text-[15.5px] text-muted"><Tr>{body}</Tr></p>}
      {action}
    </div>
  );
}

/** Product tile with its name and a quiet second line. */
export function ProductGlyphRow({ name, sub, size = 40 }: { name: string; sub?: ReactNode; size?: number }) {
  return (
    <span className="flex items-center gap-3">
      <ProductGlyph name={name} size={size} />
      <span className="min-w-0"><span className="block truncate font-semibold">{name}</span>{sub && <span className="block truncate text-[14px] text-muted">{sub}</span>}</span>
    </span>
  );
}
