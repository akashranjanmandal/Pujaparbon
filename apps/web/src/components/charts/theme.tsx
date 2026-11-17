"use client";
import type { TooltipProps } from "recharts";
import { compactINR, formatINR } from "@pp/shared";

/** Read a CSS colour token so charts follow Sandhya / Prabhat themes. */
export const tok = (name: string, alpha = 1) => `rgb(var(--${name}) / ${alpha})`;

export const axis = { stroke: tok("muted", 0.5), fontSize: 11, tickLine: false, axisLine: false } as const;

export function GlassTooltip({ active, payload, label, money = true, labelFormat }: TooltipProps<number, string> & { money?: boolean; labelFormat?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-line/20 bg-bg2/95 px-4 py-3 shadow-glow backdrop-blur-xl">
      <div className="mb-1.5 text-xs font-semibold text-gold">{labelFormat ? labelFormat(String(label)) : label}</div>
      {payload.filter((p) => Number(p.value) !== 0).map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-3 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted">{p.name}</span>
          <span className="ml-auto pl-4 font-semibold text-text num">{money ? formatINR(Number(p.value), { decimals: false }) : Number(p.value).toLocaleString("en-IN")}</span>
        </div>
      ))}
    </div>
  );
}

export const moneyTick = (v: number) => compactINR(v);
