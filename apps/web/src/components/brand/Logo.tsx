import { cn } from "@/lib/cn";

/** Monogram: an open parcel seen from above — a square with folded flaps, peach seal. */
export function LogoMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 34 34" width={size} height={size} className={className} aria-hidden>
      <rect width="34" height="34" rx="10" fill="rgb(var(--primary))" />
      <path d="M9 13 L17 9 L25 13 L17 17 Z" fill="rgb(var(--primary-soft))" />
      <path d="M9 13 V21.5 L17 25.5 V17 Z" fill="white" fillOpacity="0.92" />
      <path d="M25 13 V21.5 L17 25.5 V17 Z" fill="white" fillOpacity="0.7" />
      <circle cx="26.5" cy="7.5" r="3.5" fill="rgb(var(--peach-soft))" stroke="rgb(var(--primary))" strokeWidth="1.5" />
    </svg>
  );
}

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <div className="leading-none">
          <div className="text-[17px] font-semibold tracking-tight">Puja Parbon</div>
          <div className="mt-1 text-[13px] font-medium text-muted">Seller OS</div>
        </div>
      )}
    </div>
  );
}
