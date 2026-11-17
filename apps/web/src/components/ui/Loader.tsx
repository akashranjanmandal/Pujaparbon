/** Minimal loading state: a scanning bar with a mono caption. */
export function Loader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <div className="relative h-px w-48 overflow-hidden bg-line/10">
        <div className="absolute inset-y-0 w-16 animate-shimmer bg-gradient-to-r from-transparent via-sindoor to-transparent" style={{ backgroundSize: "200% 100%" }} />
      </div>
      <div className="label">{label}…</div>
    </div>
  );
}
