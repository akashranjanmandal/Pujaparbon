import { cn } from "@/lib/cn";

/** Geometric "PP" monogram: two stacked chevrons inside a rounded square — reads as a parcel and a forward arrow. */
export function LogoMark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden>
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" fill="rgb(var(--sindoor))" />
      <path d="M9 10.5 L16 7 L23 10.5 L16 14 Z" fill="white" fillOpacity="0.95" />
      <path d="M9 15.5 L16 19 L23 15.5" stroke="white" strokeWidth="2" fill="none" strokeLinejoin="round" strokeOpacity="0.8" />
      <path d="M9 20.5 L16 24 L23 20.5" stroke="white" strokeWidth="2" fill="none" strokeLinejoin="round" strokeOpacity="0.55" />
    </svg>
  );
}

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <div className="leading-none">
          <div className="text-[14px] font-semibold tracking-tight">Puja Parbon</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Seller OS</div>
        </div>
      )}
    </div>
  );
}
