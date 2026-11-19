"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Boxes, ClipboardCheck, Minus, Plus, Printer, Search } from "lucide-react";
import { formatINR } from "@pp/shared";
import { Drawer } from "@/components/ui/Drawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table } from "@/components/ui/Table";
import { Badge, Button, Card, Empty, Field, Input, ProductGlyphRow } from "@/components/ui/primitives";
import { api, openFile } from "@/lib/api";
import { cn } from "@/lib/cn";
import { compactINR, timeAgo } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { paise } from "@/lib/money";
import { ProductGlyph } from "@/components/ui/ProductGlyph";
import type { Product } from "@/lib/summary";

interface Res { items: Product[]; categories: { name: string; products: number; units: number; valuePaise: number }[]; totals: { products: number; units: number; valuePaise: number; potentialPaise: number; lastCountAt: number | null } }

function StockInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [counting, setCounting] = useState(params.get("count") === "1");
  const [adding, setAdding] = useState(false);
  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  if (category) qs.set("category", category);
  const { data, isLoading } = useQuery({ queryKey: ["products", qs.toString()], queryFn: () => api.get<Res>(`/products?${qs}`) });
  const t = data?.totals;

  return (
    <div>
      <PageHeader title="Stock" subtitle="Everything you have, what it cost you, and what it is worth. Update your counts every day or two and the numbers stay true."
        actions={
          <>
            <Button icon={<Printer className="h-4 w-4" />} onClick={() => data && openFile("/products/labels", { productIds: data.items.map((i) => i.id), baseUrl: window.location.origin })}>Print QR labels</Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Add item</Button>
            <Button variant="primary" icon={<ClipboardCheck className="h-4 w-4" />} onClick={() => setCounting(true)}>Update counts</Button>
          </>
        } />

      {t && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tile label="Stock at what it cost you" value={compactINR(t.valuePaise)} tone="bg-primary-soft text-primary" />
          <Tile label="Worth at your prices" value={compactINR(t.potentialPaise)} sub={t.valuePaise ? `${Math.round(((t.potentialPaise - t.valuePaise) / t.valuePaise) * 100)}% above cost` : undefined} tone="bg-lav-soft text-lav" />
          <Tile label="Pieces on the shelf" value={t.units.toLocaleString("en-IN")} sub={`${t.products} items`} tone="bg-panel text-text" />
          <Tile label="Last counted" value={t.lastCountAt ? timeAgo(t.lastCountAt) : "Never"} sub={t.lastCountAt ? undefined : "Press Update counts"} tone="bg-peach-soft text-peach" />
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input placeholder="Search by name or code" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[{ name: "", label: "All" }, ...(data?.categories.map((c) => ({ name: c.name, label: `${c.name} · ${c.products}` })) ?? [])].map((c) => (
            <button key={c.name} onClick={() => setCategory(c.name)} className={cn("rounded-full border px-4 py-2 text-[14.5px] font-semibold transition", category === c.name ? "border-primary bg-primary text-white" : "border-line/15 bg-panel text-text/75 hover:border-primary hover:text-primary")}>{c.label}</button>
          ))}
        </div>
      </div>

      <Card plain className="overflow-hidden">
        <Table rows={data?.items} loading={isLoading} onRowClick={(p) => router.push(`/products/${p.id}`)}
          empty={<Empty icon={<Boxes />} title="No items yet" body="Record your first buy, or add an item you already have." action={<Link href="/buy/new"><Button variant="primary">New buy</Button></Link>} />}
          columns={[
            { key: "item", header: "Item", cell: (p) => <ProductGlyphRow name={p.name} sub={p.category} /> },
            { key: "stock", header: "In stock", align: "right", cell: (p) => <span className={cn("text-[17px] font-semibold", p.onHand <= 0 && "text-sindoor")}>{p.onHand.toLocaleString("en-IN")}</span> },
            { key: "cost", header: "Cost each", align: "right", cell: (p) => (p.avgCostPaise ? formatINR(p.avgCostPaise) : "—") },
            { key: "price", header: "Your price", align: "right", cell: (p) => (p.sellingPricePaise ? <span>{formatINR(p.sellingPricePaise)} {p.avgCostPaise > 0 && <Badge tone={p.marginPct >= 0 ? "green" : "orange"}>{p.marginPct >= 0 ? "+" : ""}{p.marginPct}%</Badge>}</span> : <span className="text-muted">Not set</span>) },
            { key: "value", header: "Value at cost", align: "right", cell: (p) => formatINR(p.valuePaise, { decimals: false }) },
            { key: "counted", header: "Last counted", cell: (p) => <span className="text-muted">{p.lastCountAt ? timeAgo(p.lastCountAt) : "Never"}</span> },
          ]} />
      </Card>

      {counting && data && <CountSheet items={data.items} onClose={() => setCounting(false)} />}
      <AddItem open={adding} onClose={() => setAdding(false)} categories={data?.categories.map((c) => c.name) ?? []} />
    </div>
  );
}

const Tile = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) => (
  <div className={`rounded-2xl p-5 ${tone}`}><div className="text-[14px] font-semibold">{label}</div><div className="display mt-1 text-[30px] leading-none text-text">{value}</div>{sub && <div className="mt-2 text-[13.5px] text-text/60">{sub}</div>}</div>
);

/** His routine: type what is really on the shelf. Everything starts at what the app thinks, so he only touches what is different. */
function CountSheet({ items, onClose }: { items: Product[]; onClose: () => void }) {
  const [counts, setCounts] = useState<Record<string, string>>(() => Object.fromEntries(items.map((i) => [i.id, String(Math.max(0, i.onHand))])));
  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);
  const rows = useMemo(() => items.map((i) => { const c = counts[i.id]; const n = c === "" ? i.onHand : Math.max(0, Math.floor(Number(c) || 0)); return { ...i, counted: n, diff: n - Math.max(0, i.onHand) }; }), [items, counts]);
  const changed = rows.filter((r) => r.diff !== 0);
  const down = changed.filter((r) => r.diff < 0), up = changed.filter((r) => r.diff > 0);
  const save = useAction(() => api.post<{ changed: number; unitsDown: number; unitsUp: number; valueDownPaise: number }>("/stock/counts", { counts: rows.map((r) => ({ productId: r.id, counted: r.counted })) }), {
    success: (r) => (r.changed ? `Counts saved. ${r.unitsDown} pieces fewer, worth ${formatINR(r.valueDownPaise, { decimals: false })}.` : "Counts saved. Everything matched."),
    invalidate: ["products"], onSuccess: onClose,
  });
  const set = (id: string, v: string) => setCounts((c) => ({ ...c, [id]: v.replace(/\D/g, "") }));
  const step = (id: string, d: number, cur: number) => setCounts((c) => ({ ...c, [id]: String(Math.max(0, cur + d)) }));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div className="mx-auto max-w-3xl px-4 pb-48 pt-6 sm:px-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div><div className="eyebrow">Update counts</div><h1 className="display mt-1 text-[34px] leading-tight">What is on the shelf today?</h1><p className="mt-1 text-[15.5px] text-muted">Change only what is different. Untouched items are marked as checked.</p></div>
          <Button onClick={onClose}>Cancel</Button>
        </div>
        <div className="space-y-3">
          {rows.map((r) => (
            <motion.div key={r.id} layout className={cn("flex items-center gap-3 rounded-2xl border bg-panel p-4 shadow-soft", r.diff !== 0 ? "border-peach/50 bg-peach-tint/40" : "border-line/[0.08]")}>
              <ProductGlyph name={r.name} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-semibold">{r.name}</div>
                <div className="text-[13.5px] text-muted">{r.category} · app says {Math.max(0, r.onHand)}{r.diff !== 0 && <b className={cn("ml-2", r.diff < 0 ? "text-peach" : "text-leaf")}>{r.diff > 0 ? "+" : "−"}{Math.abs(r.diff)}</b>}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => step(r.id, -1, r.counted)} className="grid h-11 w-11 place-items-center rounded-xl border border-line/15 bg-panel text-text active:scale-95" aria-label="One less"><Minus className="h-4 w-4" /></button>
                <input inputMode="numeric" value={counts[r.id]} onChange={(e) => set(r.id, e.target.value)} onFocus={(e) => e.currentTarget.select()} className="h-11 w-[72px] rounded-xl border border-line/20 bg-panel text-center text-[18px] font-semibold focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary-soft/50" aria-label={`Count for ${r.name}`} />
                <button onClick={() => step(r.id, 1, r.counted)} className="grid h-11 w-11 place-items-center rounded-xl border border-line/15 bg-panel text-text active:scale-95" aria-label="One more"><Plus className="h-4 w-4" /></button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line/10 bg-panel/95 p-4 shadow-lift backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div className="text-[15px]">
            {changed.length === 0 ? <span className="text-muted">Nothing changed so far</span> : (
              <span><b className="font-semibold">{changed.length} {changed.length === 1 ? "item" : "items"} changed.</b>{" "}
                {down.length > 0 && <span className="text-peach">{down.reduce((s, r) => s - r.diff, 0)} pieces fewer (≈ {formatINR(down.reduce((s, r) => s + -r.diff * r.avgCostPaise, 0), { decimals: false })}). </span>}
                {up.length > 0 && <span className="text-leaf">{up.reduce((s, r) => s + r.diff, 0)} more.</span>}</span>
            )}
          </div>
          <Button variant="primary" size="lg" loading={save.isPending} onClick={() => save.mutate(undefined)}>Save counts</Button>
        </div>
      </div>
    </div>
  );
}

function AddItem({ open, onClose, categories }: { open: boolean; onClose: () => void; categories: string[] }) {
  const [f, setF] = useState({ name: "", category: "", unit: "pcs", price: "", qty: "", cost: "" });
  const save = useAction(() => api.post("/products", { name: f.name, category: f.category, unit: f.unit || "pcs", sellingPricePaise: paise(f.price), openingQty: Number(f.qty) || 0, openingUnitCostPaise: paise(f.cost) }), {
    success: "Item added", invalidate: ["products"], onSuccess: () => { setF({ name: "", category: "", unit: "pcs", price: "", qty: "", cost: "" }); onClose(); },
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Drawer open={open} onClose={onClose} title="Add an item" subtitle="For something you already have. Items from a market trip are added automatically when you record the buy."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={f.name.length < 2 || !f.category} onClick={() => save.mutate(undefined)}>Add item</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Item name" className="sm:col-span-2"><Input value={f.name} onChange={set("name")} placeholder="e.g. Steel bottle 1L" /></Field>
        <Field label="Category" hint="Type any name. A new one is created for you."><Input list="cats" value={f.category} onChange={set("category")} placeholder="e.g. Bottles" /><datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist></Field>
        <Field label="Unit"><Input value={f.unit} onChange={set("unit")} /></Field>
        <Field label="How many do you have now?"><Input inputMode="numeric" value={f.qty} onChange={set("qty")} placeholder="0" /></Field>
        <Field label="Cost of each (₹)"><Input inputMode="decimal" value={f.cost} onChange={set("cost")} placeholder="0" /></Field>
        <Field label="Selling price (₹)" className="sm:col-span-2"><Input inputMode="decimal" value={f.price} onChange={set("price")} placeholder="Optional" /></Field>
      </div>
    </Drawer>
  );
}

export default function StockPage() {
  return <Suspense><StockInner /></Suspense>;
}
