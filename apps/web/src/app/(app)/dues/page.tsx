"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { formatINR } from "@pp/shared";
import { BusinessSelect } from "@/components/BusinessSelect";
import { Drawer } from "@/components/ui/Drawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table } from "@/components/ui/Table";
import { Badge, Button, Card, Field, Input, Segmented, Select } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { fmtDate, todayKey } from "@/lib/format";
import { useAction, useBusinesses } from "@/lib/hooks";
import { paise } from "@/lib/money";

interface Party { id: string; name: string; kind: "CUSTOMER" | "SUPPLIER"; phone: string | null; billedPaise: number; paidPaise: number; advancePaise: number; duePaise: number }
interface Entry { id: string; kind: string; amountPaise: number; date: string; note: string | null }

export default function DuesPage() {
  const [tab, setTab] = useState<"CUSTOMER" | "SUPPLIER">("CUSTOMER");
  const [add, setAdd] = useState(false);
  const [open, setOpen] = useState<Party | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["dues"], queryFn: () => api.get<Party[]>("/dues") });
  const rows = (data ?? []).filter((p) => p.kind === tab);
  const owed = rows.filter((p) => p.duePaise > 0).reduce((a, p) => a + p.duePaise, 0);
  return (
    <div>
      <PageHeader title="Dues" subtitle="Who owes you money, and whom you owe. Unpaid sales add to a customer's due automatically."
        actions={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setAdd(true)}>Add a {tab === "CUSTOMER" ? "customer" : "supplier"}</Button>} />
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Segmented value={tab} onChange={setTab} options={[{ value: "CUSTOMER", label: "Customers (they owe me)" }, { value: "SUPPLIER", label: "Suppliers (I owe)" }]} />
        <div className="rounded-2xl bg-peach-soft px-5 py-3"><span className="text-[14px] font-semibold text-peach">{tab === "CUSTOMER" ? "To receive" : "To pay"} </span><span className="display text-[24px]">{formatINR(owed, { decimals: false })}</span></div>
      </div>
      <Card plain className="overflow-hidden">
        <Table rows={rows} loading={isLoading} onRowClick={setOpen} empty={<div className="px-6 py-10 text-center text-[15px] text-muted">Nobody added yet.</div>}
          columns={[
            { key: "n", header: "Name", cell: (r) => <span className="font-semibold">{r.name}</span> },
            { key: "p", header: "Phone", cell: (r) => r.phone ?? "—" },
            { key: "b", header: "Billed", align: "right", cell: (r) => formatINR(r.billedPaise, { decimals: false }) },
            { key: "r", header: "Paid / advance", align: "right", cell: (r) => formatINR(r.paidPaise + r.advancePaise, { decimals: false }) },
            { key: "d", header: "Due", align: "right", cell: (r) => <Badge tone={r.duePaise > 0 ? "orange" : "green"}>{r.duePaise < 0 ? `Advance ${formatINR(-r.duePaise, { decimals: false })}` : formatINR(r.duePaise, { decimals: false })}</Badge> },
          ]} />
      </Card>
      {add && <AddParty kind={tab} onClose={() => setAdd(false)} />}
      {open && <PartyDrawer party={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function AddParty({ kind, onClose }: { kind: "CUSTOMER" | "SUPPLIER"; onClose: () => void }) {
  const [f, setF] = useState({ name: "", phone: "" });
  const save = useAction(() => api.post("/dues", { name: f.name, kind, phone: f.phone || undefined }), { success: "Added", invalidate: ["dues"], onSuccess: onClose });
  return (
    <Drawer open onClose={onClose} title={kind === "CUSTOMER" ? "Add a customer" : "Add a supplier"} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={f.name.trim().length < 2} onClick={() => save.mutate(undefined)}>Add</Button></>}>
      <div className="grid gap-4"><Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Sweet shop, Bamangachi" /></Field><Field label="Phone" hint="Optional"><Input inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field></div>
    </Drawer>
  );
}

function PartyDrawer({ party, onClose }: { party: Party; onClose: () => void }) {
  const { data: biz } = useBusinesses();
  const { data: entries } = useQuery({ queryKey: ["dues", party.id], queryFn: () => api.get<Entry[]>(`/dues/${party.id}/entries`) });
  const [f, setF] = useState({ kind: "PAYMENT", amount: "", date: todayKey(), businessId: "", note: "" });
  const isCust = party.kind === "CUSTOMER";
  const label: Record<string, string> = isCust ? { BILL: "Sold on credit", PAYMENT: "Money received", ADVANCE: "Advance received" } : { BILL: "Bought on credit", PAYMENT: "Money paid", ADVANCE: "Advance paid" };
  const save = useAction(() => api.post("/dues/entries", { partyId: party.id, kind: f.kind, amountPaise: paise(f.amount), date: f.date, businessId: f.businessId || undefined, note: f.note || undefined }), { success: "Saved", invalidate: ["dues"], onSuccess: () => setF({ ...f, amount: "", note: "" }) });
  return (
    <Drawer open onClose={onClose} wide title={party.name} subtitle={isCust ? "Customer" : "Supplier"} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_130px_150px]">
          <Field label="What happened?"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{["PAYMENT", "ADVANCE", "BILL"].map((k) => <option key={k} value={k}>{label[k]}</option>)}</Select></Field>
          <Field label="Amount (₹)"><Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Date"><Input type="date" value={f.date} max={todayKey()} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Business" className="sm:col-span-2"><BusinessSelect value={f.businessId} onChange={(v) => setF({ ...f, businessId: v })} list={biz} none="Not sure / shared" /></Field>
          <div className="flex items-end"><Button variant="primary" loading={save.isPending} disabled={!paise(f.amount)} onClick={() => save.mutate(undefined)}>Save</Button></div>
        </div>
        <div className="divide-y divide-line/[0.06] rounded-2xl border border-line/10">
          {entries?.map((e) => <div key={e.id} className="flex items-center justify-between px-4 py-3 text-[15px]"><div><div className="font-semibold">{label[e.kind]}</div><div className="text-[13px] text-muted">{fmtDate(e.date, { day: "numeric", month: "short", year: "numeric" })}{e.note ? ` · ${e.note}` : ""}</div></div><b className={e.kind === "BILL" ? "text-peach" : "text-leaf"}>{e.kind === "BILL" ? "+" : "−"}{formatINR(e.amountPaise, { decimals: false })}</b></div>)}
          {entries?.length === 0 && <p className="p-4 text-center text-[15px] text-muted">No entries yet.</p>}
        </div>
      </div>
    </Drawer>
  );
}
