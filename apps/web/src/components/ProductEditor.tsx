"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { CHANNELS, GST_RATES, toPaise } from "@pp/shared";
import { Drawer } from "@/components/ui/Drawer";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { useAction } from "@/lib/hooks";

export interface ProductRow {
  id: string; name: string; category: string; description: string | null; hsnCode: string; gstRate: number; emoji: string | null;
  variants: { id: string; sku: string; size: string | null; color: string | null; mrpPaise: number; pricePaise: number; costPaise: number; reorderLevel: number; onHand: number; committed: number; listings: { code: string; channelSku: string; listingId: string | null }[] }[];
  onHand: number; minPricePaise: number; maxPricePaise: number; channels: string[]; lowStock: boolean;
}

interface VForm { id?: string; sku: string; size: string; color: string; mrp: string; price: string; cost: string; reorderLevel: string; listings: { channel: string; channelSku: string; listingId: string }[] }
const blankV = (): VForm => ({ sku: "", size: "", color: "", mrp: "", price: "", cost: "", reorderLevel: "5", listings: [] });

export function ProductEditor({ product, open, onClose, categories }: { product?: ProductRow | null; open: boolean; onClose: () => void; categories: string[] }) {
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [hsn, setHsn] = useState(product?.hsnCode ?? "");
  const [gst, setGst] = useState(String(product?.gstRate ?? 5));
  const [desc, setDesc] = useState(product?.description ?? "");
  const [vars, setVars] = useState<VForm[]>(
    product?.variants.map((v) => ({
      id: v.id, sku: v.sku, size: v.size ?? "", color: v.color ?? "", mrp: String(v.mrpPaise / 100), price: String(v.pricePaise / 100), cost: String(v.costPaise / 100),
      reorderLevel: String(v.reorderLevel), listings: v.listings.map((l) => ({ channel: l.code, channelSku: l.channelSku, listingId: l.listingId ?? "" })),
    })) ?? [blankV()],
  );
  const setV = (i: number, patch: Partial<VForm>) => setVars((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  const save = useAction(
    () => {
      const body = {
        name, category, hsnCode: hsn, gstRate: Number(gst), description: desc,
        variants: vars.map((v) => ({
          id: v.id, sku: v.sku, size: v.size, color: v.color, mrpPaise: toPaise(v.mrp || 0), pricePaise: toPaise(v.price || 0), costPaise: toPaise(v.cost || 0),
          reorderLevel: Number(v.reorderLevel || 0), listings: v.listings.filter((l) => l.channelSku).map((l) => ({ ...l, listingId: l.listingId || undefined })),
        })),
      };
      return product ? api.put(`/products/${product.id}`, body) : api.post("/products", body);
    },
    { success: product ? "Product saved" : "Product added to the catalogue", invalidate: ["products", "product", "stock"], onSuccess: onClose },
  );

  return (
    <Drawer open={open} onClose={onClose} wide title={product ? "Edit product" : "New product"} subtitle="One product, many variants. Each variant can be listed on every marketplace under its own SKU."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>Save product</Button></>}>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product name" className="sm:col-span-2"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cotton Crew T-Shirt" /></Field>
          <Field label="Category" hint="Pick an existing one or type a new category — it is created automatically">
            <Input list="cats" placeholder="e.g. Apparel" value={category} onChange={(e) => setCategory(e.target.value)} />
            <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="HSN code"><Input value={hsn} onChange={(e) => setHsn(e.target.value)} placeholder="5208" /></Field>
            <Field label="GST rate"><Select value={gst} onChange={(e) => setGst(e.target.value)}>{GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</Select></Field>
          </div>
          <Field label="Description" className="sm:col-span-2"><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[15px] font-semibold">Variants</div>
            <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setVars((v) => [...v, blankV()])}>Add variant</Button>
          </div>
          {vars.map((v, i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-line/10 bg-bg2/60 p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Our SKU"><Input value={v.sku} onChange={(e) => setV(i, { sku: e.target.value.toUpperCase() })} placeholder="PP-TSHIRT-BLK-M" /></Field>
                <Field label="Size"><Input value={v.size} onChange={(e) => setV(i, { size: e.target.value })} /></Field>
                <Field label="Colour"><Input value={v.color} onChange={(e) => setV(i, { color: e.target.value })} /></Field>
                <Field label="Reorder at"><Input type="number" value={v.reorderLevel} onChange={(e) => setV(i, { reorderLevel: e.target.value })} /></Field>
                <Field label="MRP ₹"><Input type="number" value={v.mrp} onChange={(e) => setV(i, { mrp: e.target.value })} /></Field>
                <Field label="Selling price ₹"><Input type="number" value={v.price} onChange={(e) => setV(i, { price: e.target.value })} /></Field>
                <Field label="Cost price ₹"><Input type="number" value={v.cost} onChange={(e) => setV(i, { cost: e.target.value })} /></Field>
                <div className="flex items-end">
                  {vars.length > 1 && <Button variant="danger" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setVars((vs) => vs.filter((_, j) => j !== i))}>Remove</Button>}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-[14px] font-semibold text-muted">Marketplace listings</div>
                {v.listings.map((l, li) => {
                  const ch = CHANNELS.find((c) => c.code === l.channel);
                  return (
                    <div key={li} className="grid grid-cols-[130px_1fr_1fr_auto] items-center gap-2">
                      <Select value={l.channel} onChange={(e) => setV(i, { listings: v.listings.map((x, k) => (k === li ? { ...x, channel: e.target.value } : x)) })}>
                        {CHANNELS.filter((c) => !["OFFLINE", "OWN_STORE"].includes(c.code)).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </Select>
                      <Input placeholder="Seller SKU on marketplace" value={l.channelSku} onChange={(e) => setV(i, { listings: v.listings.map((x, k) => (k === li ? { ...x, channelSku: e.target.value } : x)) })} />
                      <Input placeholder={ch?.listingLabel ?? "Listing ID"} value={l.listingId} onChange={(e) => setV(i, { listings: v.listings.map((x, k) => (k === li ? { ...x, listingId: e.target.value } : x)) })} />
                      <button className="p-2 text-muted hover:text-sindoor" onClick={() => setV(i, { listings: v.listings.filter((_, k) => k !== li) })}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  );
                })}
                <button className="text-[14px] font-semibold text-primary hover:underline" onClick={() => setV(i, { listings: [...v.listings, { channel: "FLIPKART", channelSku: "", listingId: "" }] })}>+ Map to a marketplace</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Drawer>
  );
}
