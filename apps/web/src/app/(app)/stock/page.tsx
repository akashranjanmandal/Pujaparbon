"use client";
import { ProductGlyph } from "@/components/ui/ProductGlyph";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Boxes, Grid3x3, History, Plus, Scale, Search, SlidersHorizontal } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { Table } from "@/components/ui/Table";
import { Badge, Button, Card, Empty, Field, Input, Segmented, Select, StatusBadge } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { compactINR, fmtDateTime, fmtNum } from "@/lib/format";
import { useAction } from "@/lib/hooks";

export interface StockItem {
  variantId: string; sku: string; size: string | null; color: string | null; name: string; category: string; emoji: string | null; reorderLevel: number;
  costPaise: number; pricePaise: number; onHand: number; committed: number; available: number; bins: { code: string; qty: number }[]; state: "OK" | "LOW" | "OUT";
}
interface StockList { items: StockItem[]; totals: { skus: number; units: number; valueAtCostPaise: number; low: number; out: number } }
interface Bin { id: string; code: string; zone: string; units: number; skus: number }
interface Move { id: string; qty: number; type: string; reason: string | null; createdAt: string; sku: string; name: string; emoji: string | null; bin: string | null; by: string | null }

function StockInner() {
  const params = useSearchParams();
  const { can } = useAuth();
  const [tab, setTab] = useState<"stock" | "ledger" | "bins">("stock");
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [filter, setFilter] = useState(params.get("filter") ?? "");
  const [moveFor, setMoveFor] = useState<StockItem | null | "pick">(params.get("move") ? "pick" : null);
  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  if (filter) qs.set("filter", filter);
  const { data, isLoading } = useQuery({ queryKey: ["stock", qs.toString()], queryFn: () => api.get<StockList>(`/stock?${qs}`) });
  const t = data?.totals;

  return (
    <div>
      <PageHeader title="Stock" subtitle="On hand is what is on the shelf. Committed is promised to open orders. Available is what you can still sell."
        actions={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setMoveFor("pick")}>Record stock movement</Button>} />

      {t && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Stock value at cost" value={t.valueAtCostPaise} format={compactINR} icon={<Boxes className="h-5 w-5" />} />
          <Stat label="Units on the shelves" value={t.units} icon={<Grid3x3 className="h-5 w-5" />} tone="blue" hint={`${t.skus} SKUs`} delay={0.05} />
          <Stat label="Running low" value={t.low} icon={<Scale className="h-5 w-5" />} tone="gold" delay={0.1} onClick={() => { setFilter("low"); setTab("stock"); }} />
          <Stat label="Out of stock" value={t.out} icon={<ArrowUpFromLine className="h-5 w-5" />} tone="red" delay={0.15} onClick={() => { setFilter("out"); setTab("stock"); }} />
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented value={tab} onChange={setTab} options={[
          { value: "stock", label: <span className="flex items-center gap-1.5"><Boxes className="h-3.5 w-3.5" />Stock</span> },
          { value: "ledger", label: <span className="flex items-center gap-1.5"><History className="h-3.5 w-3.5" />Ledger</span> },
          { value: "bins", label: <span className="flex items-center gap-1.5"><Grid3x3 className="h-3.5 w-3.5" />Racks & bins</span> },
        ]} />
        {tab === "stock" && (
          <>
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input placeholder="Name, SKU or category" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-40">
              <option value="">Everything</option>
              <option value="low">Low or out</option>
              <option value="out">Out of stock</option>
            </Select>
          </>
        )}
      </div>

      {tab === "stock" && (
        <Card plain className="overflow-hidden">
          <Table rows={data?.items} loading={isLoading} rowKey={(r) => r.variantId} onRowClick={(r) => setMoveFor(r)}
            empty={<Empty icon={<Boxes />} title="Nothing here" body="No SKUs match this filter." />}
            columns={[
              { key: "item", header: "Item", cell: (s) => <div className="flex items-center gap-3"><ProductGlyph name={s.name} size={34} /><div><div className="font-medium">{s.name}</div><code className="text-[14px] text-muted">{s.sku}{s.size ? ` · ${s.size}` : ""}{s.color ? ` · ${s.color}` : ""}</code></div></div> },
              { key: "bin", header: "Bin", cell: (s) => <div className="flex flex-wrap gap-1">{s.bins.slice(0, 2).map((b) => <Badge key={b.code} tone="gold">{b.code} · {b.qty}</Badge>)}{!s.bins.length && <span className="text-[14px] text-muted">—</span>}</div> },
              { key: "level", header: "Level", cell: (s) => <Level s={s} /> },
              { key: "onhand", header: "On hand", align: "right", cell: (s) => <b className="num">{fmtNum(s.onHand)}</b> },
              { key: "committed", header: "Committed", align: "right", cell: (s) => <span className="text-muted num">{s.committed}</span> },
              { key: "available", header: "Available", align: "right", cell: (s) => <b className={cn("num", s.available <= 0 ? "text-sindoor" : s.available <= s.reorderLevel ? "text-marigold" : "text-leaf")}>{s.available}</b> },
              { key: "state", header: "", cell: (s) => <StatusBadge status={s.state} /> },
            ]} />
        </Card>
      )}
      {tab === "ledger" && <Ledger />}
      {tab === "bins" && <Bins canAdd={can("stock.adjust")} />}
      <MoveDrawer target={moveFor} onClose={() => setMoveFor(null)} items={data?.items ?? []} canAdjust={can("stock.adjust")} />
    </div>
  );
}

/** A small "lamp oil" bar: how full the shelf is compared with three times the reorder level. */
function Level({ s }: { s: StockItem }) {
  const pct = Math.min(100, (s.onHand / Math.max(1, s.reorderLevel * 3)) * 100);
  return (
    <div className="h-2 w-28 overflow-hidden rounded-full bg-line/10">
      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1 }} className={cn("h-full rounded-full", s.state === "OK" ? "bg-leaf" : s.state === "LOW" ? "bg-marigold" : "bg-primary")} />
    </div>
  );
}

function Ledger() {
  const [type, setType] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["stock", "ledger", type], queryFn: () => api.get<Move[]>(`/stock/ledger?limit=200${type ? `&type=${type}` : ""}`) });
  return (
    <Card plain className="overflow-hidden" title="Stock ledger" subtitle="Every unit that entered or left, with who did it and why. Entries are never edited — corrections are new entries." action={
      <Select value={type} onChange={(e) => setType(e.target.value)} className="w-40">
        <option value="">All types</option>
        {["PURCHASE", "INWARD", "SALE", "OUTWARD", "RETURN", "ADJUSTMENT"].map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
      </Select>
    }>
      <Table rows={data} loading={isLoading} columns={[
        { key: "when", header: "When", cell: (m) => <span className="text-muted">{fmtDateTime(m.createdAt)}</span> },
        { key: "item", header: "Item", cell: (m) => <div className="flex items-center gap-2"><ProductGlyph name={m.name} size={26} /><div><div className="max-w-[240px] truncate">{m.name}</div><code className="text-[14px] text-muted">{m.sku}</code></div></div> },
        { key: "type", header: "Type", cell: (m) => <Badge tone={m.type === "SALE" ? "blue" : m.type === "ADJUSTMENT" ? "gold" : m.qty > 0 ? "green" : "red"}>{m.type.toLowerCase()}</Badge> },
        { key: "qty", header: "Qty", align: "right", cell: (m) => <b className={cn("num", m.qty > 0 ? "text-leaf" : "text-sindoor")}>{m.qty > 0 ? `+${m.qty}` : m.qty}</b> },
        { key: "bin", header: "Bin", cell: (m) => <span className="text-muted">{m.bin ?? "—"}</span> },
        { key: "reason", header: "Reason", cell: (m) => <span className="text-muted">{m.reason}</span> },
        { key: "by", header: "By", cell: (m) => <span className="text-muted">{m.by ?? "System"}</span> },
      ]} />
    </Card>
  );
}

function Bins({ canAdd }: { canAdd: boolean }) {
  const { data } = useQuery({ queryKey: ["stock", "bins"], queryFn: () => api.get<Bin[]>("/stock/bins") });
  const [code, setCode] = useState("");
  const [zone, setZone] = useState("");
  const add = useAction(() => api.post("/stock/bins", { code, zone }), { success: "Bin added", invalidate: ["stock"], onSuccess: () => { setCode(""); setZone(""); } });
  const zones = [...new Set(data?.map((b) => b.zone) ?? [])];
  const max = Math.max(1, ...(data?.map((b) => b.units) ?? [1]));
  return (
    <div className="space-y-6">
      {zones.map((z, zi) => (
        <Card key={z} title={z} subtitle={`${data!.filter((b) => b.zone === z).length} bins`} delay={zi * 0.05}>
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-6">
            {data!.filter((b) => b.zone === z).map((b, i) => (
              <motion.div key={b.id} initial={{ opacity: 0, rotateY: -60 }} animate={{ opacity: 1, rotateY: 0 }} transition={{ delay: zi * 0.05 + i * 0.05 }} className="relative overflow-hidden rounded-2xl border border-line/15 bg-bg2/70 p-4">
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary-soft to-transparent" style={{ height: `${(b.units / max) * 100}%` }} />
                <div className="relative">
                  <code className="text-[16px] font-semibold">{b.code}</code>
                  <div className="mt-3 text-2xl font-semibold num">{b.units}</div>
                  <div className="text-[14px] text-muted">units · {b.skus} SKUs</div>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      ))}
      {canAdd && (
        <Card title="Add a bin" subtitle="Name racks the way your team already does, e.g. A-07">
          <div className="flex flex-wrap items-end gap-3 p-5">
            <Field label="Bin code"><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="A-07" /></Field>
            <Field label="Zone"><Input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Sarees" list="zones" /><datalist id="zones">{zones.map((z) => <option key={z} value={z} />)}</datalist></Field>
            <Button variant="gold" loading={add.isPending} onClick={() => add.mutate(undefined)}>Add bin</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function MoveDrawer({ target, onClose, items, canAdjust }: { target: StockItem | null | "pick"; onClose: () => void; items: StockItem[]; canAdjust: boolean }) {
  const [variantId, setVariantId] = useState("");
  const [type, setType] = useState<"INWARD" | "OUTWARD" | "ADJUSTMENT">("INWARD");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");
  const [binId, setBinId] = useState("");
  const { data: bins } = useQuery({ queryKey: ["stock", "bins"], queryFn: () => api.get<Bin[]>("/stock/bins"), enabled: !!target });
  const item = target && target !== "pick" ? target : items.find((i) => i.variantId === variantId);
  const save = useAction(() => api.post("/stock/moves", { variantId: item!.variantId, type, qty: Number(qty), reason, binId: binId || undefined }), {
    success: "Stock updated", invalidate: ["stock", "products"], onSuccess: () => { setQty("1"); setReason(""); onClose(); },
  });
  const delta = type === "OUTWARD" ? -Math.abs(Number(qty)) : type === "INWARD" ? Math.abs(Number(qty)) : Number(qty);
  const types = [
    { v: "INWARD" as const, l: "Stock in", icon: ArrowDownToLine, c: "text-leaf" },
    { v: "OUTWARD" as const, l: "Stock out", icon: ArrowUpFromLine, c: "text-sindoor" },
    ...(canAdjust ? [{ v: "ADJUSTMENT" as const, l: "Correct count", icon: SlidersHorizontal, c: "text-primary" }] : []),
  ];

  return (
    <Drawer open={!!target} onClose={onClose} title="Record stock movement" subtitle="Purchases and dispatches update stock on their own — use this for everything else."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!item || !reason || !Number(qty)} loading={save.isPending} onClick={() => save.mutate(undefined)}>Save movement</Button></>}>
      <div className="space-y-5">
        {target === "pick" ? (
          <Field label="Item">
            <Select value={variantId} onChange={(e) => setVariantId(e.target.value)}>
              <option value="">Choose a SKU…</option>
              {items.map((i) => <option key={i.variantId} value={i.variantId}>{i.sku} — {i.name}</option>)}
            </Select>
          </Field>
        ) : null}
        {item && (
          <div className="flex items-center gap-4 rounded-2xl border border-line/10 bg-panel/50 p-4">
            <ProductGlyph name={item.name} size={34} />
            <div className="flex-1"><div className="font-medium">{item.name}</div><code className="text-[14px] text-muted">{item.sku}</code></div>
            <div className="text-right">
              <div className="text-[14px] text-muted">On hand</div>
              <div className="text-[22px] font-semibold tracking-tight">{item.onHand} <span className={cn("text-base", delta >= 0 ? "text-leaf" : "text-sindoor")}>→ {item.onHand + (Number.isFinite(delta) ? delta : 0)}</span></div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {types.map((t) => (
            <button key={t.v} onClick={() => setType(t.v)} className={cn("flex flex-col items-center gap-2 rounded-2xl border p-4 text-[15.5px] font-semibold transition", type === t.v ? "border-primary bg-primary-tint" : "border-line/10 text-muted hover:text-text")}>
              <t.icon className={cn("h-5 w-5", t.c)} /> {t.l}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label={type === "ADJUSTMENT" ? "Change (+ or −)" : "Quantity"}><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
          <Field label="Bin"><Select value={binId} onChange={(e) => setBinId(e.target.value)}><option value="">Not specified</option>{bins?.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.zone}</option>)}</Select></Field>
        </div>
        <Field label="Reason" hint="Shows up in the ledger forever — be specific.">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={type === "INWARD" ? "Found 4 pieces in godown" : type === "OUTWARD" ? "Sent to exhibition stall" : "Cycle count found 2 damaged"} />
        </Field>
      </div>
    </Drawer>
  );
}

export default function StockPage() {
  return (
    <Suspense>
      <StockInner />
    </Suspense>
  );
}
