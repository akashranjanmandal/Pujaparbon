"use client";
import { motion } from "framer-motion";
import { compactINR } from "@pp/shared";

/** Hand-drawn donut (no library) so the arcs can draw in like an alpana ring. */
export function Donut({ data, size = 200, label, sub }: { data: { name: string; value: number; color: string }[]; size?: number; label: string; sub: string }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = 70, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" width={size} height={size} className="-rotate-90">
        <circle cx="100" cy="100" r={r} fill="none" stroke="rgb(var(--line) / 0.08)" strokeWidth="22" />
        {data.map((d, i) => {
          const len = (d.value / total) * c;
          const off = acc;
          acc += len;
          return (
            <motion.circle
              key={d.name}
              cx="100" cy="100" r={r} fill="none" stroke={d.color} strokeWidth="22" strokeLinecap="butt"
              strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
              initial={{ strokeDashoffset: -off + len }}
              animate={{ strokeDashoffset: -off }}
              transition={{ duration: 1.2, delay: 0.2 + i * 0.12, ease: [0.2, 0.8, 0.2, 1] }}
              style={{ filter: `drop-shadow(0 0 6px ${d.color}66)` }}
            />
          );
        })}
        <circle cx="100" cy="100" r="52" fill="none" stroke="rgb(var(--gold) / 0.35)" strokeDasharray="1 5" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="font-display text-2xl font-semibold">{label}</div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted">{sub}</div>
      </div>
    </div>
  );
}

export const shareOf = (v: number, total: number) => `${Math.round((v / (total || 1)) * 100)}%`;
export { compactINR };
