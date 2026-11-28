"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { formatINR } from "@pp/shared";
import { BusinessSelect } from "@/components/BusinessSelect";
import { Drawer } from "@/components/ui/Drawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { RangePicker, rangeFor, type RangeValue } from "@/components/ui/RangePicker";
import { Button, Card, Field, Input } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useActiveBusiness } from "@/lib/business";
import { todayKey } from "@/lib/format";
import { useAction, useBusinesses } from "@/lib/hooks";
import { paise } from "@/lib/money";

interface Row { fundNetPaise?: number; id: string | null; name: string; color: string; revenuePaise: number; refundsPaise: number; cogsPaise: number; lossesPaise: number; expensesPaise: number; salariesPaise: number; profitPaise: number; marginPct: number }
interface Res { businesses: Row[]; total: Omit<Row, "id" | "name" | "color"> }
const rs = (n: number) => formatINR(n, { decimals: false });

interface Gst { outputPaise: number; outputShopPaise: number; outputOnlinePaise: number; inputPaise: number; netPaise: number }
interface PlaceRow { id: string; name: string; kind: string; sales: number; revenuePaise: number; cogsPaise: number; lossesPaise: number; expensesPaise: number; profitPaise: number }

export default function AccountsPage() {
  const [range, setRange] = useState<RangeValue>(rangeFor("month"));
  const [moving, setMoving] = useState(false);
  const ab = useActiveBusiness();
  const { data: gst } = useQuery({ queryKey: ["accounts", "gst", range.from, range.to], queryFn: () => api.get<Gst>(`/accounts/gst?from=${range.from}&to=${range.to}`) });
  const { data: places } = useQuery({ queryKey: ["accounts", "places", range.from, range.to], queryFn: () => api.get<PlaceRow[]>(`/accounts/places?from=${range.from}&to=${range.to}`) });
  const { data } = useQuery({ queryKey: ["accounts", range.from, range.to], queryFn: () => api.get<Res>(`/accounts?from=${range.from}&to=${range.to}`) });
  const lines: [string, "revenuePaise" | "refundsPaise" | "cogsPaise" | "lossesPaise" | "expensesPaise" | "salariesPaise", boolean][] = [["Sales", "revenuePaise", false], ["Refunds", "refundsPaise", true], ["Cost of items sold", "cogsPaise", true], ["Losses (damaged, wasted)", "lossesPaise", true], ["Expenses", "expensesPaise", true], ["Salaries", "salariesPaise", true]];
  const Block = ({ r, title, color }: { r: Omit<Row, "id" | "name" | "color">; title: string; color?: string }) => (
    <Card title={<span className="flex items-center gap-2">{color && <span className="h-3 w-3 rounded-full" style={{ background: color }} />}{title}</span>}>
      <div className="space-y-2.5 p-5 text-[15.5px]">
        {lines.map(([label, key, minus]) => <div key={key} className="flex justify-between"><span className="text-muted">{label}</span><span>{minus && r[key] ? "− " : ""}{rs(r[key])}</span></div>)}
        <div className="flex items-baseline justify-between border-t border-line/10 pt-3"><span className="font-semibold">Profit</span><span className={cn("display text-[28px]", r.profitPaise < 0 ? "text-sindoor" : "text-leaf")}>{rs(r.profitPaise)} <span className="text-[14px] text-muted">{r.marginPct}%</span></span></div>
      </div>
    </Card>
  );
  return (
    <div>
      <PageHeader title="Business accounts" subtitle="Profit and loss for each business, and all of them together. Online sales come from your platform reports." />
      <RangePicker value={range} onChange={setRange} className="mb-6" />
      {moving && <MoveMoney onClose={() => setMoving(false)} />}
      {data && (
        <div className="space-y-6">
          {!ab.id && <Block r={data.total} title="All businesses together" />}
          {gst && (
            <Card title="GST" subtitle="Output GST on what you sold, input GST on what you bought with GST. Prices are taken as GST-inclusive.">
              <div className="grid gap-4 p-5 sm:grid-cols-3">
                <div><div className="text-[13.5px] text-muted">Output GST (collected)</div><div className="display text-[26px]">{rs(gst.outputPaise)}</div><div className="text-[13px] text-muted">Shops {rs(gst.outputShopPaise)} · Online {rs(gst.outputOnlinePaise)}</div></div>
                <div><div className="text-[13.5px] text-muted">Input GST (paid on buys)</div><div className="display text-[26px]">{rs(gst.inputPaise)}</div></div>
                <div className={cn("rounded-xl p-3", gst.netPaise > 0 ? "bg-peach-soft" : "bg-leaf/10")}><div className="text-[13.5px] text-muted">{gst.netPaise > 0 ? "GST to pay" : "GST credit"}</div><div className="display text-[26px]">{rs(Math.abs(gst.netPaise))}</div></div>
              </div>
            </Card>
          )}
          <div className="grid gap-6 lg:grid-cols-2">{data.businesses.filter((b) => !ab.id || b.id === ab.id).map((b) => <Block key={b.id ?? "none"} r={b} title={b.name} color={b.color} />)}</div>
          <Card title="Money moved between businesses" action={<Button size="sm" onClick={() => setMoving(true)}>Move money</Button>}>
            <div className="grid gap-2 p-5 text-[15px] sm:grid-cols-2">
              {data.businesses.filter((b) => b.fundNetPaise).map((b) => <div key={b.id ?? "x"} className="flex justify-between"><span>{b.name}</span><b className={(b.fundNetPaise ?? 0) > 0 ? "text-leaf" : "text-peach"}>{(b.fundNetPaise ?? 0) > 0 ? "received " : "gave "}{rs(Math.abs(b.fundNetPaise ?? 0))}</b></div>)}
              {!data.businesses.some((b) => b.fundNetPaise) && <p className="text-muted">No transfers in this period.</p>}
            </div>
          </Card>
          {places && places.length > 0 && (
            <Card title="Each place and fair" subtitle="Sales, cost, losses and the costs you tagged to it, such as stall rent." plain className="overflow-hidden">
              <div className="divide-y divide-line/[0.06]">
                {places.map((p) => <div key={p.id} className="grid grid-cols-2 gap-2 px-6 py-3 text-[15px] md:grid-cols-[1fr_repeat(4,110px)] md:items-center"><b>{p.name}</b><span className="text-muted">Sales {rs(p.revenuePaise)}</span><span className="text-muted">Cost {rs(p.cogsPaise)}</span><span className="text-muted">Expenses {rs(p.expensesPaise)}</span><b className={p.profitPaise < 0 ? "text-sindoor" : "text-leaf"}>{rs(p.profitPaise)}</b></div>)}
              </div>
            </Card>
          )}
          <p className="text-[13.5px] text-muted">Profit = sales − refunds − cost of items sold − losses − expenses. A day's total entered without items has no cost, so its profit looks higher until you list the items.</p>
        </div>
      )}
    </div>
  );
}

function MoveMoney({ onClose }: { onClose: () => void }) {
  const { data: biz } = useBusinesses();
  const [f, setF] = useState({ from: "", to: "", amount: "", date: todayKey(), note: "" });
  const save = useAction(() => api.post("/accounts/transfers", { date: f.date, fromBusinessId: f.from, toBusinessId: f.to, amountPaise: paise(f.amount), note: f.note || undefined }), { success: "Saved", invalidate: ["accounts"], onSuccess: onClose });
  return (
    <Drawer open onClose={onClose} title="Move money between businesses" subtitle="Records money lent or shared from one business to another. It does not change profit."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={!f.from || !f.to || f.from === f.to || !paise(f.amount)} onClick={() => save.mutate(undefined)}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="From"><BusinessSelect value={f.from} onChange={(v) => setF({ ...f, from: v })} list={biz} none="Choose…" /></Field>
        <Field label="To"><BusinessSelect value={f.to} onChange={(v) => setF({ ...f, to: v })} list={biz} none="Choose…" /></Field>
        <Field label="Amount (₹)"><Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Date"><Input type="date" value={f.date} max={todayKey()} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Note" hint="Optional" className="sm:col-span-2"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      </div>
    </Drawer>
  );
}
