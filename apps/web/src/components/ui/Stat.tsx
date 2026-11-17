"use client";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Ticks up to its value; tabular mono digits so nothing jitters. */
export function Counter({ value, format = (n) => Math.round(n).toLocaleString("en-IN"), duration = 1.1 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    const c = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return c.stop;
  }, [value, duration, mv]);
  return <motion.span className="num">{text}</motion.span>;
}

/** Inline sparkline from a numeric series. */
export function Spark({ data, className, tone = "sindoor" }: { data: number[]; className?: string; tone?: "sindoor" | "leaf" | "sky" | "marigold" }) {
  if (data.length < 2) return null;
  const w = 100, h = 28, max = Math.max(...data), min = Math.min(...data), span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / span) * (h - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-7 w-full", className)} aria-hidden>
      <defs><linearGradient id={`sp-${tone}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={`rgb(var(--${tone}))`} stopOpacity="0.25" /><stop offset="1" stopColor={`rgb(var(--${tone}))`} stopOpacity="0" /></linearGradient></defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#sp-${tone})`} />
      <motion.polyline points={pts} fill="none" stroke={`rgb(var(--${tone}))`} strokeWidth="1.4" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
    </svg>
  );
}

export function Stat({ label, value, format, icon, change, hint, tone = "gold", delay = 0, onClick, spark }: {
  label: string; value: number; format?: (n: number) => string; icon?: ReactNode; change?: number; hint?: ReactNode; tone?: "gold" | "red" | "green" | "blue"; delay?: number; onClick?: () => void; spark?: number[];
}) {
  const led = { gold: "bg-text/60", red: "bg-sindoor", green: "bg-leaf", blue: "bg-sky" }[tone];
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn("paar-card group w-full p-4 text-left hover:border-line/15", !onClick && "cursor-default")}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2"><span className={cn("h-1.5 w-1.5 rounded-full", led)} /><span className="label">{label}</span></span>
        <span className="text-muted/60 [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="font-mono text-[26px] font-medium leading-none tracking-tight"><Counter value={value} format={format} /></span>
        {change !== undefined && (
          <span className={cn("mb-0.5 font-mono text-[11px]", change >= 0 ? "text-leaf" : "text-sindoor")}>{change >= 0 ? "▲" : "▼"} {Math.abs(change)}%</span>
        )}
      </div>
      {hint && <div className="mt-1.5 text-[12px] text-muted">{hint}</div>}
      {spark && <Spark data={spark} className="mt-2" tone={tone === "red" ? "sindoor" : tone === "green" ? "leaf" : tone === "blue" ? "sky" : "sindoor"} />}
    </motion.button>
  );
}
