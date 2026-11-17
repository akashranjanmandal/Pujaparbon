"use client";
import { useEffect, useState } from "react";
import { CHANNELS } from "@pp/shared";

/**
 * Schematic of the business: marketplaces feed the warehouse, the warehouse ships to cities.
 * Packets travel along the wires with SVG animateMotion — no canvas, no libraries.
 */
const CITIES = [["Kolkata", 120], ["Delhi", 175], ["Mumbai", 230], ["Bengaluru", 285], ["Guwahati", 340], ["Hyderabad", 395]] as const;

export function Network({ className = "" }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const chans = CHANNELS.filter((c) => !["OFFLINE", "OWN_STORE"].includes(c.code));
  const hub = { x: 320, y: 260 };
  const inPath = (y: number) => `M110 ${y} C 210 ${y}, 220 ${hub.y}, ${hub.x - 34} ${hub.y}`;
  const outPath = (y: number) => `M${hub.x + 34} ${hub.y} C 430 ${hub.y}, 440 ${y}, 530 ${y}`;
  if (!mounted) return <svg viewBox="0 0 640 520" className={className} aria-hidden />;
  return (
    <svg viewBox="0 0 640 520" className={className} aria-hidden>
      <defs>
        <radialGradient id="hubglow"><stop offset="0" stopColor="rgb(var(--primary))" stopOpacity="0.45" /><stop offset="1" stopColor="rgb(var(--primary))" stopOpacity="0" /></radialGradient>
      </defs>
      {chans.map((c, i) => {
        const y = 120 + i * 70;
        const d = inPath(y);
        return (
          <g key={c.code}>
            <path d={d} fill="none" stroke="rgb(var(--line) / 0.12)" />
            <path d={d} fill="none" stroke={c.color} strokeOpacity="0.6" strokeDasharray="1 8" className="animate-flow" />
            {[0, 1].map((k) => (
              <circle key={k} r="3" fill={c.color}>
                <animateMotion dur={`${2.6 + i * 0.35}s`} begin={`${k * 1.3 + i * 0.2}s`} repeatCount="indefinite" path={d} />
              </circle>
            ))}
            <rect x="34" y={y - 13} width="76" height="26" rx="6" fill="rgb(var(--panel))" stroke="rgb(var(--line) / 0.12)" />
            <rect x="40" y={y - 3} width="6" height="6" rx="1.5" fill={c.color} />
            <text x="52" y={y + 4} fontSize="12.5" fill="rgb(var(--text))" fontFamily="var(--font-sans)">{c.name}</text>
          </g>
        );
      })}
      {CITIES.map(([name, y], i) => {
        const d = outPath(y);
        return (
          <g key={name}>
            <path d={d} fill="none" stroke="rgb(var(--line) / 0.12)" />
            <circle r="2.5" fill="rgb(var(--text))">
              <animateMotion dur={`${2.2 + i * 0.3}s`} begin={`${0.6 + i * 0.25}s`} repeatCount="indefinite" path={d} />
            </circle>
            <circle cx="534" cy={y} r="3" fill="rgb(var(--leaf))" />
            <text x="544" y={y + 4} fontSize="12.5" fill="rgb(var(--muted))" fontFamily="var(--font-mono)">{name.toUpperCase()}</text>
          </g>
        );
      })}
      <circle cx={hub.x} cy={hub.y} r="90" fill="url(#hubglow)" />
      <circle cx={hub.x} cy={hub.y} r="54" fill="none" stroke="rgb(var(--primary) / 0.35)" strokeDasharray="2 6" className="origin-center" style={{ transformOrigin: `${hub.x}px ${hub.y}px`, animation: "spinslow 40s linear infinite" }} />
      <rect x={hub.x - 34} y={hub.y - 34} width="68" height="68" rx="14" fill="rgb(var(--panel2))" stroke="rgb(var(--primary) / 0.7)" />
      <path d={`M${hub.x - 14} ${hub.y - 6} L${hub.x} ${hub.y - 14} L${hub.x + 14} ${hub.y - 6} L${hub.x} ${hub.y + 2} Z`} fill="rgb(var(--primary))" />
      <path d={`M${hub.x - 14} ${hub.y + 2} L${hub.x} ${hub.y + 10} L${hub.x + 14} ${hub.y + 2}`} stroke="rgb(var(--primary))" strokeWidth="2" fill="none" />
      <text x={hub.x} y={hub.y + 58} textAnchor="middle" fontSize="12" fill="rgb(var(--muted))" fontFamily="var(--font-mono)" letterSpacing="2">SARISHA · WB</text>
    </svg>
  );
}
