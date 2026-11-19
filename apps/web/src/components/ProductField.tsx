"use client";
import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export interface PickedProduct { id?: string; name: string; category: string; unit: string; sellingPricePaise?: number; onHand?: number; avgCostPaise?: number }
export interface CatalogItem { id: string; name: string; category: string; unit: string; sellingPricePaise: number; onHand: number; avgCostPaise: number }

/**
 * Type a product name: pick one he already has, or create a new one on the spot.
 * New products need a category, which he also just types (it exists the moment he uses it).
 */
export function ProductField({ value, onChange, catalog, categories }: { value: PickedProduct | null; onChange: (p: PickedProduct | null) => void; catalog: CatalogItem[]; categories: string[] }) {
  const [text, setText] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setText(value?.name ?? ""), [value?.name]);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const q = text.trim().toLowerCase();
  const matches = catalog.filter((c) => !q || c.name.toLowerCase().includes(q)).slice(0, 6);
  const exact = catalog.some((c) => c.name.toLowerCase() === q);
  const isNew = value && !value.id;

  return (
    <div ref={ref} className="relative space-y-2">
      <Input
        value={text}
        placeholder="Item name, e.g. Steel bottle 1L"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          onChange(e.target.value.trim() ? { name: e.target.value.trim(), category: value?.id ? "" : value?.category ?? "", unit: value?.unit ?? "pcs" } : null);
        }}
      />
      {open && (matches.length > 0 || (q && !exact)) && (
        <div className="absolute inset-x-0 top-12 z-20 max-h-72 overflow-y-auto rounded-xl border border-line/10 bg-panel p-1 shadow-lift">
          {matches.map((m) => (
            <button key={m.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange({ id: m.id, name: m.name, category: m.category, unit: m.unit, sellingPricePaise: m.sellingPricePaise, onHand: m.onHand, avgCostPaise: m.avgCostPaise }); setText(m.name); setOpen(false); }} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-primary-tint">
              <span><span className="block text-[15px] font-medium">{m.name}</span><span className="text-[13px] text-muted">{m.category} · {m.onHand} in stock</span></span>
            </button>
          ))}
          {q && !exact && (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange({ name: text.trim(), category: "", unit: "pcs" }); setOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-primary hover:bg-primary-tint">
              <Plus className="h-4 w-4" /> <span className="text-[15px] font-semibold">Add “{text.trim()}” as a new item</span>
            </button>
          )}
        </div>
      )}
      {value && (
        <div className={cn("flex flex-wrap items-center gap-2 text-[13.5px]", isNew ? "" : "text-muted")}>
          {isNew ? (
            <>
              <span className="rounded-full bg-peach-tint px-2.5 py-0.5 font-semibold text-peach">New item</span>
              <Input list="category-list" value={value.category} placeholder="Category (type any name)" onChange={(e) => onChange({ ...value, category: e.target.value })} className="h-9 max-w-[220px] text-[14px]" />
              <Input value={value.unit} onChange={(e) => onChange({ ...value, unit: e.target.value })} className="h-9 w-20 text-[14px]" aria-label="Unit" />
              <datalist id="category-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </>
          ) : (
            <span>{value.category} · {value.onHand ?? 0} {value.unit} in stock now</span>
          )}
        </div>
      )}
    </div>
  );
}
