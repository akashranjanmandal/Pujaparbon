import { Alpana } from "./Alpana";

export function AlpanaLoader({ label = "Lighting the lamps…" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <Alpana size={120} spin />
      <div className="font-bangla text-sm text-gold/80">{label}</div>
    </div>
  );
}
