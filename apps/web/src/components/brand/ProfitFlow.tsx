"use client";
import { useEffect, useState } from "react";

/** The business in one picture: buy at the market, bring it home, sell on platforms, see the profit. Dots travel along the path. */
export function ProfitFlow({ className = "" }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const nodes = [
    { x: 70, label: "Market", sub: "Buy in a lot", fill: "var(--lav-soft)", stroke: "var(--lav)" },
    { x: 250, label: "Your shop", sub: "Stock and QR", fill: "var(--primary-soft)", stroke: "var(--primary)" },
    { x: 430, label: "Platforms", sub: "Flipkart · Amazon", fill: "var(--peach-soft)", stroke: "var(--peach)" },
    { x: 610, label: "Profit", sub: "Any date range", fill: "255 255 255", stroke: "var(--leaf)" },
  ];
  const y = 90;
  const path = `M${nodes[0].x} ${y} L${nodes[3].x} ${y}`;
  if (!mounted) return <svg viewBox="0 0 680 190" className={className} aria-hidden />;
  return (
    <svg viewBox="0 0 680 190" className={className} aria-hidden>
      <path d={path} stroke="rgb(var(--line) / 0.15)" strokeWidth="3" strokeLinecap="round" />
      <path d={path} stroke="rgb(var(--primary))" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 12" className="animate-flow" />
      {[0, 1, 2].map((k) => (
        <circle key={k} r="5" fill="rgb(var(--peach))" opacity="0">
          <set attributeName="opacity" to="1" begin={`${k * 2}s`} />
          <animateMotion dur="6s" begin={`${k * 2}s`} repeatCount="indefinite" path={path} />
        </circle>
      ))}
      {nodes.map((n, i) => (
        <g key={n.label}>
          <circle cx={n.x} cy={y} r="44" fill={`rgb(${n.fill})`} stroke={`rgb(${n.stroke})`} strokeWidth="2" />
          <text x={n.x} y={y + 7} textAnchor="middle" fontSize="19" fontWeight="600" fill="rgb(var(--text))">{i + 1}</text>
          <text x={n.x} y={y + 74} textAnchor="middle" fontSize="16" fontWeight="600" fill="rgb(var(--text))">{n.label}</text>
          <text x={n.x} y={y + 94} textAnchor="middle" fontSize="13.5" fill="rgb(var(--muted))">{n.sub}</text>
        </g>
      ))}
    </svg>
  );
}
