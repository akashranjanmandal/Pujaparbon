"use client";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PackageX, RotateCcw, Truck, Undo2 } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { Table } from "@/components/ui/Table";
import { Badge, Button, Card, ChannelDot, Field, Input, Select, StatusBadge } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { compactINR, fmtDate } from "@/lib/format";
import { useAction } from "@/lib/hooks";

interface Ret { id: string; qty: number; type: string; condition: string; status: string; reason: string; createdAt: string; channelOrderId: string; channelName: string; channelColor: string; sku: string; name: string; emoji: string; lossPaise: number }
interface Order { id: string; channelOrderId: string; items: { variantId: string | null; name: string | null; sku: string | null; qty: number; emoji: string | null }[] }

function ReturnsInner() {
  const params = useSearchParams();
  const [orderId, setOrderId] = useState(params.get("order") ?? "");
  const [lookup, setLookup] = useState("");
  const { data } = useQuery({ queryKey: ["returns"], queryFn: () => api.get<{ items: Ret[]; summary: Record<string, number> }>("/returns") });
  const find = useAction((q: string) => api.get<{ items: { id: string }[] }>(`/orders?search=${encodeURIComponent(q)}&pageSize=1`), {
    onSuccess: (r) => (r.items[0] ? setOrderId(r.items[0].id) : alert("No order with that ID")),
  });
  const s = data?.summary;

  return (
    <div>
      <PageHeader bn="ফেরত পণ্য" title="Returns" subtitle="Good returns go straight back on the shelf. Damaged ones are written off at cost so you see the real loss."
        actions={
          <div className="flex gap-2">
            <Input placeholder="Scan or type order ID" value={lookup} onChange={(e) => setLookup(e.target.value)} onKeyDown={(e) => e.key === "Enter" && find.mutate(lookup)} className="w-56" />
            <Button variant="primary" icon={<Undo2 className="h-4 w-4" />} loading={find.isPending} onClick={() => find.mutate(lookup)}>Log return</Button>
          </div>
        } />
      {s && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Returns logged" value={s.total} icon={<Undo2 className="h-5 w-5" />} />
          <Stat label="Units restocked" value={s.restocked} icon={<RotateCcw className="h-5 w-5" />} tone="green" delay={0.05} />
          <Stat label="RTO (never delivered)" value={s.rto} icon={<Truck className="h-5 w-5" />} tone="blue" delay={0.1} />
          <Stat label="Written-off loss" value={s.lossPaise} format={compactINR} icon={<PackageX className="h-5 w-5" />} tone="red" delay={0.15} />
        </div>
      )}
      <Card plain className="overflow-hidden">
        <Table rows={data?.items} loading={!data} columns={[
          { key: "date", header: "Date", cell: (r) => fmtDate(r.createdAt) },
          { key: "order", header: "Order", cell: (r) => <div><code className="text-xs">{r.channelOrderId}</code><ChannelDot color={r.channelColor} name={r.channelName} className="mt-1 block" /></div> },
          { key: "item", header: "Item", cell: (r) => <div className="flex items-center gap-2"><span className="text-lg">{r.emoji}</span><div><div className="max-w-[200px] truncate">{r.name}</div><code className="text-xs text-muted">{r.sku} × {r.qty}</code></div></div> },
          { key: "type", header: "Type", cell: (r) => <Badge tone={r.type === "RTO" ? "blue" : "muted"}>{r.type === "RTO" ? "RTO" : "Customer"}</Badge> },
          { key: "reason", header: "Reason", cell: (r) => <span className="text-muted">{r.reason}</span> },
          { key: "status", header: "Outcome", cell: (r) => <StatusBadge status={r.status} /> },
        ]} />
      </Card>
      <ReturnDrawer orderId={orderId} onClose={() => setOrderId("")} />
    </div>
  );
}

function ReturnDrawer({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { data: o } = useQuery({ queryKey: ["order", orderId], queryFn: () => api.get<Order>(`/orders/${orderId}`), enabled: !!orderId });
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState("1");
  const [type, setType] = useState("CUSTOMER");
  const [condition, setCondition] = useState<"GOOD" | "DAMAGED">("GOOD");
  const [reason, setReason] = useState("Size/fit issue");
  const save = useAction(() => api.post("/returns", { orderId, variantId: variantId || o?.items.find((i) => i.variantId)?.variantId, qty: Number(qty), type, condition, reason }), {
    success: condition === "GOOD" ? "Return logged — stock is back on the shelf" : "Return logged and written off", invalidate: ["returns", "orders", "stock"], onSuccess: onClose,
  });
  return (
    <Drawer open={!!orderId} onClose={onClose} title="Log a return" subtitle={o && <code>{o.channelOrderId}</code>}
      footer={<Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>Save return</Button>}>
      {o && (
        <div className="space-y-5">
          <Field label="Item"><Select value={variantId} onChange={(e) => setVariantId(e.target.value)}>{o.items.filter((i) => i.variantId).map((i) => <option key={i.variantId!} value={i.variantId!}>{i.emoji} {i.name} ({i.sku}) × {i.qty}</option>)}</Select></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Quantity"><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
            <Field label="Type"><Select value={type} onChange={(e) => setType(e.target.value)}><option value="CUSTOMER">Customer return</option><option value="RTO">RTO (not delivered)</option></Select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(["GOOD", "DAMAGED"] as const).map((c) => (
              <button key={c} onClick={() => setCondition(c)} className={cn("rounded-2xl border p-5 text-left transition", condition === c ? (c === "GOOD" ? "border-leaf/60 bg-leaf/10" : "border-sindoor/60 bg-sindoor/10") : "border-line/10 text-muted")}>
                <div className="text-2xl">{c === "GOOD" ? "✨" : "💔"}</div>
                <div className="mt-2 font-semibold">{c === "GOOD" ? "Good condition" : "Damaged"}</div>
                <div className="text-xs text-muted">{c === "GOOD" ? "Goes back into stock" : "Written off at cost"}</div>
              </button>
            ))}
          </div>
          <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </div>
      )}
    </Drawer>
  );
}

export default function ReturnsPage() {
  return <Suspense><ReturnsInner /></Suspense>;
}
