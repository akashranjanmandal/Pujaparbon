"use client";
import { ProductGlyph } from "@/components/ui/ProductGlyph";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Download, FileUp, GripVertical, KanbanSquare, List, MapPin, PackageOpen, Search, Truck, Undo2, Upload } from "lucide-react";
import { CHANNELS, IMPORTABLE_CHANNELS, ORDER_FLOW, type OrderStatus } from "@pp/shared";
import { Drawer } from "@/components/ui/Drawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table } from "@/components/ui/Table";
import { Badge, Button, Card, ChannelDot, Empty, Field, Input, Segmented, Select, StatusBadge } from "@/components/ui/primitives";
import { api, download } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { compactINR, fmtDateTime, formatINR, timeAgo } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import type { Channel } from "@/lib/types";

interface Order {
  id: string; channelOrderId: string; customerName: string; city: string | null; state: string | null; status: OrderStatus; orderedAt: string;
  dispatchBy: string | null; dispatchedAt: string | null; awb: string | null; totalPaise: number; feesPaise: number; settledPaise: number | null;
  channel: Channel; units: number; unmapped: number; firstItem: string | null; emoji: string | null;
}
interface OrderList { items: Order[]; total: number; statusCounts: Record<string, number> }
interface OrderDetail extends Omit<Order, "units" | "unmapped" | "firstItem" | "emoji"> {
  items: { id: string; variantId: string | null; channelSku: string; qty: number; pricePaise: number; sku: string | null; name: string | null; emoji: string | null; size: string | null }[];
  returns: { id: string; qty: number; condition: string; status: string; reason: string }[];
}

const BOARD: { status: OrderStatus; title: string }[] = [
  { status: "NEW", title: "New" },
  { status: "PICKED", title: "Picked" },
  { status: "PACKED", title: "Packed" },
  { status: "DISPATCHED", title: "Dispatched" },
];
const NEXT_LABEL: Partial<Record<OrderStatus, string>> = { NEW: "Mark picked", PICKED: "Mark packed", PACKED: "Dispatch", DISPATCHED: "Mark delivered" };

function OrdersInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { can } = useAuth();
  const [view, setView] = useState<"board" | "list">(params.get("status") ? "list" : "board");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [channel, setChannel] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(params.get("open"));
  const [importOpen, setImportOpen] = useState(params.get("import") === "1");

  const qs = new URLSearchParams({ page: String(page), pageSize: view === "board" ? "200" : "25" });
  if (view === "board") qs.set("status", "NEW,PICKED,PACKED,DISPATCHED");
  else if (status) qs.set("status", status);
  if (channel) qs.set("channel", channel);
  if (search) qs.set("search", search);
  const { data, isLoading } = useQuery({ queryKey: ["orders", qs.toString()], queryFn: () => api.get<OrderList>(`/orders?${qs}`) });

  const move = useAction(({ id, status, awb }: { id: string; status: OrderStatus; awb?: string }) => api.patch(`/orders/${id}/status`, { status, awb }), {
    success: "Order updated",
    invalidate: ["orders", "order", "stock"],
  });
  const bulk = useAction(({ ids, status }: { ids: string[]; status: OrderStatus }) => api.post<{ updated: number; failed: { message: string }[] }>("/orders/bulk-status", { orderIds: ids, status }), {
    success: (r) => `${r.updated} moved${r.failed.length ? ` · ${r.failed.length} could not move: ${r.failed[0].message}` : ""}`,
    invalidate: ["orders", "stock"],
    onSuccess: () => setSelected(new Set()),
  });

  useEffect(() => setPage(1), [status, channel, search, view]);
  const counts = data?.statusCounts ?? {};

  return (
    <div>
      <PageHeader
       
        title="Orders & Dispatch"
        subtitle="Every marketplace in one queue. Stock leaves the shelf only when an order is dispatched."
        actions={
          <>
            <Segmented value={view} onChange={setView} options={[{ value: "board", label: <span className="flex items-center gap-1.5"><KanbanSquare className="h-3.5 w-3.5" />Board</span> }, { value: "list", label: <span className="flex items-center gap-1.5"><List className="h-3.5 w-3.5" />List</span> }]} />
            {can("orders.import") && <Button variant="primary" icon={<Upload className="h-4 w-4" />} onClick={() => setImportOpen(true)}>Import orders</Button>}
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input placeholder="Order ID, customer, AWB" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-44">
          <option value="">All channels</option>
          {CHANNELS.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </Select>
        {view === "list" && (
          <div className="flex flex-wrap gap-1.5">
            {["", "NEW", "PICKED", "PACKED", "DISPATCHED", "DELIVERED", "RETURNED", "CANCELLED"].map((s) => (
              <button key={s} onClick={() => setStatus(s)} className={cn("rounded-full border px-3 py-1.5 text-[14px] font-semibold transition", status === s ? "border-primary bg-primary-tint text-primary" : "border-line/10 text-muted hover:text-text")}>
                {s ? `${s.charAt(0)}${s.slice(1).toLowerCase()}` : "All"} {s && counts[s] ? <span className="ml-1 opacity-70">{counts[s]}</span> : null}
              </button>
            ))}
          </div>
        )}
      </div>

      {view === "board" ? (
        <Board orders={data?.items ?? []} loading={isLoading} onOpen={setOpenId} onMove={(id, s) => move.mutate({ id, status: s })} />
      ) : (
        <Card plain className="overflow-hidden">
          <AnimatePresence>
            {selected.size > 0 && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex items-center gap-3 border-b hairline bg-sindoor/[0.07] px-5 py-3 text-[15.5px]">
                <b>{selected.size} selected</b>
                <span className="text-muted">Move to</span>
                {(["PICKED", "PACKED", "DISPATCHED", "DELIVERED"] as OrderStatus[]).map((s) => (
                  <Button key={s} size="sm" variant="outline" loading={bulk.isPending} onClick={() => bulk.mutate({ ids: [...selected], status: s })}>{s.charAt(0) + s.slice(1).toLowerCase()}</Button>
                ))}
                <button className="ml-auto text-[14px] text-muted hover:text-text" onClick={() => setSelected(new Set())}>Clear</button>
              </motion.div>
            )}
          </AnimatePresence>
          <Table
            rows={data?.items}
            loading={isLoading}
            onRowClick={(o) => setOpenId(o.id)}
            selected={selected}
            onToggle={(id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; })}
            empty={<Empty icon={<PackageOpen />} title="No orders match" body="Try another status or channel, or import today's marketplace report." />}
            columns={[
              { key: "id", header: "Order", cell: (o) => <div><code className="text-[15px] font-semibold text-text">{o.channelOrderId}</code><div className="text-[14px] text-muted">{fmtDateTime(o.orderedAt)}</div></div> },
              { key: "ch", header: "Channel", cell: (o) => <ChannelDot color={o.channel.color} name={o.channel.name} /> },
              { key: "item", header: "Item", cell: (o) => <div className="flex items-center gap-2"><ProductGlyph name={o.firstItem ?? "?"} size={30} /><div><div className="max-w-[220px] truncate">{o.firstItem ?? "Unmapped SKU"}</div><div className="text-[14px] text-muted">{o.units} unit{o.units > 1 ? "s" : ""}{o.unmapped ? <span className="text-sindoor"> · {o.unmapped} not mapped</span> : ""}</div></div></div> },
              { key: "cust", header: "Customer", cell: (o) => <div><div>{o.customerName}</div><div className="text-[14px] text-muted">{[o.city, o.state].filter(Boolean).join(", ")}</div></div> },
              { key: "status", header: "Status", cell: (o) => <StatusBadge status={o.status} /> },
              { key: "total", header: "Value", align: "right", cell: (o) => <span className="font-semibold num">{formatINR(o.totalPaise, { decimals: false })}</span> },
            ]}
          />
          {data && data.total > 25 && (
            <div className="flex items-center justify-between border-t hairline px-5 py-3 text-[15.5px] text-muted">
              <span>{(page - 1) * 25 + 1}–{Math.min(page * 25, data.total)} of {data.total}</span>
              <div className="flex gap-2">
                <Button size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button size="sm" disabled={page * 25 >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <OrderDrawer id={openId} onClose={() => { setOpenId(null); if (params.get("open")) router.replace("/orders"); }} onMove={(id, s, awb) => move.mutateAsync({ id, status: s, awb })} moving={move.isPending} />
      <ImportDrawer open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

/* ── Kanban board ───────────────────────────────────────────────── */
function Board({ orders, loading, onOpen, onMove }: { orders: Order[]; loading: boolean; onOpen: (id: string) => void; onMove: (id: string, s: OrderStatus) => void }) {
  const [over, setOver] = useState<OrderStatus | null>(null);
  const [drag, setDrag] = useState<Order | null>(null);
  const cols = useMemo(() => BOARD.map((b) => ({ ...b, items: orders.filter((o) => o.status === b.status) })), [orders]);
  const allowed = (target: OrderStatus) => !!drag && ORDER_FLOW[drag.status].includes(target);

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-4">
      {cols.map((col, ci) => (
        <motion.div
          key={col.status}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: ci * 0.08 }}
          onDragOver={(e) => { if (allowed(col.status)) { e.preventDefault(); setOver(col.status); } }}
          onDragLeave={() => setOver(null)}
          onDrop={() => { if (drag && allowed(col.status)) onMove(drag.id, col.status); setOver(null); setDrag(null); }}
          className={cn("paar-card flex max-h-[72vh] min-h-[300px] w-[84vw] shrink-0 snap-center flex-col transition-all md:w-auto", over === col.status && "scale-[1.01] border-primary shadow-glow", drag && !allowed(col.status) && drag.status !== col.status && "opacity-50")}
        >
          <header className="flex items-center justify-between px-4 pb-3 pt-5">
            <div>
              <div className="text-[15px] font-semibold">{col.title}</div>
            </div>
            <span className="grid h-8 min-w-8 place-items-center rounded-full bg-panel2 px-2 text-[15.5px] font-semibold num">{col.items.length}</span>
          </header>
          <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
            {loading && Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton h-24" />)}
            {col.items.map((o) => {
              const late = o.dispatchBy && new Date(o.dispatchBy) < new Date() && ["NEW", "PICKED", "PACKED"].includes(o.status);
              return (
                <motion.div
                  layout
                  layoutId={o.id}
                  key={o.id}
                  draggable
                  onDragStartCapture={() => setDrag(o)}
                  onDragEndCapture={() => setDrag(null)}
                  onClick={() => onOpen(o.id)}
                  className={cn("group cursor-grab rounded-2xl border bg-bg2/80 p-3.5 transition hover:border-primary/30 active:cursor-grabbing", late ? "border-sindoor/50 shadow-[0_0_0_1px_rgb(var(--sindoor)/0.2)]" : "border-line/10")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <ChannelDot color={o.channel.color} name={o.channel.name} />
                    <GripVertical className="h-4 w-4 text-muted/40 group-hover:text-muted" />
                  </div>
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <ProductGlyph name={o.firstItem ?? "?"} size={34} />
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-medium">{o.firstItem ?? "Unmapped SKU"}</div>
                      <code className="text-[13.5px] text-muted">{o.channelOrderId}</code>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[14px]">
                    <span className="flex items-center gap-1 text-muted"><MapPin className="h-3 w-3" />{o.city ?? "—"}</span>
                    <span className="font-semibold num">{compactINR(o.totalPaise)}</span>
                  </div>
                  {late && <div className="mt-2 rounded-lg bg-sindoor/10 px-2 py-1 text-[13.5px] font-semibold text-sindoor">Dispatch was due {timeAgo(o.dispatchBy!)}</div>}
                  {o.unmapped > 0 && <div className="mt-2 rounded-lg bg-marigold/10 px-2 py-1 text-[13.5px] font-semibold text-marigold">SKU not mapped</div>}
                </motion.div>
              );
            })}
            {!loading && !col.items.length && <div className="grid h-24 place-items-center rounded-2xl border border-dashed border-line/15 text-[14px] text-muted">Drop here</div>}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ── Order detail ───────────────────────────────────────────────── */
function OrderDrawer({ id, onClose, onMove, moving }: { id: string | null; onClose: () => void; onMove: (id: string, s: OrderStatus, awb?: string) => Promise<unknown>; moving: boolean }) {
  const router = useRouter();
  const [awb, setAwb] = useState("");
  const { data: o } = useQuery({ queryKey: ["order", id], queryFn: () => api.get<OrderDetail>(`/orders/${id}`), enabled: !!id });
  const next = o ? ORDER_FLOW[o.status].find((s) => s !== "CANCELLED" && s !== "RETURNED") : undefined;
  const steps: OrderStatus[] = ["NEW", "PICKED", "PACKED", "DISPATCHED", "DELIVERED"];
  const at = o ? steps.indexOf(o.status) : -1;

  return (
    <Drawer
      open={!!id}
      onClose={onClose}
      title={o ? <code className="text-xl">{o.channelOrderId}</code> : "Order"}
      subtitle={o && <span className="flex items-center gap-3"><ChannelDot color={o.channel.color} name={o.channel.name} /> {fmtDateTime(o.orderedAt)}</span>}
      footer={
        o && (
          <>
            {["DISPATCHED", "DELIVERED"].includes(o.status) && <Button icon={<Undo2 className="h-4 w-4" />} onClick={() => router.push(`/returns?order=${o.id}`)}>Log return</Button>}
            {ORDER_FLOW[o.status].includes("CANCELLED") && <Button variant="danger" loading={moving} onClick={() => onMove(o.id, "CANCELLED")}>Cancel</Button>}
            {next && <Button variant="primary" loading={moving} icon={<Truck className="h-4 w-4" />} onClick={() => onMove(o.id, next, awb || undefined).then(() => setAwb(""))}>{NEXT_LABEL[o.status]}</Button>}
          </>
        )
      }
    >
      {!o ? (
        <div className="space-y-3">{Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton h-12" />)}</div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center">
            {steps.map((s, i) => (
              <div key={s} className="flex flex-1 items-center last:flex-none">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.08 }} className={cn("grid h-8 w-8 place-items-center rounded-full border text-[13.5px] font-bold", i <= at ? "border-primary bg-primary/20 text-primary shadow-diya" : "border-line/20 text-muted")}>{i + 1}</motion.div>
                {i < steps.length - 1 && <div className={cn("mx-1 h-0.5 flex-1 rounded", i < at ? "bg-primary" : "bg-line/10")} />}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[13.5px] text-muted">{steps.map((s) => <span key={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</span>)}</div>
          {["CANCELLED", "RETURNED"].includes(o.status) && <StatusBadge status={o.status} />}

          <div className="grid grid-cols-2 gap-4 rounded-2xl border border-line/10 bg-panel/50 p-4 text-[15.5px]">
            <div><div className="text-[14px] text-muted">Customer</div><div className="font-medium">{o.customerName}</div><div className="text-[14px] text-muted">{[o.city, o.state].filter(Boolean).join(", ")}</div></div>
            <div><div className="text-[14px] text-muted">Dispatch by</div><div className="font-medium">{o.dispatchBy ? fmtDateTime(o.dispatchBy) : "—"}</div>{o.awb && <div className="text-[14px] text-muted">AWB {o.awb}</div>}</div>
          </div>

          <div>
            <div className="mb-2 text-[14px] font-semibold text-muted">Items</div>
            <div className="space-y-2">
              {o.items.map((i) => (
                <div key={i.id} className="flex items-center gap-3 rounded-2xl border border-line/10 bg-bg2/60 p-3">
                  <ProductGlyph name={i.name ?? "?"} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15.5px] font-medium">{i.name ?? "Not mapped to a product"}{i.size ? ` · ${i.size}` : ""}</div>
                    <code className="text-[14px] text-muted">{i.sku ?? i.channelSku}</code>
                    {!i.variantId && <div className="mt-1 text-[14px] text-marigold">Add <code>{i.channelSku}</code> as a listing on the product to dispatch this order.</div>}
                  </div>
                  <div className="text-right text-[15.5px]"><div className="font-semibold num">{formatINR(i.pricePaise * i.qty, { decimals: false })}</div><div className="text-[14px] text-muted">× {i.qty}</div></div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 rounded-2xl border border-line/10 p-4 text-[15.5px]">
            <Row k="Order value" v={formatINR(o.totalPaise)} />
            <Row k="Marketplace fees" v={o.feesPaise ? `− ${formatINR(o.feesPaise)}` : "Not settled yet"} />
            <Row k="Settled" v={o.settledPaise != null ? formatINR(o.settledPaise) : "Pending"} strong />
          </div>

          {o.status === "PACKED" && (
            <Field label="AWB / tracking number" hint="Optional — printed on the courier label">
              <Input value={awb} onChange={(e) => setAwb(e.target.value)} placeholder="e.g. EK1234567890" />
            </Field>
          )}
          {o.returns.length > 0 && (
            <div>
              <div className="mb-2 text-[14px] font-semibold text-muted">Returns</div>
              {o.returns.map((r) => <div key={r.id} className="flex items-center justify-between rounded-xl bg-panel2/60 px-3 py-2 text-[15.5px]">{r.qty} × {r.reason}<StatusBadge status={r.status} /></div>)}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
const Row = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => (
  <div className="flex justify-between"><span className="text-muted">{k}</span><span className={cn("num", strong && "font-semibold text-primary")}>{v}</span></div>
);

/* ── Import ─────────────────────────────────────────────────────── */
interface ImportResult { imported: number; duplicates: number; issues: { row: number; message: string }[]; unmappedSkus: string[] }

function ImportDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [channel, setChannel] = useState("FLIPKART");
  const [file, setFile] = useState<File | null>(null);
  const [hover, setHover] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const run = useAction(() => {
    const f = new FormData();
    f.append("channel", channel);
    f.append("file", file!);
    return api.upload<ImportResult>("/orders/import", f);
  }, { invalidate: ["orders"], onSuccess: (r) => setResult(r), success: (r) => `${r.imported} new orders imported` });
  const close = () => { setFile(null); setResult(null); onClose(); };
  const ch = CHANNELS.find((c) => c.code === channel)!;

  return (
    <Drawer open={open} onClose={close} title="Import marketplace orders" subtitle="Download the orders report from the seller panel and drop it here. Duplicates are skipped automatically."
      footer={<><Button variant="ghost" onClick={close}>Close</Button><Button variant="primary" disabled={!file} loading={run.isPending} icon={<FileUp className="h-4 w-4" />} onClick={() => run.mutate(undefined)}>Import {ch.name} file</Button></>}>
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {CHANNELS.filter((c) => IMPORTABLE_CHANNELS.includes(c.code)).map((c) => (
            <button key={c.code} onClick={() => { setChannel(c.code); setResult(null); }} className={cn("rounded-2xl border px-2 py-3 text-[14px] font-semibold transition", channel === c.code ? "border-transparent text-white shadow-lift" : "border-line/15 text-muted hover:text-text")} style={channel === c.code ? { background: `linear-gradient(135deg, ${c.color}, ${c.color}aa)` } : undefined}>
              {c.name}
            </button>
          ))}
        </div>
        <label
          onDragOver={(e) => { e.preventDefault(); setHover(true); }}
          onDragLeave={() => setHover(false)}
          onDrop={(e) => { e.preventDefault(); setHover(false); setFile(e.dataTransfer.files[0] ?? null); setResult(null); }}
          className={cn("flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl2 border-2 border-dashed px-6 py-12 text-center transition", hover ? "border-primary bg-primary-tint" : "border-line/20 bg-panel/40 hover:border-primary")}
        >
          <motion.div animate={hover ? { y: -6, scale: 1.1 } : { y: 0, scale: 1 }} className="grid h-16 w-16 place-items-center rounded-2xl border border-line/10 bg-line/[0.04] text-sindoor"><Upload className="h-7 w-7" /></motion.div>
          <div className="text-[16px] font-semibold">{file ? file.name : "Drop the .csv or .xlsx report"}</div>
          <div className="text-[15.5px] text-muted">{file ? `${(file.size / 1024).toFixed(1)} KB · ready` : "or click to choose a file"}</div>
          <input type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
        </label>
        <button onClick={() => download(`/orders/import/sample/${channel}`, `${channel.toLowerCase()}-sample.csv`)} className="flex items-center gap-2 text-[15.5px] font-medium text-primary hover:underline">
          <Download className="h-4 w-4" /> Download a sample {ch.name} file
        </button>

        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Tile n={result.imported} label="New orders" tone="text-leaf" />
                <Tile n={result.duplicates} label="Already imported" tone="text-muted" />
                <Tile n={result.issues.length} label="Rows skipped" tone={result.issues.length ? "text-sindoor" : "text-muted"} />
              </div>
              {result.unmappedSkus.length > 0 && (
                <div className="rounded-2xl border border-marigold/30 bg-marigold/10 p-4 text-[15.5px]">
                  <b className="text-marigold">{result.unmappedSkus.length} SKU{result.unmappedSkus.length > 1 ? "s" : ""} not mapped yet.</b> Add them as listings on the matching product so dispatch can deduct stock:
                  <div className="mt-2 flex flex-wrap gap-1.5">{result.unmappedSkus.map((s) => <Badge key={s} tone="orange">{s}</Badge>)}</div>
                </div>
              )}
              {result.issues.slice(0, 6).map((i) => <div key={i.row} className="text-[14px] text-muted">Row {i.row}: {i.message}</div>)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Drawer>
  );
}
const Tile = ({ n, label, tone }: { n: number; label: string; tone: string }) => (
  <div className="rounded-2xl border border-line/10 bg-panel/50 p-4 text-center"><div className={cn("text-[22px] font-semibold tracking-tight", tone)}>{n}</div><div className="mt-1 text-[14px] text-muted">{label}</div></div>
);

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersInner />
    </Suspense>
  );
}
