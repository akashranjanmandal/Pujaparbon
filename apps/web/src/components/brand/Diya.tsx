/** Clay diya with a living flame. Used as the glow behind KPIs and for "lit" active states. */
export function Diya({ size = 28, lit = true, className = "" }: { size?: number; lit?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={className} aria-hidden>
      <defs>
        <radialGradient id="diya-glow" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="rgb(var(--marigold))" stopOpacity="0.7" />
          <stop offset="100%" stopColor="rgb(var(--marigold))" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="diya-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="rgb(var(--sindoor))" />
          <stop offset="55%" stopColor="rgb(var(--marigold))" />
          <stop offset="100%" stopColor="rgb(var(--shiuli))" />
        </linearGradient>
      </defs>
      {lit && <circle cx="20" cy="15" r="14" fill="url(#diya-glow)" />}
      {lit && (
        <g className="origin-[20px_22px] animate-flicker">
          <path d="M20 6 C 24 12, 24.5 17, 20 21.5 C 15.5 17, 16 12, 20 6 Z" fill="url(#diya-flame)" />
          <path d="M20 12 C 21.6 15, 21.6 17.5, 20 19.5 C 18.4 17.5, 18.4 15, 20 12 Z" fill="rgb(var(--shiuli))" opacity="0.9" />
        </g>
      )}
      <path d="M5 23 C 9 33, 31 33, 35 23 C 30 26, 10 26, 5 23 Z" fill="rgb(var(--sindoor-deep))" />
      <path d="M5 23 C 10 26, 30 26, 35 23" fill="none" stroke="rgb(var(--gold))" strokeWidth="1.2" />
      <path d="M32 23.5 L 37 21" stroke="rgb(var(--sindoor-deep))" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
