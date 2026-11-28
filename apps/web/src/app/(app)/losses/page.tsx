"use client";
import { useActiveBusiness } from "@/lib/business";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PackageX, Undo2 } from "lucide-react";
import { formatINR } from "@pp/shared";
import { BusinessSelect } from "@/components/BusinessSelect";
import { Drawer } from "@/components/ui/Drawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { RangePicker, rangeFor, type RangeValue } from "@/components/ui/RangePicker";
import { Table } from "@/components/ui/Table";
import { Badge, Button, Card, Field, Input, Segmented, Select } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { fmtDate, todayKey } from "@/lib/format";
import { useAction, useBusinesses, usePlaces, useProducts } from "@/lib/hooks";
import { paise } from "@/lib/money";

interface Res {
  totalLossPaise: number;
  losses: { id: string; date: string; reason: string; qty: number; valuePaise: number; note: string | null; product: string | null; business: string | null }[];
  returns: { id: string; date: string; condition: string; qty: number; refundPaise: number; product: string; business: string }[];
}
const REASON: Record<string, string> = { DAMAGED_RETURN: "Damaged return", WASTE: "Wasted", SPOILAGE: "Spoiled", OTHER: "Other" };

export default function LossesPage() {
  const [range, setRange] = useState<RangeValue>(rangeFor("month"));
  const [mode, setMode] = useState<"loss" | "return" | null>(null);
  const ab = useActiveBusiness();
  const { data, isLoading } = useQuery({ queryKey: ["losses", range.from, range.to, ab.id ?? ""], queryFn: () => api.get<Res>(`/losses?from=${range.from}&to=${range.to}${ab.id ? `&businessId=${ab.id}` : ""}`) });
  return (
    <div>
      <PageHeader title="Returns & losses" subtitle="A return in good condition goes back to stock. A damaged return or wasted stock is written off here, at cost."
        actions={<><Button icon={<Undo2 className="h-4 w-4" />} onClick={() => setMode("return")}>Customer return</Button><Button variant="primary" icon={<PackageX className="h-4 w-4" />} onClick={() => setMode("loss")}>Wasted / spoiled</Button></>} />
      <RangePicker value={range} onChange={setRange} presets={["month", "lastMonth", "last90", "year"]} className="mb-6" />
      <div className="mb-6 rounded-2xl bg-peach-soft p-5 sm:max-w-sm"><div className="text-[14px] font-semibold text-peach">Loss in this period</div><div className="display mt-1 text-[34px] leading-none">{formatINR(data?.totalLossPaise ?? 0, { decimals: false })}</div></div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Loss account" plain className="overflow-hidden">
          <Table rows={data?.losses} loading={isLoading} empty={<div className="px-6 py-8 text-center text-[15px] text-muted">No losses recorded.</div>}
            columns={[
              { key: "d", header: "Date", cell: (r) => fmtDate(r.date) },
              { key: "p", header: "Item", cell: (r) => <span className="font-semibold">{r.product ?? "—"}</span> },
              { key: "r", header: "Why", cell: (r) => <Badge tone="orange">{REASON[r.reason]}</Badge> },
              { key: "q", header: "Qty", align: "right", cell: (r) => r.qty },
              { key: "v", header: "Cost", align: "right", cell: (r) => formatINR(r.valuePaise, { decimals: false }) },
            ]} />
        </Card>
        <Card title="Customer returns" plain className="overflow-hidden">
          <Table rows={data?.returns} loading={isLoading} empty={<div className="px-6 py-8 text-center text-[15px] text-muted">No returns recorded.</div>}
            columns={[
              { key: "d", header: "Date", cell: (r) => fmtDate(r.date) },
              { key: "p", header: "Item", cell: (r) => <span className="font-semibold">{r.product}</span> },
              { key: "c", header: "Condition", cell: (r) => <Badge tone={r.condition === "GOOD" ? "green" : "orange"}>{r.condition === "GOOD" ? "Back in stock" : "Damaged"}</Badge> },
              { key: "q", header: "Qty", align: "right", cell: (r) => r.qty },
              { key: "f", header: "Refunded", align: "right", cell: (r) => formatINR(r.refundPaise, { decimals: false }) },
            ]} />
        </Card>
      </div>
      {mode && <EntryDrawer mode={mode} onClose={() => setMode(null)} />}
    </div>
  );
}

function EntryDrawer({ mode, onClose }: { mode: "loss" | "return"; onClose: () => void }) {
  const ab0 = useActiveBusiness();
  const { data: biz } = useBusinesses();
  const { data: places } = usePlaces();
  const { data: prods } = useProducts();
  const [f, setF] = useState({ businessId: ab0.id ?? "", locationId: "", productId: "", qty: "1", date: todayKey(), reason: "WASTE", condition: "GOOD", refund: "", note: "" });
  const save = useAction(() => (mode === "loss"
    ? api.post("/losses", { businessId: f.businessId || undefined, locationId: f.locationId || undefined, productId: f.productId, qty: Number(f.qty), date: f.date, reason: f.reason, note: f.note || undefined })
    : api.post("/losses/returns", { businessId: f.businessId, locationId: f.locationId || undefined, productId: f.productId, qty: Number(f.qty), date: f.date, condition: f.condition, refundPaise: paise(f.refund), note: f.note || undefined })),
  { success: mode === "loss" ? "Written off" : "Return saved", invalidate: ["losses", "products", "accounts", "place-stock"], onSuccess: onClose });
  const ok = f.productId && Number(f.qty) > 0 && (mode === "loss" || f.businessId);
  return (
    <Drawer open onClose={onClose} title={mode === "loss" ? "Wasted or spoiled stock" : "Customer return"} subtitle={mode === "loss" ? "Takes the items out of stock and books their cost as a loss." : "Good items go back to stock. Damaged ones are written off."}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={!ok} onClick={() => save.mutate(undefined)}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Item" className="sm:col-span-2"><Select value={f.productId} onChange={(e) => setF({ ...f, productId: e.target.value })}><option value="">Choose item…</option>{prods?.items.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.onHand} {p.unit})</option>)}</Select></Field>
        <Field label="Quantity"><Input inputMode="decimal" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></Field>
        <Field label="Date"><Input type="date" value={f.date} max={todayKey()} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Business"><BusinessSelect value={f.businessId} onChange={(v) => setF({ ...f, businessId: v })} list={biz} none={mode === "loss" ? "Not sure / shared" : "Choose…"} /></Field>
        <Field label="Place"><Select value={f.locationId} onChange={(e) => setF({ ...f, locationId: e.target.value })}><option value="">Main stock</option>{places?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        {mode === "loss" ? (
          <Field label="Why?" className="sm:col-span-2"><Select value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })}>{["WASTE", "SPOILAGE", "OTHER"].map((k) => <option key={k} value={k}>{REASON[k]}</option>)}</Select></Field>
        ) : (
          <>
            <Field label="Condition"><Segmented value={f.condition} onChange={(c) => setF({ ...f, condition: c })} options={[{ value: "GOOD", label: "Good" }, { value: "DAMAGED", label: "Damaged" }]} /></Field>
            <Field label="Money refunded (₹)"><Input inputMode="decimal" value={f.refund} onChange={(e) => setF({ ...f, refund: e.target.value })} /></Field>
          </>
        )}
        <Field label="Note" hint="Optional" className="sm:col-span-2"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      </div>
    </Drawer>
  );
}
