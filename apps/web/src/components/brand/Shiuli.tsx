"use client";
import { useEffect, useRef } from "react";

interface Flower { x: number; y: number; vy: number; vx: number; rot: number; vr: number; size: number; sway: number; phase: number }

/**
 * Night-jasmine (shiuli) blossoms drifting down — the flower of Pujo season.
 * Canvas-based so dozens of flowers cost almost nothing; pauses when the tab is hidden.
 */
export function Shiuli({ density = 18, className = "" }: { density?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const make = (initial = false): Flower => ({
      x: Math.random() * w, y: initial ? Math.random() * h : -20, vy: 0.25 + Math.random() * 0.55, vx: -0.15 + Math.random() * 0.3,
      rot: Math.random() * Math.PI * 2, vr: (-0.5 + Math.random()) * 0.02, size: 5 + Math.random() * 6, sway: 0.4 + Math.random() * 0.8, phase: Math.random() * 6,
    });
    let flowers = Array.from({ length: density }, () => make(true));
    const styles = getComputedStyle(document.documentElement);
    const petal = `rgb(${styles.getPropertyValue("--shiuli").trim().split(" ").join(",")})`;
    const stem = `rgb(${styles.getPropertyValue("--stem").trim().split(" ").join(",")})`;

    const drawFlower = (f: Flower) => {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = petal;
      for (let i = 0; i < 6; i++) {
        ctx.rotate((Math.PI * 2) / 6);
        ctx.beginPath();
        ctx.ellipse(0, -f.size * 0.62, f.size * 0.3, f.size * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = stem;
      ctx.beginPath();
      ctx.arc(0, 0, f.size * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    let t = 0;
    const tick = () => {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);
      for (const f of flowers) {
        f.y += f.vy;
        f.x += f.vx + Math.sin(t * f.sway + f.phase) * 0.35;
        f.rot += f.vr;
        drawFlower(f);
      }
      flowers = flowers.map((f) => (f.y > h + 20 ? make() : f));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onVis = () => (document.hidden ? cancelAnimationFrame(raf) : (raf = requestAnimationFrame(tick)));
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [density]);

  return <canvas ref={ref} className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} aria-hidden />;
}
