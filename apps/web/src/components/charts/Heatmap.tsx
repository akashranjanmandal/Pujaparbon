"use client";
import { motion } from "framer-motion";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Orders by weekday × hour, lit like rows of diyas: brighter = busier. */
export function Heatmap({ grid }: { grid: number[][] }) {
  const max = Math.max(1, ...grid.flat());
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="ml-10 grid grid-cols-24 gap-[3px] text-[10px] text-muted" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
          {Array.from({ length: 24 }, (_, h) => <div key={h} className="text-center">{h % 3 === 0 ? `${h}` : ""}</div>)}
        </div>
        {grid.map((row, d) => (
          <div key={d} className="mt-[3px] flex items-center gap-2">
            <div className="w-8 text-right text-[11px] text-muted">{DAYS[d]}</div>
            <div className="grid flex-1 gap-[3px]" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
              {row.map((v, h) => {
                const k = v / max;
                return (
                  <motion.div
                    key={h}
                    title={`${DAYS[d]} ${h}:00 — ${v} orders`}
                    initial={{ opacity: 0, scale: 0.4 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (d * 24 + h) * 0.003 }}
                    className="aspect-square rounded-[5px]"
                    style={{
                      background: k === 0 ? "rgb(var(--line) / 0.06)" : `rgb(var(--marigold) / ${0.12 + k * 0.88})`,
                      boxShadow: k > 0.6 ? `0 0 ${8 + k * 10}px rgb(var(--marigold) / ${k * 0.6})` : undefined,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
