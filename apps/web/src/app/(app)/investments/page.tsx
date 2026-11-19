"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { formatINR } from "@pp/shared";
import { Drawer } from "@/components/ui/Drawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { RangePicker, rangeFor, type RangeValue } from "@/components/ui/RangePicker";
import { Table } from "@/components/ui/Table";
import { Badge, Button, Card, Field, Input, Textarea } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { compactINR, fmtDate, todayKey } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { paise, rupeeStr } from "@/lib/money";

interface Entry { type: "BUY" | "OTHER"; id: string; code: string | null; date: string; title: string; detail: string; category: string; amountPaise: number }
interface Res { timeline: Entry[]; totalPaise: number; buyPaise: number; otherPaise: number; byCategory: { category: string; amountPaise: number }[] }

export default function InvestmentsPage() {
  const [range, setRange] = useState<RangeValue>(rangeFor("month"));
  const [edit, setEdit] = useState<Entry | "new" | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["investments", range.from, range.to], queryFn: () => api.get<Res>(`/investments?from=${range.from}&to=${range.to}`) });
  const del = useAction((id: string) => api.del(`/investments/${id}`), { success: "Removed", invalidate: ["investments", "summary", "home"] });
  const max = Math.max(1, ...(data?.byCategory.map((c) => c.amountPaise) ?? [1]));

  return (
    <div>
      <PageHeader title="Investments" subtitle="Everything you have put money into: market buys with their trip costs, and anything else like rent, a weighing scale or packing."
        actions={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEdit("new")}>Add an investment</Button>} />
      <RangePicker value={range} onChange={setRange} presets={["month", "lastMonth", "last90", "year"]} className="mb-6" />
      {data && (
        <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr_1.3fr]">
          <div className="rounded-2xl bg-primary-soft p-5"><div className="text-[14px] font-semibold text-primary">Total put in</div><div className="display mt-1 text-[36px] leading-none">{formatINR(data.totalPaise, { decimals: false })}</div></div>
          <div className="grid gap-4"><div className="rounded-2xl bg-lav-soft p-4"><div className="text-[14px] font-semibold text-lav">Market buys + trip costs</div><div className="display text-[24px]">{compactINR(data.buyPaise)}</div></div><div className="rounded-2xl bg-peach-soft p-4"><div className="text-[14px] font-semibold text-peach">Other investments</div><div className="display text-[24px]">{compactINR(data.otherPaise)}</div></div></div>
          <Card title="By kind"><div className="space-y-3 p-5">
            {data.byCategory.map((c, i) => (
              <div key={c.category} className="grid grid-cols-[120px_1fr_80px] items-center gap-3 text-[15px]"><span className="truncate">{c.category}</span><div className="h-4 overflow-hidden rounded-lg bg-bg2"><motion.div className="h-full rounded-lg bg-primary-soft" initial={{ width: 0 }} animate={{ width: `${(c.amountPaise / max) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.05 }} /></div><span className="text-right font-semibold">{compactINR(c.amountPaise)}</span></div>
            ))}
            {!data.byCategory.length && <p className="text-center text-[15px] text-muted">Nothing in this period.</p>}
          </div></Card>
        </div>
      )}
      <Card plain className="overflow-hidden">
        <Table rows={data?.timeline} loading={isLoading} rowKey={(r) => r.type + r.id} empty={<div className="px-6 py-10 text-center text-[15px] text-muted">Nothing put in during this period.</div>}
          columns={[
            { key: "d", header: "Date", cell: (r) => fmtDate(r.date, { day: "numeric", month: "short", year: "numeric" }) },
            { key: "w", header: "What", cell: (r) => (r.type === "BUY" ? <Link href={`/buy/${r.id}`} className="font-semibold text-primary hover:underline">{r.title}</Link> : <span className="font-semibold">{r.title}</span>) },
            { key: "k", header: "Kind", cell: (r) => <Badge tone={r.type === "BUY" ? "blue" : "orange"}>{r.category}</Badge> },
            { key: "a", header: "Amount", align: "right", cell: (r) => <b>{formatINR(r.amountPaise, { decimals: false })}</b> },
            { key: "x", header: "", align: "right", cell: (r) => r.type === "OTHER" ? <span className="flex justify-end gap-1"><button className="rounded-lg p-2 text-muted hover:bg-bg2 hover:text-primary" onClick={() => setEdit(r)} aria-label="Edit"><Pencil className="h-4 w-4" /></button><button className="rounded-lg p-2 text-muted hover:bg-bg2 hover:text-sindoor" onClick={() => confirm("Remove this investment?") && del.mutate(r.id)} aria-label="Remove"><Trash2 className="h-4 w-4" /></button></span> : null },
          ]} />
      </Card>
      {edit && <Editor entry={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function Editor({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  const { data: cats } = useQuery({ queryKey: ["inv-cats"], queryFn: () => api.get<string[]>("/investments/categories") });
  const [f, setF] = useState({ date: entry?.date ?? todayKey(), label: entry?.title ?? "", category: entry?.category ?? "", amount: entry ? rupeeStr(entry.amountPaise) : "", note: entry?.detail ?? "" });
  const body = () => ({ date: f.date, label: f.label, category: f.category, amountPaise: paise(f.amount), note: f.note || undefined });
  const save = useAction(() => (entry ? api.put(`/investments/${entry.id}`, body()) : api.post("/investments", body())), { success: "Saved", invalidate: ["investments", "summary", "home", "inv-cats"], onSuccess: onClose });
  return (
    <Drawer open onClose={onClose} title={entry ? "Edit investment" : "Add an investment"} subtitle="For money spent outside a market trip. Trip costs go in the New buy screen."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={f.label.length < 2 || !f.category || !paise(f.amount)} onClick={() => save.mutate(undefined)}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What was it?" className="sm:col-span-2"><Input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="e.g. Weighing machine" /></Field>
        <Field label="Kind" hint="Type any name, e.g. Equipment, Rent, Packing."><Input list="inv-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /><datalist id="inv-cat">{cats?.map((c) => <option key={c} value={c} />)}</datalist></Field>
        <Field label="Amount (₹)"><Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Date"><Input type="date" value={f.date} max={todayKey()} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Note" className="sm:col-span-2"><Textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      </div>
    </Drawer>
  );
}
