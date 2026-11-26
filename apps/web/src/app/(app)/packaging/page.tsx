"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, Minus, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, Card, Field, Input } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/Drawer";
import { api } from "@/lib/api";
import { useAction } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";

interface Item { id: string; name: string; category: string; unit: string; onHand: number }
interface Material { id: string; name: string; unit: string; qty: number; minQty: number; low: boolean }
interface Data { items: Item[]; materials: Material[]; needBuying: Material[] }

/** The packing team's page. It never shows prices or costs. */
export default function PackagingPage() {
  const { can } = useAuth();
  const manage = can("packaging.manage");
  const { data } = useQuery({ queryKey: ["packaging"], queryFn: () => api.get<Data>("/packaging") });
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const set = useAction(({ id, ...body }: { id: string; qty?: number; minQty?: number }) => api.patch(`/packaging/materials/${id}`, body), { invalidate: ["packaging"] });
  const remove = useAction((id: string) => api.del(`/packaging/materials/${id}`), { success: "Removed", invalidate: ["packaging"] });
  const items = data?.items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase())) ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title="Packing" subtitle="What is in stock to pack, and the boxes, tape and other packing materials."
        actions={manage && <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Add a packing material</Button>} />

      {data && data.needBuying.length > 0 && (
        <div className="rounded-2xl bg-peach-soft p-5">
          <div className="flex items-center gap-2 text-[17px] font-semibold text-peach"><AlertTriangle className="h-5 w-5" /> Needs buying</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.needBuying.map((m) => <span key={m.id} className="rounded-full bg-panel px-4 py-1.5 text-[15px] font-semibold">{m.name} · {m.qty === 0 ? "finished" : `${m.qty} ${m.unit} left`}</span>)}
          </div>
        </div>
      )}

      <Card title="Packing materials" subtitle="Update the count when you use or receive some.">
        <div className="divide-y divide-line/10">
          {data?.materials.length === 0 && <p className="p-6 text-muted">No packing materials added yet.</p>}
          {data?.materials.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-4 p-4 sm:px-6">
              <div className="min-w-0 flex-1">
                <div className="text-[17px] font-semibold">{m.name}</div>
                <div className={m.low ? "text-[14px] font-semibold text-peach" : "text-[14px] text-muted"}>{m.low ? "Running low" : "In stock"} · warn at {m.minQty} {m.unit}</div>
              </div>
              {manage ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => set.mutate({ id: m.id, qty: Math.max(0, m.qty - 1) })} className="grid h-11 w-11 place-items-center rounded-xl border border-line/15 bg-panel active:scale-95" aria-label="One less"><Minus className="h-4 w-4" /></button>
                  <input inputMode="numeric" defaultValue={m.qty} key={m.qty} onBlur={(e) => Number(e.target.value) !== m.qty && set.mutate({ id: m.id, qty: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} onFocus={(e) => e.currentTarget.select()} className="h-11 w-[84px] rounded-xl border border-line/20 bg-panel text-center text-[18px] font-semibold" aria-label={`Count of ${m.name}`} />
                  <button onClick={() => set.mutate({ id: m.id, qty: m.qty + 1 })} className="grid h-11 w-11 place-items-center rounded-xl border border-line/15 bg-panel active:scale-95" aria-label="One more"><Plus className="h-4 w-4" /></button>
                  <button onClick={() => confirm(`Remove ${m.name}?`) && remove.mutate(m.id)} className="ml-1 grid h-11 w-11 place-items-center rounded-xl text-muted hover:text-sindoor" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
                </div>
              ) : <div className="text-[22px] font-semibold">{m.qty} <span className="text-[14px] font-normal text-muted">{m.unit}</span></div>}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Items in stock" subtitle="How many of each item are ready to pack."
        action={<Input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="w-44" />}>
        <div className="divide-y divide-line/10">
          {items.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-4 p-4 sm:px-6">
              <div><div className="text-[17px] font-semibold">{i.name}</div><div className="text-[14px] text-muted">{i.category}</div></div>
              <div className="text-[22px] font-semibold">{i.onHand.toLocaleString("en-IN")} <span className="text-[14px] font-normal text-muted">{i.unit}</span></div>
            </div>
          ))}
          {data && items.length === 0 && <p className="p-6 text-muted">Nothing in stock.</p>}
        </div>
      </Card>
      {adding && <AddMaterial onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddMaterial({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ name: "", qty: "", minQty: "", unit: "pcs" });
  const save = useAction(() => api.post("/packaging/materials", { name: f.name, unit: f.unit || "pcs", qty: Number(f.qty) || 0, minQty: Number(f.minQty) || 0 }), { success: "Added", invalidate: ["packaging"], onSuccess: onClose });
  return (
    <Drawer open onClose={onClose} title="Add a packing material" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={f.name.trim().length < 2} onClick={() => save.mutate(undefined)}>Add</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Small boxes, Tape, Bubble wrap" /></Field>
        <Field label="How many now"><Input inputMode="numeric" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} placeholder="0" /></Field>
        <Field label="Warn me at or below" hint="It shows under Needs buying."><Input inputMode="numeric" value={f.minQty} onChange={(e) => setF({ ...f, minQty: e.target.value })} placeholder="10" /></Field>
        <Field label="Unit"><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
      </div>
    </Drawer>
  );
}
