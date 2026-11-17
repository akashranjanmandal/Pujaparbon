export function Loader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <div className="flex gap-1.5">
        {["bg-primary-soft", "bg-lav-soft", "bg-peach-soft"].map((c, i) => (
          <span key={c} className={`h-2.5 w-2.5 animate-bounce rounded-full ${c}`} style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>
      <div className="text-[15px] text-muted">{label}…</div>
    </div>
  );
}
