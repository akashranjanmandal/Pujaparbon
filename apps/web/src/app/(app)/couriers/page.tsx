"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { RangePicker, rangeFor, type RangeValue } from "@/components/ui/RangePicker";
import { Table } from "@/components/ui/Table";
import { Button, Card, Field, Input, Select } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { fmtDate, todayKey } from "@/lib/format";
import { useAction } from "@/lib/hooks";

interface Row { id: string; date: string; courier: string; platform: string | null; outgoing: number; customerReturn: number; rto: number; time: string | null }
interface Res { rows: Row[]; totals: { outgoing: number; customerReturn: number; rto: number } }

export default function CouriersPage() {
  const [range, setRange] = useState<RangeValue>(rangeFor("today"));
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["couriers", range.from, range.to], queryFn: () => api.get<Res>(`/couriers?from=${range.from}&to=${range.to}`) });
  const del = useAction((id: string) => api.del(`/couriers/${id}`), { success: "Removed", invalidate: ["couriers"] });
  const t = data?.totals;
  return (
    <div>
      <PageHeader title="Courier movement" subtitle="Parcels that left with each courier, and what came back: customer returns and RTO."
        actions={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Add entry</Button>} />
      <RangePicker value={range} onChange={setRange} presets={["today", "week", "month"]} className="mb-6" />
      <div className="mb-6 grid grid-cols-3 gap-4">
        <Tile label="Went out" value={t?.outgoing ?? 0} tone="bg-primary-soft text-primary" />
        <Tile label="Customer returns" value={t?.customerReturn ?? 0} tone="bg-peach-soft text-peach" />
        <Tile label="RTO" value={t?.rto ?? 0} tone="bg-lav-soft text-lav" />
      </div>
      <Card plain className="overflow-hidden">
        <Table rows={data?.rows} loading={isLoading} empty={<div className="px-6 py-10 text-center text-[15px] text-muted">Nothing recorded for this period.</div>}
          columns={[
            { key: "d", header: "Date", cell: (r) => <span>{fmtDate(r.date)}{r.time ? ` · ${r.time}` : ""}</span> },
            { key: "p", header: "Platform", cell: (r) => r.platform ?? "—" },
            { key: "c", header: "Courier", cell: (r) => <b>{r.courier}</b> },
            { key: "o", header: "Out", align: "right", cell: (r) => r.outgoing },
            { key: "r", header: "Return", align: "right", cell: (r) => r.customerReturn },
            { key: "t", header: "RTO", align: "right", cell: (r) => r.rto },
            { key: "x", header: "", align: "right", cell: (r) => <button className="rounded-lg p-2 text-muted hover:bg-bg2 hover:text-sindoor" aria-label="Remove" onClick={() => confirm("Remove this entry?") && del.mutate(r.id)}><Trash2 className="h-4 w-4" /></button> },
          ]} />
      </Card>
      {open && <Add onClose={() => setOpen(false)} />}
    </div>
  );
}
const Tile = ({ label, value, tone }: { label: string; value: number; tone: string }) => <div className={`rounded-2xl p-5 ${tone}`}><div className="text-[14px] font-semibold">{label}</div><div className="display mt-1 text-[34px] leading-none text-text">{value}</div></div>;

function Add({ onClose }: { onClose: () => void }) {
  const { data: plats } = useQuery({ queryKey: ["platforms"], queryFn: () => api.get<{ id: string; name: string }[]>("/platforms") });
  const [f, setF] = useState({ date: todayKey(), platformId: "", courier: "", outgoing: "", customerReturn: "", rto: "", time: "" });
  const n = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
  const save = useAction(() => api.post("/couriers", { date: f.date, platformId: f.platformId || undefined, courier: f.courier.trim(), outgoing: n(f.outgoing), customerReturn: n(f.customerReturn), rto: n(f.rto), time: f.time || undefined }), { success: "Saved", invalidate: ["couriers"], onSuccess: onClose });
  return (
    <Drawer open onClose={onClose} title="Courier entry" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={f.courier.trim().length < 2} onClick={() => save.mutate(undefined)}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Platform"><Select value={f.platformId} onChange={(e) => setF({ ...f, platformId: e.target.value })}><option value="">Not specific</option>{plats?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="Courier"><Input list="couriers-list" value={f.courier} onChange={(e) => setF({ ...f, courier: e.target.value })} placeholder="e.g. Valmo" /><datalist id="couriers-list">{["Valmo", "Shadowfax", "Express Bees", "E-kart", "Delhivery", "Xpressbees"].map((c) => <option key={c} value={c} />)}</datalist></Field>
        <Field label="Date"><Input type="date" value={f.date} max={todayKey()} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Time" hint="Optional"><Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        <Field label="Parcels out"><Input inputMode="numeric" value={f.outgoing} onChange={(e) => setF({ ...f, outgoing: e.target.value })} /></Field>
        <Field label="Customer returns"><Input inputMode="numeric" value={f.customerReturn} onChange={(e) => setF({ ...f, customerReturn: e.target.value })} /></Field>
        <Field label="RTO"><Input inputMode="numeric" value={f.rto} onChange={(e) => setF({ ...f, rto: e.target.value })} /></Field>
      </div>
    </Drawer>
  );
}
