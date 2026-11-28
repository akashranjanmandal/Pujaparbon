"use client";
import { useActiveBusiness } from "@/lib/business";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { SALE_CHANNELS, formatINR } from "@pp/shared";
import { BusinessSelect } from "@/components/BusinessSelect";
import { Drawer } from "@/components/ui/Drawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table } from "@/components/ui/Table";
import { Badge, Button, Card, Field, Input, Segmented, Select } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { fmtDate, todayKey } from "@/lib/format";
import { useAction, useBusinesses, usePlaces, useProducts } from "@/lib/hooks";
import { paise } from "@/lib/money";

interface Sale { id: string; date: string; channel: string; totalPaise: number; paidPaise: number; costPaise: number; business: string; place: string | null; customer: string | null; note: string | null }
interface Party { id: string; name: string; kind: string }
const CHANNEL: Record<string, string> = { SHOP: "Shop", HAAT: "Haat", MELA: "Mela", WHOLESALE: "Wholesale" };
interface Line { id: number; productId: string; qty: string; price: string }

export default function SellPage() {
  const [open, setOpen] = useState(false);
  const ab = useActiveBusiness();
  const { data, isLoading } = useQuery({ queryKey: ["sales", ab.id ?? ""], queryFn: () => api.get<Sale[]>(`/sales?limit=100${ab.id ? `&businessId=${ab.id}` : ""}`) });
  const del = useAction((id: string) => api.del(`/sales/${id}`), { success: "Sale removed and stock put back", invalidate: ["sales", "products", "dues", "accounts", "place-stock"] });
  const today = (data ?? []).filter((s) => s.date === todayKey());
  const todayTotal = today.reduce((a, s) => a + s.totalPaise, 0);
  return (
    <div>
      <PageHeader title="Sell" subtitle="Record a sale at the shop, a haat, a mela stall or to a wholesale customer. Stock goes down by itself."
        actions={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New sale</Button>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-primary-soft p-5"><div className="text-[14px] font-semibold text-primary">Sold today</div><div className="display mt-1 text-[34px] leading-none">{formatINR(todayTotal, { decimals: false })}</div><div className="mt-2 text-[13.5px] text-text/60">{today.length} sales</div></div></div>
      <Card plain className="overflow-hidden">
        <Table rows={data} loading={isLoading} empty={<div className="px-6 py-10 text-center text-[15px] text-muted">No sales yet. Press New sale.</div>}
          columns={[
            { key: "d", header: "Date", cell: (r) => fmtDate(r.date, { day: "numeric", month: "short" }) },
            { key: "b", header: "Business", cell: (r) => <span className="font-semibold">{r.business}</span> },
            { key: "c", header: "Where", cell: (r) => <span>{CHANNEL[r.channel]}{r.place ? ` · ${r.place}` : ""}</span> },
            { key: "p", header: "Customer", cell: (r) => r.customer ?? <span className="text-muted">Walk-in</span> },
            { key: "t", header: "Total", align: "right", cell: (r) => <span><b>{formatINR(r.totalPaise, { decimals: false })}</b>{r.paidPaise < r.totalPaise && <Badge tone="orange" className="ml-2">Due {formatINR(r.totalPaise - r.paidPaise, { decimals: false })}</Badge>}</span> },
            { key: "x", header: "", align: "right", cell: (r) => <button className="rounded-lg p-2 text-muted hover:bg-bg2 hover:text-sindoor" aria-label="Remove" onClick={() => confirm("Remove this sale? The stock goes back and any due is cancelled.") && del.mutate(r.id)}><Trash2 className="h-4 w-4" /></button> },
          ]} />
      </Card>
      {open && <SaleDrawer onClose={() => setOpen(false)} />}
    </div>
  );
}

function SaleDrawer({ onClose }: { onClose: () => void }) {
  const ab0 = useActiveBusiness();
  const { data: biz } = useBusinesses();
  const { data: places } = usePlaces();
  const { data: prods } = useProducts();
  const { data: parties } = useQuery({ queryKey: ["dues"], queryFn: () => api.get<Party[]>("/dues") });
  const [f, setF] = useState({ businessId: ab0.id ?? "", channel: "SHOP", locationId: "", date: todayKey(), customerId: "", mode: "BILL" as "BILL" | "DAILY", total: "", paid: "", note: "" });
  const [tier, setTier] = useState<"retail" | "wholesale">("retail");
  const [lines, setLines] = useState<Line[]>([{ id: 1, productId: "", qty: "1", price: "" }]);
  const items = prods?.items ?? [];
  const priceOf = (productId: string, t = tier) => { const p = items.find((x) => x.id === productId); return p ? ((t === "wholesale" && p.wholesalePricePaise ? p.wholesalePricePaise : p.sellingPricePaise) / 100) : 0; };
  const setLine = (id: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const used = lines.filter((l) => l.productId && Number(l.qty) > 0);
  const billTotal = used.reduce((a, l) => a + Math.round(Number(l.qty) * paise(l.price)), 0);
  const total = f.mode === "BILL" ? billTotal : paise(f.total);
  const paidPaise = f.paid.trim() === "" ? total : paise(f.paid);
  const due = Math.max(0, total - paidPaise);
  const places2 = (places ?? []).filter((p) => p.active && (!f.businessId || !p.businessId || p.businessId === f.businessId));
  const save = useAction(() => api.post("/sales", {
    businessId: f.businessId, channel: f.channel, locationId: f.locationId || undefined, date: f.date, customerId: f.customerId || undefined, note: f.note || undefined,
    ...(f.mode === "BILL" ? { items: used.map((l) => ({ productId: l.productId, qty: Number(l.qty), unitPricePaise: paise(l.price) })) } : { items: [], totalPaise: total }),
    paidPaise,
  }), { success: "Sale saved", invalidate: ["sales", "products", "dues", "accounts", "place-stock", "home"], onSuccess: onClose });
  const ok = f.businessId && total > 0 && (due === 0 || f.customerId);
  return (
    <Drawer open onClose={onClose} wide title="New sale" subtitle="One entry updates stock, dues and your accounts."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={!ok} onClick={() => save.mutate(undefined)}>Save sale</Button></>}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Which business?"><BusinessSelect value={f.businessId} onChange={(v) => setF({ ...f, businessId: v, locationId: "" })} list={biz} none="Choose…" /></Field>
          <Field label="Date"><Input type="date" value={f.date} max={todayKey()} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Sold at"><Select value={f.channel} onChange={(e) => { const c = e.target.value; setF({ ...f, channel: c }); setTier(c === "WHOLESALE" ? "wholesale" : "retail"); setLines((ls) => ls.map((l) => (l.productId ? { ...l, price: String(priceOf(l.productId, c === "WHOLESALE" ? "wholesale" : "retail") || "") } : l))); }}>{SALE_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL[c]}</option>)}</Select></Field>
          <Field label="Place" hint="Stock is taken from this place."><Select value={f.locationId} onChange={(e) => setF({ ...f, locationId: e.target.value })}><option value="">Main stock</option>{places2.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        </div>
        <Segmented value={f.mode} onChange={(m) => setF({ ...f, mode: m })} options={[{ value: "BILL", label: "List the items" }, { value: "DAILY", label: "Only the day's total" }]} />
        {f.mode === "BILL" ? (
          <div className="space-y-3">
            {lines.map((l) => {
              const p = items.find((x) => x.id === l.productId);
              return (
                <div key={l.id} className="grid grid-cols-[1fr_90px_110px_auto] items-end gap-2">
                  <Field label="Item"><Select value={l.productId} onChange={(e) => setLine(l.id, { productId: e.target.value, price: String(priceOf(e.target.value) || "") })}><option value="">Choose item…</option>{items.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.onHand} {x.unit})</option>)}</Select></Field>
                  <Field label={p?.unit === "kg" ? "Kg" : "Qty"}><Input inputMode="decimal" value={l.qty} onChange={(e) => setLine(l.id, { qty: e.target.value })} /></Field>
                  <Field label="Price (₹)"><Input inputMode="decimal" value={l.price} onChange={(e) => setLine(l.id, { price: e.target.value })} /></Field>
                  <button className="mb-1 rounded-lg p-2 text-muted hover:bg-bg2" aria-label="Remove line" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.id !== l.id) : ls))}><X className="h-4 w-4" /></button>
                </div>
              );
            })}
            <div className="flex items-center justify-between">
              <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setLines((ls) => [...ls, { id: Math.max(...ls.map((x) => x.id)) + 1, productId: "", qty: "1", price: "" }])}>Add item</Button>
              <Segmented value={tier} onChange={(t) => { setTier(t); setLines((ls) => ls.map((l) => (l.productId ? { ...l, price: String(priceOf(l.productId, t) || "") } : l))); }} options={[{ value: "retail", label: "Retail prices" }, { value: "wholesale", label: "Wholesale prices" }]} />
            </div>
          </div>
        ) : <Field label="Total sold (₹)" hint="Stock is not reduced. Count your stock as usual."><Input inputMode="decimal" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} /></Field>}
        <div className="grid gap-4 rounded-2xl bg-bg2 p-4 sm:grid-cols-3">
          <div><div className="text-[13.5px] text-muted">Total</div><div className="display text-[26px]">{formatINR(total, { decimals: false })}</div></div>
          <Field label="Received now (₹)" hint="Empty = all received"><Input inputMode="decimal" value={f.paid} onChange={(e) => setF({ ...f, paid: e.target.value })} /></Field>
          <div><div className="text-[13.5px] text-muted">Still due</div><div className={`display text-[26px] ${due ? "text-peach" : ""}`}>{formatINR(due, { decimals: false })}</div></div>
        </div>
        {(due > 0 || f.customerId || f.channel === "WHOLESALE") && (
          <Field label="Customer" hint={due > 0 ? "Needed, so the due is remembered." : "Optional"}><Select value={f.customerId} onChange={(e) => setF({ ...f, customerId: e.target.value })}><option value="">No customer</option>{parties?.filter((p) => p.kind === "CUSTOMER").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select><p className="mt-1.5 text-[13.5px] text-muted">New customer? Add them on the Dues page first.</p></Field>
        )}
      </div>
    </Drawer>
  );
}
