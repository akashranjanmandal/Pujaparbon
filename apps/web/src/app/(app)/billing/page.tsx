"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { FileDown, FilePlus2, Plus, ReceiptIndianRupee, Trash2, XCircle } from "lucide-react";
import { INDIAN_STATES, calcInvoice, toPaise } from "@pp/shared";
import { Drawer } from "@/components/ui/Drawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { Table } from "@/components/ui/Table";
import { Button, Card, Field, Input, Select, StatusBadge } from "@/components/ui/primitives";
import { api, openFile } from "@/lib/api";
import { compactINR, fmtDate, formatINR } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { useSkus } from "@/lib/useCatalog";
import { cn } from "@/lib/cn";

interface Invoice { id: string; number: string; date: string; customerName: string; customerGstin: string | null; placeOfSupply: string; totalPaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; status: string; channelName: string | null; by: string | null }

function BillingInner() {
  const params = useSearchParams();
  const [creating, setCreating] = useState(params.get("new") === "1");
  const { data } = useQuery({ queryKey: ["invoices"], queryFn: () => api.get<{ items: Invoice[]; summary: Record<string, number> }>("/invoices") });
  const cancel = useAction((id: string) => api.post(`/invoices/${id}/cancel`), { success: "Invoice cancelled — stock returned", invalidate: ["invoices", "stock"] });
  const s = data?.summary;
  return (
    <div>
      <PageHeader bn="জিএসটি বিল" title="GST Billing" subtitle="Tax invoices for counter sales, bulk buyers and puja committees. CGST + SGST inside West Bengal, IGST outside — worked out for you."
        actions={<Button variant="primary" icon={<FilePlus2 className="h-4 w-4" />} onClick={() => setCreating(true)}>New invoice</Button>} />
      {s && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Invoices this month" value={s.monthCount} icon={<ReceiptIndianRupee className="h-5 w-5" />} />
          <Stat label="Billed this month" value={s.monthTotalPaise} format={compactINR} icon={<ReceiptIndianRupee className="h-5 w-5" />} tone="green" delay={0.05} />
          <Stat label="GST collected this month" value={s.monthTaxPaise} format={compactINR} icon={<ReceiptIndianRupee className="h-5 w-5" />} tone="blue" delay={0.1} />
        </div>
      )}
      <Card plain className="overflow-hidden">
        <Table rows={data?.items} loading={!data} onRowClick={(i) => openFile(`/invoices/${i.id}/pdf`)} columns={[
          { key: "n", header: "Invoice", cell: (i) => <div><code className="font-semibold">{i.number}</code><div className="text-xs text-muted">{fmtDate(i.date, { day: "numeric", month: "short", year: "numeric" })}</div></div> },
          { key: "c", header: "Bill to", cell: (i) => <div><div>{i.customerName}</div>{i.customerGstin && <code className="text-xs text-muted">{i.customerGstin}</code>}</div> },
          { key: "p", header: "Place of supply", cell: (i) => <span className="text-muted">{i.placeOfSupply}</span> },
          { key: "t", header: "Tax", cell: (i) => <span className="text-xs text-muted">{i.igstPaise ? `IGST ${formatINR(i.igstPaise)}` : `CGST+SGST ${formatINR(i.cgstPaise + i.sgstPaise)}`}</span> },
          { key: "v", header: "Total", align: "right", cell: (i) => <b className={cn("num", i.status === "CANCELLED" && "line-through opacity-50")}>{formatINR(i.totalPaise)}</b> },
          { key: "s", header: "", cell: (i) => <StatusBadge status={i.status} /> },
          { key: "a", header: "", align: "right", cell: (i) => (
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="ghost" icon={<FileDown className="h-3.5 w-3.5" />} onClick={() => openFile(`/invoices/${i.id}/pdf`)}>PDF</Button>
              {i.status === "ISSUED" && <Button size="sm" variant="ghost" icon={<XCircle className="h-3.5 w-3.5" />} onClick={() => confirm(`Cancel ${i.number}? Stock will be returned.`) && cancel.mutate(i.id)} />}
            </div>
          ) },
        ]} />
      </Card>
      {creating && <InvoiceDrawer onClose={() => setCreating(false)} />}
    </div>
  );
}

interface Line { variantId: string; description: string; hsn: string; qty: string; rate: string; gstRate: number }

function InvoiceDrawer({ onClose }: { onClose: () => void }) {
  const { data: skus } = useSkus();
  const { data: products } = useQuery({ queryKey: ["products", ""], queryFn: () => api.get<{ items: { id: string; hsnCode: string; gstRate: number; variants: { id: string }[] }[] }>("/products") });
  const [customerName, setCustomer] = useState("");
  const [gstin, setGstin] = useState("");
  const [pos, setPos] = useState("West Bengal");
  const [deductStock, setDeduct] = useState(true);
  const [lines, setLines] = useState<Line[]>([{ variantId: "", description: "", hsn: "", qty: "1", rate: "", gstRate: 5 }]);
  const totals = useMemo(() => calcInvoice(lines.map((l) => ({ ratePaise: toPaise(l.rate || 0), qty: Number(l.qty || 0), gstRate: l.gstRate, inclusive: true })), { sellerState: "West Bengal", placeOfSupply: pos }), [lines, pos]);
  const pick = (i: number, variantId: string) => {
    const s = skus?.find((x) => x.variantId === variantId);
    const p = products?.items.find((x) => x.variants.some((v) => v.id === variantId));
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, variantId, description: s ? `${s.name}${s.color ? ` — ${s.color}` : s.size ? ` — ${s.size}` : ""}` : "", hsn: p?.hsnCode ?? "", gstRate: p?.gstRate ?? 5, rate: s ? String(s.pricePaise / 100) : "" } : l)));
  };
  const save = useAction(() => api.post("/invoices", {
    customerName, customerGstin: gstin, placeOfSupply: pos, pricesInclusive: true, deductStock, channel: "OFFLINE",
    items: lines.filter((l) => l.description).map((l) => ({ variantId: l.variantId || undefined, description: l.description, hsn: l.hsn, qty: Number(l.qty), ratePaise: toPaise(l.rate || 0), gstRate: l.gstRate })),
  }), { success: "Invoice issued", invalidate: ["invoices", "stock"], onSuccess: onClose });

  return (
    <Drawer open onClose={onClose} wide title="New tax invoice" subtitle="Prices include GST, the way you quote them at the counter."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={!customerName || !lines.some((l) => l.description && Number(l.rate))} onClick={() => save.mutate(undefined)}>Issue invoice · {formatINR(totals.totalPaise)}</Button></>}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Bill to"><Input value={customerName} onChange={(e) => setCustomer(e.target.value)} placeholder="Mitra Bastralaya" /></Field>
          <Field label="Customer GSTIN" hint="Leave blank for consumers (B2C)"><Input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} /></Field>
          <Field label="Place of supply"><Select value={pos} onChange={(e) => setPos(e.target.value)}>{INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-2xl border border-line/10 bg-bg2/50 p-3">
              <Field label="Item" className="col-span-12 sm:col-span-5">
                <Select value={l.variantId} onChange={(e) => pick(i, e.target.value)}>
                  <option value="">Choose from stock…</option>
                  {skus?.map((s) => <option key={s.variantId} value={s.variantId} disabled={s.onHand <= 0}>{s.emoji} {s.name} · {s.sku} ({s.onHand})</option>)}
                </Select>
              </Field>
              <Field label="HSN" className="col-span-3 sm:col-span-2"><Input value={l.hsn} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, hsn: e.target.value } : x)))} /></Field>
              <Field label="Qty" className="col-span-2 sm:col-span-1"><Input type="number" value={l.qty} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} /></Field>
              <Field label="Rate ₹" className="col-span-3 sm:col-span-2"><Input type="number" value={l.rate} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)))} /></Field>
              <div className="col-span-3 pb-2.5 text-right text-xs text-muted sm:col-span-1">{l.gstRate}%</div>
              <button className="col-span-1 pb-2 text-muted hover:text-sindoor" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setLines((ls) => [...ls, { variantId: "", description: "", hsn: "", qty: "1", rate: "", gstRate: 5 }])}>Add line</Button>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={deductStock} onChange={(e) => setDeduct(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--sindoor))]" /> Take these items out of stock</label>
        <motion.div layout className="ml-auto max-w-sm space-y-2 rounded-2xl border border-gold/25 bg-gold/[0.06] p-5 text-sm">
          <Row k="Taxable value" v={totals.subtotalPaise} />
          {totals.interState ? <Row k="IGST" v={totals.igstPaise} /> : <><Row k="CGST" v={totals.cgstPaise} /><Row k="SGST" v={totals.sgstPaise} /></>}
          <div className="flex justify-between border-t border-gold/20 pt-2 font-display text-xl"><span>Total</span><span className="gold-text num">{formatINR(totals.totalPaise)}</span></div>
          <div className="text-xs text-muted">{totals.interState ? `Inter-state supply to ${pos}: IGST applies.` : "Intra-state supply: CGST and SGST split equally."}</div>
        </motion.div>
      </div>
    </Drawer>
  );
}
const Row = ({ k, v }: { k: string; v: number }) => <div className="flex justify-between"><span className="text-muted">{k}</span><span className="num">{formatINR(v)}</span></div>;

export default function BillingPage() {
  return <Suspense><BillingInner /></Suspense>;
}
