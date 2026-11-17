"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { Barcode, Package, Plus, Search } from "lucide-react";
import { CHANNELS } from "@pp/shared";
import { ProductEditor, type ProductRow } from "@/components/ProductEditor";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, Button, Empty, Input } from "@/components/ui/primitives";
import { openFile } from "@/lib/api";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/format";

export default function ProductsPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [creating, setCreating] = useState(false);
  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  if (cat) qs.set("category", cat);
  const { data, isLoading } = useQuery({ queryKey: ["products", qs.toString()], queryFn: () => api.get<{ items: ProductRow[]; categories: string[] }>(`/products?${qs}`) });

  return (
    <div>
      <PageHeader bn="পণ্য তালিকা" title="Products & SKUs" subtitle="Your catalogue, with every marketplace listing mapped to one internal SKU."
        actions={
          <>
            <Button icon={<Barcode className="h-4 w-4" />} onClick={() => data && openFile("/products/labels", { variantIds: data.items.flatMap((p) => p.variants.map((v) => v.id)), copies: 1 })}>Print all labels</Button>
            {can("products.manage") && <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>New product</Button>}
          </>
        } />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input placeholder="Name or SKU" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {["", ...(data?.categories ?? [])].map((c) => (
          <button key={c} onClick={() => setCat(c)} className={cn("rounded-full border px-3.5 py-1.5 text-xs font-semibold transition", cat === c ? "border-gold/50 bg-gold/15 text-gold" : "border-line/10 text-muted hover:text-text")}>{c || "All"}</button>
        ))}
      </div>

      {isLoading && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-64" />)}</div>}
      {data && !data.items.length && <Empty icon={<Package />} title="No products yet" body="Add your first saree, panjabi or puja item." />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data?.items.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.5) }} whileHover={{ y: -4 }}>
            <Link href={`/products/${p.id}`} className="paar-card group block h-full p-5 transition-shadow hover:shadow-glow">
              <div className="flex items-start justify-between">
                <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-sindoor/25 via-panel2 to-gold/15 text-4xl">
                  <span className="transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6">{p.emoji}</span>
                </div>
                {p.lowStock ? <Badge tone="gold" dot>Low stock</Badge> : <Badge tone="green" dot>In stock</Badge>}
              </div>
              <div className="mt-4 text-xs font-medium uppercase tracking-[0.12em] text-gold/80">{p.category}</div>
              <div className="mt-1 font-display text-lg font-semibold leading-snug">{p.name}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-lg font-semibold num">{formatINR(p.minPricePaise, { decimals: false })}</span>
                {p.maxPricePaise !== p.minPricePaise && <span className="text-sm text-muted">– {formatINR(p.maxPricePaise, { decimals: false })}</span>}
              </div>
              <div className="mt-4 flex items-center justify-between border-t hairline pt-3 text-xs text-muted">
                <span>{p.variants.length} variant{p.variants.length > 1 ? "s" : ""} · <b className="text-text">{p.onHand}</b> on hand</span>
                <span className="flex -space-x-1">
                  {p.channels.map((c) => {
                    const ch = CHANNELS.find((x) => x.code === c);
                    return <span key={c} title={ch?.name} className="h-4 w-4 rounded-full ring-2 ring-panel" style={{ background: ch?.color }} />;
                  })}
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
      {creating && <ProductEditor open={creating} onClose={() => setCreating(false)} categories={data?.categories ?? []} />}
    </div>
  );
}
