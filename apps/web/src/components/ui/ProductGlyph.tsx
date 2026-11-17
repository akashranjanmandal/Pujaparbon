import { cn } from "@/lib/cn";

const SETS = [["--primary-tint", "--primary"], ["--lav-tint", "--lav"], ["--peach-tint", "--peach"]] as const;

/** Pastel monogram tile for a product — consistent per name, no stock imagery required. */
export function ProductGlyph({ name, size = 36, className }: { name?: string | null; size?: number; className?: string }) {
  const n = (name ?? "?").trim();
  const initials = n.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w[0] ?? "")).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  let h = 0;
  for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [bg, fg] = SETS[h % 3];
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-xl font-semibold", className)} style={{ width: size, height: size, fontSize: size * 0.36, background: `rgb(var(${bg}))`, color: `rgb(var(${fg}))` }}>
      {initials}
    </span>
  );
}
