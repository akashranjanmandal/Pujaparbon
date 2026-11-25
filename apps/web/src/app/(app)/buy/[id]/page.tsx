"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { formatINR } from "@pp/shared";
import { Loader } from "@/components/ui/Loader";
import { Table } from "@/components/ui/Table";
import { Badge, Button, Card, ProductGlyphRow } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtDate } from "@/lib/format";
import { useAction } from "@/lib/hooks";

interface Trip {
  id: string; code: string; date: string; title: string | null; place: string | null; notes: string | null; basis: "VALUE" | "QTY"; itemsPaise: number; costsPaise: number; totalPaise: number;
  expectedSalesPaise: number; expectedProfitPaise: number; expectedMarginPct: number;
  items: { id: string; productId: string; name: string; category: string; qty: number; linePaise: number; extraPaise: number; landedPaise: number; unitCostPaise: number; unitPricePaise: number; pct: number; onHand: number }[];
  costs: { id: string; kind: string; label: string | null; amountPaise: number; paidBy: string | null }[];
}

export default function BuyDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: t } = useQuery({ queryKey: ["trip", id], queryFn: () => api.get<Trip>(`/trips/${id}`) });
  const remove = useAction(() => api.del(`/trips/${t!.id}`), { success: "Buy deleted and its stock taken back out", invalidate: ["trips", "products"], onSuccess: () => router.push("/buy") });
  if (!t) return <Loader />;
  return (
    <div className="space-y-6">
      <button onClick={() => router.push("/buy")} className="flex items-center gap-2 text-[15px] text-muted hover:text-text"><ArrowLeft className="h-4 w-4" /> Buy history</button>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="eyebrow">{fmtDate(t.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
          <h1 className="display mt-1 text-[36px] leading-tight">{t.place || t.title || "Buying trip"}</h1>
          {t.notes && <p className="mt-2 max-w-xl text-[16px] text-muted">{t.notes}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => confirm("Delete this buy? Its stock will be taken back out.") && remove.mutate(undefined)}>Delete</Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Paid for the items" value={formatINR(t.itemsPaise, { decimals: false })} tone="bg-lav-soft text-lav" />
        <Tile label="Trip costs" value={formatINR(t.costsPaise, { decimals: false })} tone="bg-peach-soft text-peach" />
        <Tile label="Total put in" value={formatINR(t.totalPaise, { decimals: false })} tone="bg-primary-soft text-primary" />
        <Tile label="Expected profit" value={formatINR(t.expectedProfitPaise, { decimals: false })} sub={t.expectedSalesPaise ? `${t.expectedMarginPct}% on ${formatINR(t.expectedSalesPaise, { decimals: false })}, before fees` : "Set prices to see this"} tone="bg-panel text-leaf" />
      </div>

      <Card title="What you bought" subtitle={`Trip costs were shared ${t.basis === "VALUE" ? "by money paid" : "by pieces"}.`} plain className="overflow-hidden">
        <Table rows={t.items} columns={[
          { key: "name", header: "Item", cell: (i) => <Link href={`/products/${i.productId}`}><ProductGlyphRow name={i.name} sub={i.category} /></Link> },
          { key: "qty", header: "Pieces", align: "right", cell: (i) => i.qty.toLocaleString("en-IN") },
          { key: "paid", header: "Paid", align: "right", cell: (i) => formatINR(i.linePaise, { decimals: false }) },
          { key: "extra", header: "Trip share", align: "right", cell: (i) => `+ ${formatINR(i.extraPaise, { decimals: false })}` },
          { key: "unit", header: "Real cost each", align: "right", cell: (i) => <b>{formatINR(i.unitCostPaise)}</b> },
          { key: "price", header: "Your price", align: "right", cell: (i) => (i.unitPricePaise ? <span><b>{formatINR(i.unitPricePaise)}</b> <Badge tone={i.pct >= 0 ? "green" : "orange"}>{i.pct >= 0 ? "+" : ""}{i.pct}%</Badge></span> : <span className="text-muted">Not set</span>) },
          { key: "stock", header: "In stock now", align: "right", cell: (i) => <span className={cn(i.onHand === 0 && "text-sindoor")}>{i.onHand.toLocaleString("en-IN")}</span> },
        ]} />
      </Card>

      <Card title="What the trip cost" plain className="overflow-hidden">
        <Table rows={t.costs} empty={<div className="px-6 py-8 text-center text-[15px] text-muted">No trip costs were recorded.</div>} columns={[
          { key: "kind", header: "Type", cell: (c) => <b>{c.kind}</b> },
          { key: "label", header: "Note", cell: (c) => <span className="text-muted">{c.label ?? "—"}</span> },
          { key: "by", header: "Paid by", cell: (c) => <span className="text-muted">{c.paidBy ?? "—"}</span> },
          { key: "amt", header: "Amount", align: "right", cell: (c) => formatINR(c.amountPaise, { decimals: false }) },
        ]} />
      </Card>
    </div>
  );
}

const Tile = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) => (
  <div className={`rounded-2xl p-5 ${tone}`}><div className="text-[14px] font-semibold">{label}</div><div className="display mt-1 text-[30px] leading-none text-text">{value}</div>{sub && <div className="mt-2 text-[13.5px] text-text/60">{sub}</div>}</div>
);
