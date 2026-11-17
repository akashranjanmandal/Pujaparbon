"use client";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";

/** Rolls up to its value like a temple-bell counter. */
export function Counter({ value, format = (n) => Math.round(n).toLocaleString("en-IN"), duration = 1.4 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    const c = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return c.stop;
  }, [value, duration, mv]);
  return <motion.span className="num">{text}</motion.span>;
}

export function Stat({ label, value, format, icon, change, hint, tone = "gold", delay = 0, onClick }: {
  label: string; value: number; format?: (n: number) => string; icon: ReactNode; change?: number; hint?: ReactNode; tone?: "gold" | "red" | "green" | "blue"; delay?: number; onClick?: () => void;
}) {
  const ring = { gold: "from-gold/30 to-marigold/5 text-gold", red: "from-sindoor/35 to-sindoor/5 text-sindoor", green: "from-leaf/30 to-leaf/5 text-leaf", blue: "from-sky/30 to-sky/5 text-sky" }[tone];
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 18, rotateX: -12 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.7, delay, ease: [0.2, 0.8, 0.2, 1] }}
      whileHover={{ y: -3 }}
      className={cn("paar-card group w-full p-5 text-left transition-shadow hover:shadow-glow", !onClick && "cursor-default")}
    >
      <div className="flex items-start justify-between">
        <div className={cn("grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ring-1 ring-inset ring-current/20", ring)}>
          <span className="drop-shadow-[0_0_8px_currentColor]">{icon}</span>
        </div>
        {change !== undefined && (
          <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold", change >= 0 ? "bg-leaf/12 text-leaf" : "bg-sindoor/12 text-sindoor")}>
            {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <div className="mt-4 font-display text-[28px] font-semibold leading-none tracking-tight">
        <Counter value={value} format={format} />
      </div>
      <div className="mt-2 text-[13px] font-medium text-muted">{label}</div>
      {hint && <div className="mt-1 text-xs text-muted/70">{hint}</div>}
      <div className="pointer-events-none absolute -bottom-10 -right-10 h-28 w-28 rounded-full bg-gradient-to-br from-gold/10 to-transparent opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
    </motion.button>
  );
}
