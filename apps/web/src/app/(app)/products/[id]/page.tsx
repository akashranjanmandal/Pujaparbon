"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Archive, Pencil } from "lucide-react";
import { formatINR } from "@pp/shared";
import { Drawer } from "@/components/ui/Drawer";
import { Loader } from "@/components/ui/Loader";
import { ProductGlyph } from "@/components/ui/ProductGlyph";
import { Table } from "@/components/ui/Table";
import { Badge, Button, Card, Field, Input, Textarea } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { BusinessSelect } from "@/components/BusinessSelect";
import { useAction, useBusinesses } from "@/lib/hooks";
import { paise, rupeeStr } from "@/lib/money";
import type { Product } from "@/lib/summary";

interface Detail extends Product {
  lots: { tripId: string; code: string; date: string; place: string | null; title: string | null; qty: number; landedPaise: number; unitCostPaise: number; unitPricePaise: number }[];
  sales: { platform: string; color: string; units: number; netPaise: number; costPaise: number; returns: number }[];
}
interface Move { id: string; qty: number; valuePaise: number; type: string; note: string | null; createdAt: number; by: string | null }

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const { data: p } = useQuery({ queryKey: ["product", id], queryFn: () => api.get<Detail>(`/products/${id}`) });
  const { data: moves } = useQuery({ queryKey: ["ledger", id], queryFn: () => api.get<Move[]>(`/stock/ledger?productId=${id}&limit=40`) });
  const archive = useAction(() => api.del(`/products/${id}`), { success: "Item archived", invalidate: ["products"], onSuccess: () => router.push("/stock") });
  if (!p) return <Loader />;
  const sold = p.sales.reduce((s, x) => s + x.units, 0);
  const net = p.sales.reduce((s, x) => s + x.netPaise, 0);
  const cogs = p.sales.reduce((s, x) => s + x.costPaise, 0);

  return (
    <div className="space-y-6">
      <button onClick={() => router.push("/stock")} className="flex items-center gap-2 text-[15px] text-muted hover:text-text"><ArrowLeft className="h-4 w-4" /> Stock</button>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-5">
          <ProductGlyph name={p.name} size={72} className="rounded-2xl" />
          <div>
            <Badge tone="blue">{p.category}</Badge>
            <h1 className="display mt-2 text-[34px] leading-tight">{p.name}</h1>
            {p.notes && <p className="mt-1 max-w-xl text-[15.5px] text-muted">{p.notes}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>Edit</Button>
              <Button variant="danger" icon={<Archive className="h-4 w-4" />} onClick={() => confirm("Archive this item? Its history stays in your reports.") && archive.mutate(undefined)}>Archive</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="In stock" value={`${p.onHand.toLocaleString("en-IN")} ${p.unit}`} sub={p.lastCountAt ? `Counted ${fmtDateTime(p.lastCountAt)}` : "Not counted yet"} tone="bg-primary-soft text-primary" />
        <Tile label="Real cost each" value={p.avgCostPaise ? formatINR(p.avgCostPaise) : "—"} sub="Average, with trip costs" tone="bg-lav-soft text-lav" />
        <Tile label="Your price" value={p.sellingPricePaise ? formatINR(p.sellingPricePaise) : "Not set"} sub={[p.avgCostPaise && p.sellingPricePaise ? `${p.marginPct >= 0 ? "+" : ""}${p.marginPct}% over cost` : "", p.wholesalePricePaise ? `Wholesale ${formatINR(p.wholesalePricePaise)}` : ""].filter(Boolean).join(" · ") || undefined} tone="bg-peach-soft text-peach" />
        <Tile label="Stock value at cost" value={formatINR(p.valuePaise, { decimals: false })} tone="bg-panel text-text" />
      </div>

      {p.sales.length > 0 && (
        <Card title="How it has sold" subtitle={`${sold} pieces sold across your platforms · ${formatINR(net - cogs, { decimals: false })} profit`} plain className="overflow-hidden">
          <Table rows={p.sales} columns={[
            { key: "pl", header: "Platform", cell: (s) => <span className="flex items-center gap-2 font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.platform}</span> },
            { key: "u", header: "Sold", align: "right", cell: (s) => s.units },
            { key: "r", header: "Returned", align: "right", cell: (s) => s.returns },
            { key: "n", header: "Received", align: "right", cell: (s) => formatINR(s.netPaise, { decimals: false }) },
            { key: "pf", header: "Profit", align: "right", cell: (s) => { const v = s.netPaise - s.costPaise; return <b className={cn(v < 0 && "text-sindoor")}>{formatINR(v, { decimals: false })}</b>; } },
          ]} />
        </Card>
      )}

      <Card title="Where it came from" subtitle="Each buy that included this item" plain className="overflow-hidden">
        <Table rows={p.lots} empty={<div className="px-6 py-8 text-center text-[15px] text-muted">Not bought on a trip yet.</div>} columns={[
          { key: "d", header: "Trip", cell: (l) => <Link href={`/buy/${l.tripId}`} className="block"><div className="font-semibold">{l.place || l.title || "Buying trip"}</div><div className="text-[14px] text-muted">{fmtDate(l.date, { day: "numeric", month: "short", year: "numeric" })}</div></Link> },
          { key: "q", header: "Pieces", align: "right", cell: (l) => l.qty },
          { key: "c", header: "Real cost each", align: "right", cell: (l) => formatINR(l.unitCostPaise) },
          { key: "p", header: "Price set", align: "right", cell: (l) => (l.unitPricePaise ? formatINR(l.unitPricePaise) : "—") },
          { key: "t", header: "Total", align: "right", cell: (l) => formatINR(l.landedPaise, { decimals: false }) },
        ]} />
      </Card>

      <Card title="History" subtitle="Every change to the count, newest first" plain className="overflow-hidden">
        <Table rows={moves} loading={!moves} columns={[
          { key: "w", header: "When", cell: (m) => <span className="text-muted">{fmtDateTime(m.createdAt)}</span> },
          { key: "t", header: "What", cell: (m) => <Badge tone={m.type === "BUY" ? "green" : m.type === "COUNT" ? "lav" : "blue"}>{m.type === "BUY" ? "Bought" : m.type === "COUNT" ? "Counted" : "Opening"}</Badge> },
          { key: "q", header: "Change", align: "right", cell: (m) => <b className={cn(m.qty > 0 ? "text-leaf" : m.qty < 0 ? "text-peach" : "text-muted")}>{m.qty > 0 ? `+${m.qty}` : m.qty === 0 ? "no change" : m.qty}</b> },
          { key: "n", header: "Note", cell: (m) => <span className="text-muted">{m.note}</span> },
          { key: "b", header: "By", cell: (m) => <span className="text-muted">{m.by ?? "—"}</span> },
        ]} />
      </Card>

      <EditDrawer p={p} open={editing} onClose={() => setEditing(false)} />
    </div>
  );
}

const Tile = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) => (
  <div className={`rounded-2xl p-5 ${tone}`}><div className="text-[14px] font-semibold">{label}</div><div className="display mt-1 text-[28px] leading-none text-text">{value}</div>{sub && <div className="mt-2 text-[13.5px] text-text/60">{sub}</div>}</div>
);

function EditDrawer({ p, open, onClose }: { p: Detail; open: boolean; onClose: () => void }) {
  const { data: cats } = useQuery({ queryKey: ["products", ""], queryFn: () => api.get<{ categories: { name: string }[] }>("/products"), enabled: open });
  const init = () => ({ name: p.name, category: p.category, unit: p.unit, price: rupeeStr(p.sellingPricePaise), wholesale: rupeeStr(p.wholesalePricePaise), gst: p.gstPct ? String(p.gstPct) : "", businessId: p.businessId ?? "", notes: p.notes ?? "" });
  const [f, setF] = useState(init);
  const { data: biz } = useBusinesses();
  useEffect(() => setF(init()), [p, open]);
  const save = useAction(() => api.patch(`/products/${p.id}`, { name: f.name, category: f.category, unit: f.unit, sellingPricePaise: paise(f.price), wholesalePricePaise: paise(f.wholesale), gstPct: Number(f.gst) || 0, businessId: f.businessId || null, notes: f.notes || undefined }), { success: "Saved", invalidate: ["product", "products"], onSuccess: onClose });
  const cost = p.avgCostPaise, price = paise(f.price);
  return (
    <Drawer open={open} onClose={onClose} title="Edit item" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Category" hint="Type a new name to create a category."><Input list="cats2" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /><datalist id="cats2">{cats?.categories.map((c) => <option key={c.name} value={c.name} />)}</datalist></Field>
        <Field label="Unit" hint="pcs, kg, ton, bag... your choice."><Input list="units2" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /><datalist id="units2">{["pcs", "kg", "ton", "bag", "dozen", "litre", "box"].map((u) => <option key={u} value={u} />)}</datalist></Field>
        <Field label="Retail price (₹)" hint={cost && price ? `${price >= cost ? "+" : ""}${Math.round(((price - cost) / cost) * 1000) / 10}% over your real cost of ${formatINR(cost)}` : undefined}><Input inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
        <Field label="Wholesale price (₹)" hint="Leave empty if you do not sell it wholesale."><Input inputMode="decimal" value={f.wholesale} onChange={(e) => setF({ ...f, wholesale: e.target.value })} /></Field>
        <Field label="GST on sales (%)" hint="Prices include it. Leave empty for none."><Input inputMode="decimal" value={f.gst} onChange={(e) => setF({ ...f, gst: e.target.value })} placeholder="e.g. 5" /></Field>
        <Field label="Belongs to"><BusinessSelect value={f.businessId} onChange={(v) => setF({ ...f, businessId: v })} list={biz} /></Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Drawer>
  );
}
