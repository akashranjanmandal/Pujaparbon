"use client";
import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";

/** A petal pointing up, from radius r0 to r1, half-width w. */
const petal = (r0: number, r1: number, w: number) => {
  const m = r0 + (r1 - r0) * 0.45;
  return `M0 ${-r0} C ${w} ${-m}, ${w * 0.55} ${-r1 + (r1 - r0) * 0.12}, 0 ${-r1} C ${-w * 0.55} ${-r1 + (r1 - r0) * 0.12}, ${-w} ${-m}, 0 ${-r0} Z`;
};
const scallop = (r: number, n: number, depth: number) => {
  let d = "";
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
    const p = (a: number, rr: number) => `${(Math.sin(a) * rr).toFixed(2)} ${(-Math.cos(a) * rr).toFixed(2)}`;
    d += `${i === 0 ? `M${p(a0, r)}` : ""} Q${p(am, r + depth)} ${p(a1, r)} `;
  }
  return d + "Z";
};

interface Props {
  size?: number;
  className?: string;
  /** Animate the lines being drawn on mount. */
  draw?: boolean;
  spin?: boolean;
  strokeWidth?: number;
  tone?: "gold" | "shiuli" | "sindoor";
  delay?: number;
}

/** Procedural alpana mandala — the brand's signature motif. */
export function Alpana({ size = 320, className, draw = true, spin = false, strokeWidth = 1.2, tone = "gold", delay = 0 }: Props) {
  const reduce = useReducedMotion();
  const id = useId().replace(/:/g, "");
  const stroke = tone === "gold" ? "rgb(var(--gold))" : tone === "shiuli" ? "rgb(var(--shiuli))" : "rgb(var(--sindoor))";
  const anim = (i: number) =>
    draw && !reduce
      ? { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 }, transition: { duration: 2.2, delay: delay + i * 0.18, ease: [0.6, 0.05, 0.3, 1] as const } }
      : {};
  const ring = (n: number, r0: number, r1: number, w: number, i: number, offset = 0, fill?: string) =>
    Array.from({ length: n }, (_, k) => (
      <motion.path key={`${i}-${k}`} d={petal(r0, r1, w)} transform={`rotate(${(360 / n) * k + offset})`} fill={fill ?? "none"} stroke={stroke} strokeWidth={strokeWidth} {...anim(i)} />
    ));
  const dots = (n: number, r: number, rad: number, i: number) =>
    Array.from({ length: n }, (_, k) => {
      const a = (k / n) * Math.PI * 2;
      return <motion.circle key={`d${i}-${k}`} cx={Math.sin(a) * r} cy={-Math.cos(a) * r} r={rad} fill={stroke} initial={draw && !reduce ? { opacity: 0, scale: 0 } : undefined} animate={{ opacity: 1, scale: 1 }} transition={{ delay: delay + i * 0.18 + k * 0.01, duration: 0.4 }} />;
    });

  return (
    <svg viewBox="-160 -160 320 320" width={size} height={size} className={className} aria-hidden>
      <defs>
        <radialGradient id={`g${id}`}>
          <stop offset="0%" stopColor="rgb(var(--marigold))" stopOpacity="0.55" />
          <stop offset="100%" stopColor="rgb(var(--marigold))" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className={spin && !reduce ? "origin-center animate-spinslow" : undefined} style={{ transformBox: "fill-box" }}>
        <circle r="22" fill={`url(#g${id})`} />
        <motion.circle r="9" fill="none" stroke={stroke} strokeWidth={strokeWidth} {...anim(0)} />
        {dots(8, 15, 1.4, 0)}
        {ring(8, 18, 52, 13, 1)}
        {ring(8, 24, 44, 5, 2, 0)}
        <motion.circle r="58" fill="none" stroke={stroke} strokeWidth={strokeWidth * 0.8} strokeDasharray="1 4" {...anim(3)} />
        {ring(16, 62, 98, 9, 4, 11.25)}
        {dots(16, 66, 1.6, 5)}
        <motion.path d={scallop(104, 32, 7)} fill="none" stroke={stroke} strokeWidth={strokeWidth} {...anim(6)} />
        {ring(24, 116, 138, 5, 7)}
        {dots(48, 145, 1.3, 8)}
        <motion.circle r="152" fill="none" stroke={stroke} strokeWidth={strokeWidth * 0.6} strokeOpacity="0.5" {...anim(9)} />
      </g>
    </svg>
  );
}
