import { cn } from "@/lib/cn";

/** Deterministic monogram tile for a product: no stock imagery needed, still easy to scan. */
export function ProductGlyph({ name, size = 36, className }: { name?: string | null; size?: number; className?: string }) {
  const n = (name ?? "?").trim();
  const initials = n.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w[0] ?? "")).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  let h = 0;
  for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-lg border border-line/10 font-mono font-semibold text-text/90", className)}
      style={{ width: size, height: size, fontSize: size * 0.34, background: `linear-gradient(135deg, hsl(${h} 30% 22% / 0.9), hsl(${(h + 40) % 360} 25% 12% / 0.9))` }}
    >
      {initials}
    </span>
  );
}
