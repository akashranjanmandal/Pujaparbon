"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Barcode, Pencil, Trash2 } from "lucide-react";
import { CHANNELS } from "@pp/shared";
import { Loader } from "@/components/ui/Loader";
import { ProductEditor, type ProductRow } from "@/components/ProductEditor";
import { ProductGlyph } from "@/components/ui/ProductGlyph";
import { Table } from "@/components/ui/Table";
import { Badge, Button, Card, ChannelDot } from "@/components/ui/primitives";
import { api, openFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDateTime, formatINR } from "@/lib/format";
import { useAction } from "@/lib/hooks";

interface Move { id: string; qty: number; type: string; reason: string | null; createdAt: string; sku: string; bin: string | null; by: string | null }

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);
  const { data: p } = useQuery({ queryKey: ["product", id], queryFn: () => api.get<ProductRow>(`/products/${id}`) });
  const { data: cats } = useQuery({ queryKey: ["products", ""], queryFn: () => api.get<{ categories: string[] }>("/products") });
  const { data: moves } = useQuery({ queryKey: ["stock", "ledger", p?.variants[0]?.id], queryFn: () => Promise.all(p!.variants.map((v) => api.get<Move[]>(`/stock/ledger?variantId=${v.id}&limit=20`))).then((r) => r.flat().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 25)), enabled: !!p });
  const remove = useAction(() => api.del(`/products/${id}`), { success: "Product archived", invalidate: ["products"], onSuccess: () => router.push("/products") });
  if (!p) return <Loader />;
  const margin = (v: ProductRow["variants"][number]) => Math.round(((v.pricePaise - v.costPaise) / v.pricePaise) * 100);

  return (
    <div className="space-y-6">
      <button onClick={() => router.push("/products")} className="flex items-center gap-2 text-sm text-muted hover:text-text"><ArrowLeft className="h-4 w-4" /> All products</button>
      <Card className="relative overflow-hidden p-6">
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <ProductGlyph name={p.name} size={88} className="rounded-2xl" />
          <div className="flex-1">
            <div className="label">{p.category} · HSN {p.hsnCode} · GST {p.gstRate}%</div>
            <h1 className="mt-1 text-[26px] font-semibold tracking-tight">{p.name}</h1>
            {p.description && <p className="mt-2 max-w-2xl text-sm text-muted">{p.description}</p>}
          </div>
          <div className="flex gap-2">
            <Button icon={<Barcode className="h-4 w-4" />} onClick={() => openFile("/products/labels", { variantIds: p.variants.map((v) => v.id), copies: 3 })}>Labels</Button>
            {can("products.manage") && <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>Edit</Button>}
            {can("products.manage") && <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => confirm("Archive this product? Its history stays.") && remove.mutate(undefined)} />}
          </div>
        </div>
      </Card>

      <Card title="Variants and marketplace listings" plain>
        <Table rows={p.variants} columns={[
          { key: "sku", header: "SKU", cell: (v) => <div><code className="font-semibold">{v.sku}</code><div className="text-xs text-muted">{[v.size, v.color].filter(Boolean).join(" · ") || "Standard"}</div></div> },
          { key: "price", header: "Price / MRP", cell: (v) => <div className="num"><b>{formatINR(v.pricePaise, { decimals: false })}</b> <span className="text-xs text-muted line-through">{formatINR(v.mrpPaise, { decimals: false })}</span></div> },
          { key: "margin", header: "Margin", cell: (v) => <Badge tone={margin(v) > 40 ? "green" : "gold"}>{margin(v)}%</Badge> },
          { key: "stock", header: "On hand", align: "right", cell: (v) => <span className={v.onHand <= v.reorderLevel ? "font-semibold text-marigold" : "font-semibold"}>{v.onHand}</span> },
          { key: "list", header: "Listed on", cell: (v) => <div className="flex flex-wrap gap-x-3 gap-y-1">{v.listings.map((l) => <span key={l.code} title={`${l.channelSku}${l.listingId ? ` · ${l.listingId}` : ""}`}><ChannelDot color={CHANNELS.find((c) => c.code === l.code)?.color ?? "#999"} name={l.channelSku} /></span>)}</div> },
        ]} />
      </Card>

      <Card title="Stock history" subtitle="Every unit in and out, newest first" plain>
        <Table rows={moves} loading={!moves} columns={[
          { key: "when", header: "When", cell: (m) => <span className="text-muted">{fmtDateTime(m.createdAt)}</span> },
          { key: "sku", header: "SKU", cell: (m) => <code>{m.sku}</code> },
          { key: "type", header: "Type", cell: (m) => <Badge tone={m.qty > 0 ? "green" : "red"}>{m.type.toLowerCase()}</Badge> },
          { key: "qty", header: "Qty", align: "right", cell: (m) => <b className={m.qty > 0 ? "text-leaf" : "text-sindoor"}>{m.qty > 0 ? `+${m.qty}` : m.qty}</b> },
          { key: "reason", header: "Reason", cell: (m) => <span className="text-muted">{m.reason}</span> },
        ]} />
      </Card>
      {editing && <ProductEditor open product={p} onClose={() => setEditing(false)} categories={cats?.categories ?? []} />}
    </div>
  );
}
