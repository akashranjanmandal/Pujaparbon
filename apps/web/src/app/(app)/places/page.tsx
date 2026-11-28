"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { formatINR } from "@pp/shared";
import { Drawer } from "@/components/ui/Drawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table } from "@/components/ui/Table";
import { Button, Card, Field, Input, Select } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { useAction, usePlaces, useProducts } from "@/lib/hooks";

interface Row { productId: string; name: string; unit: string; locationId: string | null; qty: number; valuePaise: number }

export default function PlacesPage() {
  const { data: places } = usePlaces();
  const { data: rows, isLoading } = useQuery({ queryKey: ["place-stock"], queryFn: () => api.get<Row[]>("/place-stock") });
  const [open, setOpen] = useState(false);
  const groups = [{ id: null as string | null, name: "Main stock (not placed yet)" }, ...(places ?? []).map((p) => ({ id: p.id as string | null, name: p.name }))];
  return (
    <div>
      <PageHeader title="Stock by place" subtitle="What is at the shop, at each haat, in the warehouse. Move goods between places here."
        actions={<Button variant="primary" icon={<ArrowLeftRight className="h-4 w-4" />} onClick={() => setOpen(true)}>Move stock</Button>} />
      <div className="space-y-6">
        {groups.map((g) => {
          const list = rows?.filter((r) => r.locationId === g.id) ?? [];
          if (!isLoading && !list.length && g.id !== null) return null;
          return (
            <Card key={g.id ?? "main"} title={g.name} subtitle={`${formatINR(list.reduce((a, r) => a + r.valuePaise, 0), { decimals: false })} at cost`} plain className="overflow-hidden">
              <Table rows={list} loading={isLoading} rowKey={(r) => r.productId + (r.locationId ?? "")} empty={<div className="px-6 py-6 text-[15px] text-muted">Nothing here.</div>}
                columns={[{ key: "n", header: "Item", cell: (r) => <span className="font-semibold">{r.name}</span> }, { key: "q", header: "In stock", align: "right", cell: (r) => `${r.qty} ${r.unit}` }, { key: "v", header: "Value", align: "right", cell: (r) => formatINR(r.valuePaise, { decimals: false }) }]} />
            </Card>
          );
        })}
      </div>
      {open && <Move onClose={() => setOpen(false)} />}
    </div>
  );
}

function Move({ onClose }: { onClose: () => void }) {
  const { data: places } = usePlaces();
  const { data: prods } = useProducts();
  const [f, setF] = useState({ productId: "", qty: "1", from: "", to: "" });
  const save = useAction(() => api.post("/place-stock/transfer", { productId: f.productId, qty: Number(f.qty), fromLocationId: f.from || null, toLocationId: f.to }), { success: "Moved", invalidate: ["place-stock"], onSuccess: onClose });
  return (
    <Drawer open onClose={onClose} title="Move stock" subtitle="Takes goods from one place and puts them in another. The total does not change."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={!f.productId || !f.to || Number(f.qty) <= 0 || f.from === f.to} onClick={() => save.mutate(undefined)}>Move</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Item" className="sm:col-span-2"><Select value={f.productId} onChange={(e) => setF({ ...f, productId: e.target.value })}><option value="">Choose item…</option>{prods?.items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="How many"><Input inputMode="decimal" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></Field>
        <div />
        <Field label="From"><Select value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })}><option value="">Main stock</option>{places?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="To"><Select value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}><option value="">Choose…</option>{places?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
      </div>
      {!places?.length && <p className="mt-4 text-[14.5px] text-muted">Add your shop, haats and warehouse first in Settings → Businesses & places.</p>}
    </Drawer>
  );
}
