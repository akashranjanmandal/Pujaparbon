"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR, previousRange } from "@pp/shared";
import { GlassTooltip, axis, moneyTick } from "@/components/charts/theme";
import { Loader } from "@/components/ui/Loader";
import { PageHeader } from "@/components/ui/PageHeader";
import { RangePicker, rangeFor, type RangeValue } from "@/components/ui/RangePicker";
import { Card, Select } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { monthShort, type Summary } from "@/lib/summary";
import { cn } from "@/lib/cn";
import { compactINR, fmtDate } from "@/lib/format";

const MONEY_OUT_COLORS = ["rgb(var(--primary))", "rgb(var(--lav))", "rgb(var(--peach))", "#0E7C66", "#C9A227", "#8E8FA1", "#2874F0", "#9F2089"];

export default function AnalyticsPage() {
  const [range, setRange] = useState<RangeValue>(rangeFor("month"));
  const [platformId, setPlatformId] = useState("");
  const { data: plats } = useQuery({ queryKey: ["platforms"], queryFn: () => api.get<{ id: string; name: string }[]>("/platforms") });
  const { data: s, isLoading } = useQuery({ queryKey: ["summary", "all", range.from, range.to, platformId], queryFn: () => api.get<Summary>(`/insights/summary?from=${range.from}&to=${range.to}${platformId ? `&platformId=${platformId}` : ""}`) });
  const prev = previousRange(range);
  const t = s?.totals;

  return (
    <div className="space-y-6">
      <PageHeader title="Profit & analytics" subtitle="Pick any week, month or dates. Everything below follows the period you choose." />
      <div className="flex flex-wrap items-center gap-3">
        <RangePicker value={range} onChange={setRange} presets={["week", "month", "lastMonth", "last90", "year"]} />
        <Select value={platformId} onChange={(e) => setPlatformId(e.target.value)} className="w-52"><option value="">All platforms</option>{plats?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
      </div>
      <p className="-mt-2 text-[14.5px] text-muted">{fmtDate(range.from, { day: "numeric", month: "short", year: "numeric" })} to {fmtDate(range.to, { day: "numeric", month: "short", year: "numeric" })}. Compared with {fmtDate(prev.from)} to {fmtDate(prev.to)}.</p>

      {isLoading || !s || !t ? <Loader label="Working it out" /> : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Hero label="Profit on items sold" value={t.profitPaise} change={s.compare.profitPct} days={s.compare.days} tone="bg-primary-soft" accent="text-primary" note="Received from platforms, minus what the items cost you, minus other investments." negative={t.profitPaise < 0} />
            <Hero label="Received from platforms" value={t.netPaise} change={s.compare.netPct} days={s.compare.days} tone="bg-lav-soft" accent="text-lav" note={`${t.orders} orders delivered${t.returnOrders ? `, ${t.returnOrders} returned` : ""}.`} />
            {platformId ? (
              <Hero label="Cost of items sold" value={t.cogsPaise} tone="bg-peach-soft" accent="text-peach" note="Based on your real cost per piece." />
            ) : (
              <Hero label="Money you put in" value={t.moneyOutPaise} change={s.compare.moneyOutPct} days={s.compare.days} tone="bg-peach-soft" accent="text-peach" note="Market buys, trip costs and other investments." invertChange />
            )}
          </div>

          <Card title="From sales to profit" subtitle="How the profit figure is made, step by step">
            <Walk rows={[
              { label: "Sold (before platform fees)", v: t.grossPaise, kind: "total" },
              { label: "Platform fees and commission", v: -t.feesPaise, kind: "less" },
              { label: "Received from platforms", v: t.netPaise, kind: "total" },
              { label: "Cost of the items you sold", v: -t.cogsPaise, kind: "less" },
              ...(platformId ? [] : [{ label: "Other investments (rent, equipment...)", v: -t.otherPaise, kind: "less" as const }]),
              { label: "Profit", v: t.profitPaise, kind: "result" },
            ]} />
            {!platformId && (
              <div className="border-t hairline px-6 py-4 text-[15px] text-muted">
                In cash terms you put in <b className="text-text">{formatINR(t.moneyOutPaise, { decimals: false })}</b> and received <b className="text-text">{formatINR(t.netPaise, { decimals: false })}</b>: <b className={cn(t.cashPaise < 0 ? "text-peach" : "text-leaf")}>{formatINR(t.cashPaise, { decimals: false })}</b>. This is lower than profit when you have bought stock that is not sold yet. It is still on your shelf.
              </div>
            )}
          </Card>

          {!platformId && (
            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
              <Card title="Money in and out, month by month">
                <div className="h-[300px] px-2 pb-4 pt-2">
                  <ResponsiveContainer>
                    <ComposedChart data={s.trend.map((x) => ({ ...x, label: monthShort(x.month) }))} margin={{ left: 4, right: 14, top: 8 }}>
                      <CartesianGrid stroke="rgb(var(--line) / 0.06)" vertical={false} />
                      <XAxis dataKey="label" {...axis} />
                      <YAxis {...axis} tickFormatter={moneyTick} width={56} />
                      <Tooltip content={<GlassTooltip />} cursor={{ fill: "rgb(var(--primary) / 0.06)" }} />
                      <Legend wrapperStyle={{ fontSize: 14 }} />
                      <Bar dataKey="moneyOutPaise" name="Put in" fill="rgb(var(--peach-soft))" radius={[8, 8, 0, 0]} barSize={22} />
                      <Bar dataKey="netPaise" name="Received" fill="rgb(var(--primary-soft))" radius={[8, 8, 0, 0]} barSize={22} />
                      <Line dataKey="profitPaise" name="Profit" stroke="rgb(var(--leaf))" strokeWidth={3} dot={{ r: 4 }} type="monotone" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card title="Where the money went" subtitle={`${formatINR(t.moneyOutPaise, { decimals: false })} in this period`}>
                <MoneyOut s={s} />
              </Card>
            </div>
          )}

          <Card title="Platforms" subtitle="Which ones are worth your time" plain className="overflow-hidden">
            <div className="divide-y divide-line/[0.06]">
              {s.platforms.map((p, i) => {
                const maxP = Math.max(1, ...s.platforms.map((x) => Math.abs(x.profitPaise)));
                return (
                  <div key={p.id} className="grid gap-3 px-6 py-4 md:grid-cols-[170px_1fr_120px_120px] md:items-center">
                    <div className="flex items-center gap-3 text-[16px] font-semibold"><span className="h-3 w-3 rounded-full" style={{ background: p.color }} />{p.name}</div>
                    <div className="h-3 overflow-hidden rounded-full bg-bg2"><motion.div className={cn("h-full rounded-full", p.profitPaise < 0 ? "bg-peach" : "bg-primary")} initial={{ width: 0 }} animate={{ width: `${(Math.abs(p.profitPaise) / maxP) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.08 }} /></div>
                    <div className="text-[15px]"><b>{compactINR(p.profitPaise)}</b> <span className="text-muted">profit</span></div>
                    <div className="text-[14px] text-muted">{p.orders} orders · {p.feePct}% fees</div>
                  </div>
                );
              })}
              {!s.platforms.length && <div className="px-6 py-8 text-center text-[15px] text-muted">No sales in this period. Upload a platform report to see this.</div>}
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <ProductList title="What earns you the most" rows={s.products.best} good />
            <ProductList title="What earns little or loses money" rows={s.products.worst} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Categories" subtitle="Received from platforms">
              <Bars rows={s.categories.map((c) => ({ label: c.category, value: c.netPaise, note: `${c.units} sold` }))} />
            </Card>
            <Card title="Where your customers are" subtitle="Received, by Indian state">
              <Bars rows={s.states.slice(0, 10).map((x) => ({ label: x.state, value: x.netPaise, note: `${x.orders} orders` }))} />
            </Card>
          </div>

          <Card title="Stock on hand right now">
            <div className="grid gap-4 p-6 sm:grid-cols-3">
              <div><div className="text-[14px] text-muted">At what it cost you</div><div className="display text-[30px]">{formatINR(s.stock.valuePaise, { decimals: false })}</div></div>
              <div><div className="text-[14px] text-muted">Pieces</div><div className="display text-[30px]">{s.stock.units.toLocaleString("en-IN")}</div></div>
              <div><div className="text-[14px] text-muted">Last bought</div><div className="display text-[30px]">{s.stock.lastBuyDate ? fmtDate(s.stock.lastBuyDate, { day: "numeric", month: "short" }) : "—"}</div></div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Hero({ label, value, change, days, tone, accent, note, negative, invertChange }: { label: string; value: number; change?: number; days?: number; tone: string; accent: string; note: string; negative?: boolean; invertChange?: boolean }) {
  const good = change === undefined ? true : invertChange ? change <= 0 : change >= 0;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("rounded-[26px] p-6", tone)}>
      <div className={cn("text-[15px] font-semibold", accent)}>{label}</div>
      <div className={cn("display mt-2 text-[44px] leading-none", negative && "text-sindoor")}>{formatINR(value, { decimals: false })}</div>
      {change !== undefined && <div className={cn("mt-3 inline-flex rounded-full bg-white/60 px-3 py-1 text-[14px] font-semibold", good ? "text-leaf" : "text-peach")}>{change >= 0 ? "↑" : "↓"} {Math.abs(change)}% vs the {days} days before</div>}
      <p className="mt-3 text-[14px] leading-snug text-text/60">{note}</p>
    </motion.div>
  );
}

function Walk({ rows }: { rows: { label: string; v: number; kind: "total" | "less" | "result" }[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.v)));
  return (
    <div className="divide-y divide-line/[0.06]">
      {rows.map((r) => (
        <div key={r.label} className={cn("grid items-center gap-3 px-6 py-3.5 md:grid-cols-[320px_1fr_150px]", r.kind === "result" && "bg-primary-tint/60")}>
          <div className={cn("text-[16px]", r.kind === "result" ? "font-semibold" : "text-text/80")}>{r.kind === "less" && <span className="mr-2 text-muted">less</span>}{r.label}</div>
          <div className="hidden h-2.5 overflow-hidden rounded-full bg-bg2 md:block"><motion.div className={cn("h-full rounded-full", r.kind === "less" ? "bg-peach-soft" : r.kind === "result" ? (r.v < 0 ? "bg-peach" : "bg-leaf") : "bg-primary-soft")} initial={{ width: 0 }} animate={{ width: `${(Math.abs(r.v) / max) * 100}%` }} transition={{ duration: 0.7 }} /></div>
          <div className={cn("text-right text-[17px] font-semibold", r.kind === "result" && (r.v < 0 ? "text-sindoor" : "text-leaf"))}>{formatINR(r.v, { decimals: false })}</div>
        </div>
      ))}
    </div>
  );
}

function MoneyOut({ s }: { s: Summary }) {
  const parts = [{ label: "Items bought", v: s.moneyOut.itemsPaise }, ...s.moneyOut.tripCosts.map((k) => ({ label: k.kind, v: k.amountPaise })), ...s.moneyOut.other.map((k) => ({ label: k.category, v: k.amountPaise }))].filter((p) => p.v > 0);
  const total = parts.reduce((a, p) => a + p.v, 0) || 1;
  return (
    <div className="p-6">
      <div className="flex h-4 gap-0.5 overflow-hidden rounded-full">{parts.map((p, i) => <motion.div key={p.label} style={{ background: MONEY_OUT_COLORS[i % MONEY_OUT_COLORS.length] }} initial={{ width: 0 }} animate={{ width: `${(p.v / total) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.05 }} />)}</div>
      <div className="mt-5 divide-y divide-line/[0.06]">
        {parts.map((p, i) => (
          <div key={p.label} className="flex items-center gap-3 py-2.5 text-[15.5px]">
            <span className="h-3 w-3 rounded-full" style={{ background: MONEY_OUT_COLORS[i % MONEY_OUT_COLORS.length] }} />
            <span className="flex-1">{p.label}</span><span className="font-semibold">{formatINR(p.v, { decimals: false })}</span><span className="w-12 text-right text-muted">{Math.round((p.v / total) * 100)}%</span>
          </div>
        ))}
        {!parts.length && <div className="py-6 text-center text-[15px] text-muted">Nothing bought in this period.</div>}
      </div>
    </div>
  );
}

function ProductList({ title, rows, good }: { title: string; rows: Summary["products"]["best"]; good?: boolean }) {
  return (
    <Card title={title} subtitle="By profit after the real cost of each item">
      <div className="px-3 pb-3">
        {rows.map((r, i) => (
          <div key={r.name + i} className="flex items-center gap-3 rounded-xl px-3 py-3">
            <span className="display w-6 text-[20px] text-muted">{i + 1}</span>
            <div className="min-w-0 flex-1"><div className="truncate text-[15.5px] font-semibold">{r.name}</div><div className="text-[13.5px] text-muted">{r.units} sold · {r.category ?? "Not matched yet"}</div></div>
            <div className="text-right"><div className={cn("text-[16px] font-semibold", r.profitPaise < 0 ? "text-sindoor" : good && "text-leaf")}>{formatINR(r.profitPaise, { decimals: false })}</div><div className="text-[13px] text-muted">{r.marginPct}% over cost</div></div>
          </div>
        ))}
        {!rows.length && <div className="px-3 py-8 text-center text-[15px] text-muted">{good ? "No sales in this period." : "Nothing is losing money."}</div>}
      </div>
    </Card>
  );
}

function Bars({ rows }: { rows: { label: string; value: number; note?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-3 p-6">
      {rows.map((r, i) => (
        <div key={r.label} className="grid grid-cols-[130px_1fr_90px] items-center gap-3 text-[15px]">
          <span className="truncate">{r.label}</span>
          <div className="h-5 overflow-hidden rounded-lg bg-bg2"><motion.div className="h-full rounded-lg bg-primary-soft" initial={{ width: 0 }} animate={{ width: `${(r.value / max) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.05 }} /></div>
          <span className="text-right font-semibold">{compactINR(r.value)}</span>
        </div>
      ))}
      {!rows.length && <div className="py-6 text-center text-[15px] text-muted">No data in this period.</div>}
    </div>
  );
}

