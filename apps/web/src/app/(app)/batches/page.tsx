"use client";
import { useActiveBusiness } from "@/lib/business";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Paintbrush, Plus, X } from "lucide-react";
import { formatINR } from "@pp/shared";
import { BusinessSelect } from "@/components/BusinessSelect";
import { Drawer } from "@/components/ui/Drawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, Card, Field, Input, Select } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { fmtDate, todayKey } from "@/lib/format";
import { useAction, useBusinesses, useProducts } from "@/lib/hooks";
import { paise } from "@/lib/money";

interface Line { qty: number; valuePaise: number; name: string; unit: string }
interface Batch { id: string; name: string; date: string; business: string; inputsPaise: number; costsPaise: number; totalPaise: number; costs: { kind: string; amountPaise: number }[]; inputs: Line[]; outputs: Line[]; unitCostPaise: number }
const rs = (n: number) => formatINR(n, { decimals: false });

export default function BatchesPage() {
  const [open, setOpen] = useState(false);
  const ab = useActiveBusiness();
  const { data } = useQuery({ queryKey: ["batches", ab.id ?? ""], queryFn: () => api.get<Batch[]>(`/batches${ab.id ? `?businessId=${ab.id}` : ""}`) });
  return (
    <div>
      <PageHeader title="Make & process" subtitle="Raw goods go in, colour and labour are added, finished goods come out. The full cost moves into the finished goods, so you know what each piece really cost."
        actions={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New batch</Button>} />
      <div className="space-y-4">
        {data?.length === 0 && <p className="text-[15px] text-muted">No batches yet.</p>}
        {data?.map((b) => (
          <Card key={b.id} title={<span className="flex items-center gap-2"><Paintbrush className="h-4 w-4 text-primary" />{b.name}</span>} subtitle={`${b.business} · ${fmtDate(b.date, { day: "numeric", month: "short", year: "numeric" })}`}>
            <div className="grid gap-4 p-5 text-[15px] md:grid-cols-4">
              <div><div className="text-[13.5px] text-muted">Went in</div>{b.inputs.map((l, i) => <div key={i}>{l.qty} {l.unit} {l.name}</div>)}<div className="mt-1 font-semibold">{rs(b.inputsPaise)}</div></div>
              <div><div className="text-[13.5px] text-muted">Added</div>{b.costs.map((c, i) => <div key={i}>{c.kind} {rs(c.amountPaise)}</div>)}{!b.costs.length && <div className="text-muted">Nothing</div>}</div>
              <div><div className="text-[13.5px] text-muted">Came out</div>{b.outputs.map((l, i) => <div key={i}>{l.qty} {l.unit} {l.name}</div>)}</div>
              <div className="rounded-xl bg-primary-soft p-3"><div className="text-[13.5px] text-primary">Real cost</div><div className="display text-[24px]">{rs(b.totalPaise)}</div><div className="text-[13.5px] text-text/60">{rs(b.unitCostPaise)} each</div></div>
            </div>
          </Card>
        ))}
      </div>
      {open && <Editor onClose={() => setOpen(false)} />}
    </div>
  );
}

function Editor({ onClose }: { onClose: () => void }) {
  const ab0 = useActiveBusiness();
  const { data: biz } = useBusinesses();
  const { data: prods } = useProducts();
  const [f, setF] = useState({ businessId: ab0.id ?? "", name: "", date: todayKey() });
  const [inputs, setInputs] = useState([{ productId: "", qty: "" }]);
  const [outputs, setOutputs] = useState([{ productId: "", qty: "" }]);
  const [costs, setCosts] = useState([{ kind: "Labour", amount: "" }, { kind: "Colour", amount: "" }]);
  const clean = (l: { productId: string; qty: string }[]) => l.filter((x) => x.productId && Number(x.qty) > 0).map((x) => ({ productId: x.productId, qty: Number(x.qty) }));
  const save = useAction(() => api.post("/batches", { ...f, inputs: clean(inputs), outputs: clean(outputs), costs: costs.filter((c) => paise(c.amount) > 0).map((c) => ({ kind: c.kind.trim() || "Other", amountPaise: paise(c.amount) })) }), { success: "Batch saved", invalidate: ["batches", "products", "place-stock"], onSuccess: onClose });
  const items = prods?.items ?? [];
  const Rows = ({ rows, set, label }: { rows: { productId: string; qty: string }[]; set: (r: { productId: string; qty: string }[]) => void; label: string }) => (
    <div className="space-y-2"><div className="text-[14px] font-semibold">{label}</div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_90px_auto] gap-2">
          <Select value={r.productId} onChange={(e) => set(rows.map((x, j) => (j === i ? { ...x, productId: e.target.value } : x)))}><option value="">Choose item…</option>{items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
          <Input inputMode="decimal" placeholder="Qty" value={r.qty} onChange={(e) => set(rows.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
          <button className="rounded-lg p-2 text-muted hover:bg-bg2" aria-label="Remove" onClick={() => rows.length > 1 && set(rows.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
        </div>
      ))}
      <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => set([...rows, { productId: "", qty: "" }])}>Add</Button>
    </div>
  );
  const ok = f.businessId && f.name.trim().length >= 2 && clean(inputs).length && clean(outputs).length;
  return (
    <Drawer open onClose={onClose} wide title="New batch" subtitle="Create the finished item first (Stock → Add an item) if it does not exist yet."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={!ok} onClick={() => save.mutate(undefined)}>Save batch</Button></>}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Business"><BusinessSelect value={f.businessId} onChange={(v) => setF({ ...f, businessId: v })} list={biz} none="Choose…" /></Field>
          <Field label="Batch name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Diwali painted pots" /></Field>
          <Field label="Date"><Input type="date" value={f.date} max={todayKey()} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        </div>
        <Rows rows={inputs} set={setInputs} label="Raw goods used" />
        <div className="space-y-2"><div className="text-[14px] font-semibold">Costs added (₹)</div>
          {costs.map((c, i) => <div key={i} className="grid grid-cols-[1fr_130px] gap-2"><Input value={c.kind} onChange={(e) => setCosts(costs.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))} /><Input inputMode="decimal" value={c.amount} onChange={(e) => setCosts(costs.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} placeholder="0" /></div>)}
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCosts([...costs, { kind: "", amount: "" }])}>Add cost</Button>
        </div>
        <Rows rows={outputs} set={setOutputs} label="Finished goods made" />
      </div>
    </Drawer>
  );
}
