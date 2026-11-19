"use client";
import { useState } from "react";
import { RANGE_LABELS, resolveRange, type DateRange, type RangePreset } from "@pp/shared";
import { cn } from "@/lib/cn";
import { Input } from "./primitives";

export interface RangeValue extends DateRange { preset: RangePreset }
export const rangeFor = (preset: Exclude<RangePreset, "custom">): RangeValue => ({ preset, ...resolveRange(preset) });

const DEFAULT: Exclude<RangePreset, "custom">[] = ["week", "month", "lastMonth", "last90", "year"];

/** One control for every "show me this period" in the app. Custom dates are two date boxes. */
export function RangePicker({ value, onChange, presets = DEFAULT, className }: { value: RangeValue; onChange: (v: RangeValue) => void; presets?: Exclude<RangePreset, "custom">[]; className?: string }) {
  const [open, setOpen] = useState(value.preset === "custom");
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex flex-wrap gap-1 rounded-xl bg-bg2 p-1">
        {presets.map((p) => (
          <button key={p} onClick={() => { setOpen(false); onChange(rangeFor(p)); }} className={cn("rounded-lg px-3 py-1.5 text-[14px] font-semibold transition", value.preset === p ? "bg-panel text-text shadow-soft" : "text-muted hover:text-text")}>{RANGE_LABELS[p]}</button>
        ))}
        <button onClick={() => { setOpen(true); onChange({ ...value, preset: "custom" }); }} className={cn("rounded-lg px-3 py-1.5 text-[14px] font-semibold transition", value.preset === "custom" ? "bg-panel text-text shadow-soft" : "text-muted hover:text-text")}>Custom</button>
      </div>
      {open && (
        <div className="flex items-center gap-2">
          <Input type="date" value={value.from} max={value.to} onChange={(e) => onChange({ preset: "custom", from: e.target.value, to: value.to })} className="h-10 w-[150px]" />
          <span className="text-muted">to</span>
          <Input type="date" value={value.to} min={value.from} onChange={(e) => onChange({ preset: "custom", from: value.from, to: e.target.value })} className="h-10 w-[150px]" />
        </div>
      )}
    </div>
  );
}
