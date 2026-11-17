import { cn } from "@/lib/cn";

/** Monogram: a lotus-in-alpana mark with the Bengali wordmark. */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden>
      <defs>
        <linearGradient id="lm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgb(var(--sindoor))" />
          <stop offset="100%" stopColor="rgb(var(--sindoor-deep))" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="23" fill="url(#lm)" />
      <circle cx="24" cy="24" r="19.5" fill="none" stroke="rgb(var(--gold))" strokeWidth="0.8" strokeDasharray="1 2.2" />
      {Array.from({ length: 8 }, (_, i) => (
        <path key={i} d="M24 10 C 27 15, 27 19, 24 22 C 21 19, 21 15, 24 10 Z" fill="rgb(var(--shiuli))" opacity={i % 2 ? 0.55 : 0.95} transform={`rotate(${i * 45} 24 24)`} />
      ))}
      <circle cx="24" cy="24" r="3.6" fill="rgb(var(--marigold))" />
    </svg>
  );
}

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark />
      {!compact && (
        <div className="leading-none">
          <div className="font-display text-[19px] font-semibold tracking-tight">
            Puja <span className="gold-text">Parbon</span>
          </div>
          <div className="mt-1 font-bangla text-[11px] tracking-wide text-muted">পূজা পার্বণ · Seller OS</div>
        </div>
      )}
    </div>
  );
}
