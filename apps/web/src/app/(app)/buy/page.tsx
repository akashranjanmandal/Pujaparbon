"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Plus, ShoppingBasket } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { RangePicker, rangeFor, type RangeValue } from "@/components/ui/RangePicker";
import { Table } from "@/components/ui/Table";
import { Button, Card, Empty } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { compactINR, fmtDate, formatINR } from "@/lib/format";

interface Trip { id: string; code: string; date: string; title: string | null; place: string | null; itemsPaise: number; costsPaise: number; totalPaise: number; itemCount: number; units: number }
interface Res { items: Trip[]; totals: { trips: number; itemsPaise: number; costsPaise: number; totalPaise: number } }

export default function BuyHistory() {
  const [range, setRange] = useState<RangeValue>(rangeFor("last90"));
  const { data, isLoading } = useQuery({ queryKey: ["trips", range.from, range.to], queryFn: () => api.get<Res>(`/trips?from=${range.from}&to=${range.to}`) });
  const t = data?.totals;
  return (
    <div>
      <PageHeader title="Buy history" subtitle="Every market trip: what you paid for the items, and what the trip itself cost."
        actions={<Link href="/buy/new"><Button variant="primary" icon={<Plus className="h-4 w-4" />}>New buy</Button></Link>} />
      <RangePicker value={range} onChange={setRange} presets={["month", "lastMonth", "last90", "year"]} className="mb-6" />
      {t && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[["Trips", String(t.trips), "bg-primary-soft text-primary"], ["On items", compactINR(t.itemsPaise), "bg-lav-soft text-lav"], ["On trip costs", compactINR(t.costsPaise), "bg-peach-soft text-peach"], ["Total put in", compactINR(t.totalPaise), "bg-panel text-primary"]].map(([l, v, c]) => (
            <div key={l} className={`rounded-2xl p-5 ${c}`}><div className="text-[14px] font-semibold">{l}</div><div className="display mt-1 text-[32px] leading-none text-text">{v}</div></div>
          ))}
        </div>
      )}
      <Card plain className="overflow-hidden">
        <Table rows={data?.items} loading={isLoading} empty={<Empty icon={<ShoppingBasket />} title="No buys in this period" body="Record your next market trip to see it here." />}
          columns={[
            { key: "when", header: "Trip", cell: (r) => <Link href={`/buy/${r.id}`} className="block"><div className="font-semibold">{r.place || r.title || "Buying trip"}</div><div className="text-[14px] text-muted">{fmtDate(r.date, { day: "numeric", month: "short", year: "numeric" })}</div></Link> },
            { key: "items", header: "Items", cell: (r) => `${r.itemCount} items · ${r.units.toLocaleString("en-IN")} pcs` },
            { key: "paid", header: "Paid for items", align: "right", cell: (r) => formatINR(r.itemsPaise, { decimals: false }) },
            { key: "costs", header: "Trip costs", align: "right", cell: (r) => formatINR(r.costsPaise, { decimals: false }) },
            { key: "total", header: "Total", align: "right", cell: (r) => <b>{formatINR(r.totalPaise, { decimals: false })}</b> },
            { key: "code", header: "QR code", cell: (r) => <code className="text-[13px]">{r.code}</code> },
          ]} />
      </Card>
    </div>
  );
}
