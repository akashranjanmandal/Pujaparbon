"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { Building2, Phone, Plus, Trash2, Truck } from "lucide-react";
import { toPaise } from "@pp/shared";
import { Drawer } from "@/components/ui/Drawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table } from "@/components/ui/Table";
import { Badge, Button, Card, Field, Input, Select } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { compactINR, fmtDate, formatINR, todayKey } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { useSkus } from "@/lib/useCatalog";

interface Supplier { id: string; name: string; contactName: string | null; phone: string | null; city: string | null; gstin: string | null; purchases: number; spentPaise: number; lastPurchase: string | null }
interface Purchase { id: string; number: string; invoiceNo: string; date: string; totalPaise: number; supplierName: string; units: number }

export default function PurchasesPage() {
  const [supplierId, setSupplierId] = useState("");
  const [newPO, setNewPO] = useState(false);
  const [newSup, setNewSup] = useState(false);
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: () => api.get<Supplier[]>("/suppliers") });
  const { data: purchases, isLoading } = useQuery({ queryKey: ["purchases", supplierId], queryFn: () => api.get<Purchase[]>(`/purchases${supplierId ? `?supplierId=${supplierId}` : ""}`) });
  const top = Math.max(1, ...(suppliers?.map((s) => s.spentPaise) ?? [1]));

  return (
    <div>
      <PageHeader title="Purchases" subtitle="Saving a purchase adds the stock to the shelf and updates each SKU's cost price."
        actions={<><Button icon={<Building2 className="h-4 w-4" />} onClick={() => setNewSup(true)}>New supplier</Button><Button variant="primary" icon={<Truck className="h-4 w-4" />} onClick={() => setNewPO(true)}>Receive purchase</Button></>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {suppliers?.map((s, i) => (
          <motion.button key={s.id} onClick={() => setSupplierId(supplierId === s.id ? "" : s.id)} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`paar-card p-5 text-left transition ${supplierId === s.id ? "border-primary shadow-glow" : "hover:border-primary/30"}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[16px] font-semibold">{s.name}</div>
                <div className="text-[14px] text-muted">{s.contactName} · {s.city}</div>
              </div>
              <Badge tone="gold">{s.purchases} POs</Badge>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div><div className="text-[14px] text-muted">Bought so far</div><div className="text-[22px] font-semibold tracking-tight">{compactINR(s.spentPaise)}</div></div>
              {s.phone && <a href={`tel:${s.phone}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-[14px] text-primary"><Phone className="h-3 w-3" />{s.phone}</a>}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line/10"><motion.div className="h-full bg-primary" initial={{ width: 0 }} animate={{ width: `${(s.spentPaise / top) * 100}%` }} transition={{ duration: 1, delay: 0.3 }} /></div>
          </motion.button>
        ))}
      </div>

      <Card plain title={supplierId ? `Purchases from ${suppliers?.find((s) => s.id === supplierId)?.name}` : "All purchases"} className="overflow-hidden">
        <Table rows={purchases} loading={isLoading} columns={[
          { key: "no", header: "PO", cell: (p) => <code className="font-semibold">{p.number}</code> },
          { key: "date", header: "Date", cell: (p) => fmtDate(p.date, { day: "numeric", month: "short", year: "numeric" }) },
          { key: "sup", header: "Supplier", cell: (p) => p.supplierName },
          { key: "inv", header: "Supplier bill", cell: (p) => <span className="text-muted">{p.invoiceNo}</span> },
          { key: "units", header: "Units", align: "right", cell: (p) => p.units },
          { key: "total", header: "Total", align: "right", cell: (p) => <b className="num">{formatINR(p.totalPaise, { decimals: false })}</b> },
        ]} />
      </Card>
      {newPO && <PurchaseDrawer suppliers={suppliers ?? []} onClose={() => setNewPO(false)} />}
      {newSup && <SupplierDrawer onClose={() => setNewSup(false)} />}
    </div>
  );
}

function PurchaseDrawer({ suppliers, onClose }: { suppliers: Supplier[]; onClose: () => void }) {
  const { data: skus } = useSkus();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [date, setDate] = useState(todayKey());
  const [lines, setLines] = useState([{ variantId: "", qty: "10", cost: "" }]);
  const total = lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.cost || 0), 0);
  const save = useAction(() => api.post("/purchases", { supplierId, invoiceNo, date, items: lines.filter((l) => l.variantId).map((l) => ({ variantId: l.variantId, qty: Number(l.qty), costPaise: toPaise(l.cost || 0) })) }), {
    success: "Purchase saved — stock added to the shelves", invalidate: ["purchases", "suppliers", "stock", "products"], onSuccess: onClose,
  });
  return (
    <Drawer open onClose={onClose} wide title="Receive a purchase" subtitle="Enter the supplier's bill. Stock goes up the moment you save."
      footer={<><div className="mr-auto text-[16px] font-semibold">Total {formatINR(total * 100)}</div><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={!invoiceNo || !lines.some((l) => l.variantId)} onClick={() => save.mutate(undefined)}>Save purchase</Button></>}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Supplier"><Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label="Supplier bill no."><Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="SW/2026/118" /></Field>
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        {lines.map((l, i) => {
          const sku = skus?.find((s) => s.variantId === l.variantId);
          return (
            <div key={i} className="grid grid-cols-[1fr_90px_110px_auto] items-end gap-2">
              <Field label={i === 0 ? "Item" : ""}>
                <Select value={l.variantId} onChange={(e) => { const v = skus?.find((s) => s.variantId === e.target.value); setLines((ls) => ls.map((x, j) => (j === i ? { ...x, variantId: e.target.value, cost: v ? String(v.costPaise / 100) : x.cost } : x))); }}>
                  <option value="">Choose SKU…</option>
                  {skus?.map((s) => <option key={s.variantId} value={s.variantId}>{s.sku} — {s.name}</option>)}
                </Select>
              </Field>
              <Field label={i === 0 ? "Qty" : ""}><Input type="number" value={l.qty} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} /></Field>
              <Field label={i === 0 ? "Cost ₹" : ""}><Input type="number" value={l.cost} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, cost: e.target.value } : x)))} /></Field>
              <button className="mb-2 p-2 text-muted hover:text-sindoor" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
              {sku && <div className="col-span-4 -mt-1 text-[14px] text-muted">On hand {sku.onHand} → <b className="text-leaf">{sku.onHand + Number(l.qty || 0)}</b></div>}
            </div>
          );
        })}
        <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setLines((ls) => [...ls, { variantId: "", qty: "10", cost: "" }])}>Add line</Button>
      </div>
    </Drawer>
  );
}

function SupplierDrawer({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ name: "", contactName: "", phone: "", city: "", gstin: "" });
  const save = useAction(() => api.post("/suppliers", f), { success: "Supplier added", invalidate: ["suppliers"], onSuccess: onClose });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Drawer open onClose={onClose} title="New supplier" footer={<Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>Save supplier</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" className="sm:col-span-2"><Input value={f.name} onChange={set("name")} /></Field>
        <Field label="Contact person"><Input value={f.contactName} onChange={set("contactName")} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={set("phone")} /></Field>
        <Field label="City"><Input value={f.city} onChange={set("city")} /></Field>
        <Field label="GSTIN"><Input value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} /></Field>
      </div>
    </Drawer>
  );
}
