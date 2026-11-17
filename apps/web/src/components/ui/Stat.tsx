"use client";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Counter({ value, format = (n) => Math.round(n).toLocaleString("en-IN"), duration = 1.1 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    const c = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return c.stop;
  }, [value, duration, mv]);
  return <motion.span className="num">{text}</motion.span>;
}

export function Spark({ data, className, tone = "primary" }: { data: number[]; className?: string; tone?: "primary" | "lav" | "peach" | "leaf" | "sindoor" }) {
  if (data.length < 2) return null;
  const w = 100, h = 30, max = Math.max(...data), min = Math.min(...data), span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / span) * (h - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-8 w-full", className)} aria-hidden>
      <motion.polyline points={pts} fill="none" stroke={`rgb(var(--${tone}))`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
    </svg>
  );
}

const TONE = { gold: "bg-primary-tint text-primary", blue: "bg-primary-tint text-primary", green: "bg-leaf/10 text-leaf", red: "bg-peach-tint text-peach" };

export function Stat({ label, value, format, icon, change, hint, tone = "gold", delay = 0, onClick }: {
  label: string; value: number; format?: (n: number) => string; icon?: ReactNode; change?: number; hint?: ReactNode; tone?: "gold" | "red" | "green" | "blue"; delay?: number; onClick?: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      className={cn("paar-card w-full p-5 text-left transition", onClick ? "hover:-translate-y-0.5 hover:shadow-lift" : "cursor-default")}
    >
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-medium text-muted">{label}</span>
        {icon && <span className={cn("grid h-9 w-9 place-items-center rounded-xl [&_svg]:h-[18px] [&_svg]:w-[18px]", TONE[tone])}>{icon}</span>}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-[30px] font-semibold leading-none tracking-tight"><Counter value={value} format={format} /></span>
        {change !== undefined && <span className={cn("text-[14px] font-semibold", change >= 0 ? "text-leaf" : "text-peach")}>{change >= 0 ? "↑" : "↓"} {Math.abs(change)}%</span>}
      </div>
      {hint && <div className="mt-2 text-[14.5px] text-muted">{hint}</div>}
    </motion.button>
  );
}
