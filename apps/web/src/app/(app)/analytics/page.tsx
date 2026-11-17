"use client";
import { ProductGlyph } from "@/components/ui/ProductGlyph";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader } from "@/components/ui/Loader";
import { Heatmap } from "@/components/charts/Heatmap";
import { GlassTooltip, axis, moneyTick, tok } from "@/components/charts/theme";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, Card } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { compactINR, fmtDate, formatINR } from "@/lib/format";

interface A {
  pnl: { month: string; revenue: number; returns: number; fees: number; cogs: number; expenses: number; payroll: number; grossProfit: number; netProfit: number }[];
  skuPerformance: { sku: string; name: string; emoji: string; units: number; paise: number; marginPaise: number; marginPct: number }[];
  deadStock: { sku: string; name: string; emoji: string; onHand: number; valuePaise: number; lastSaleAt: number | null }[];
  reorder: { sku: string; name: string; emoji: string; available: number; perDay: number; coverDays: number; suggestQty: number }[];
  states: { state: string; paise: number; n: number }[];
  heat: number[][];
}
const mLabel = (m: string) => new Date(`${m}-01`).toLocaleString("en-IN", { month: "short" });

export default function AnalyticsPage() {
  const { data: a } = useQuery({ queryKey: ["analytics"], queryFn: () => api.get<A>("/insights/analytics") });
  if (!a) return <Loader />;
  const pnl = a.pnl.map((p) => ({ ...p, label: mLabel(p.month), costs: p.cogs + p.fees + p.returns + p.expenses + p.payroll }));
  const last = a.pnl.at(-2) ?? a.pnl.at(-1)!;
  const topState = Math.max(1, ...a.states.map((s) => s.paise));
  const busiest = a.heat.flatMap((r, d) => r.map((n, h) => ({ d, h, n }))).sort((x, y) => y.n - x.n)[0];
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Where the money comes from, where it goes, and what to do next. Built only from your own data." />
      <Card title="Profit & loss" subtitle={`Last complete month (${mLabel(last.month)}): revenue ${compactINR(last.revenue)}, net profit ${compactINR(last.netProfit)} — a ${last.revenue ? Math.round((last.netProfit / last.revenue) * 100) : 0}% margin.`}>
        <div className="h-[340px] px-2 pb-4 pt-4">
          <ResponsiveContainer>
            <ComposedChart data={pnl} margin={{ left: 8, right: 16 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={tok("gold")} stopOpacity={0.9} /><stop offset="100%" stopColor={tok("gold")} stopOpacity={0.25} /></linearGradient>
                <linearGradient id="cost" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={tok("sindoor")} stopOpacity={0.75} /><stop offset="100%" stopColor={tok("sindoor")} stopOpacity={0.2} /></linearGradient>
              </defs>
              <CartesianGrid stroke="rgb(var(--line) / 0.07)" vertical={false} />
              <XAxis dataKey="label" {...axis} />
              <YAxis {...axis} tickFormatter={moneyTick} width={56} />
              <Tooltip content={<GlassTooltip />} cursor={{ fill: "rgb(var(--gold) / 0.05)" }} />
              <Legend wrapperStyle={{ fontSize: 12, color: "rgb(var(--muted))" }} />
              <Bar dataKey="revenue" name="Revenue" fill="url(#rev)" radius={[8, 8, 0, 0]} barSize={26} animationDuration={1400} />
              <Bar dataKey="costs" name="All costs" fill="url(#cost)" radius={[8, 8, 0, 0]} barSize={26} animationDuration={1400} />
              <Line dataKey="netProfit" name="Net profit" stroke={tok("leaf")} strokeWidth={3} dot={{ r: 4, fill: tok("leaf") }} type="monotone" animationDuration={2000} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="overflow-x-auto border-t hairline px-5 py-4">
          <table className="w-full min-w-[640px] text-[15.5px]">
            <thead><tr className="text-[14px] text-muted"><th className="text-left font-medium">₹</th>{pnl.map((p) => <th key={p.month} className="text-right font-medium">{p.label}</th>)}</tr></thead>
            <tbody>
              {([["Revenue", "revenue"], ["Returns", "returns"], ["Marketplace fees", "fees"], ["Cost of goods", "cogs"], ["Expenses", "expenses"], ["Payroll", "payroll"], ["Net profit", "netProfit"]] as const).map(([l, k]) => (
                <tr key={k} className={k === "netProfit" ? "font-semibold" : ""}>
                  <td className="py-1.5 text-muted">{l}</td>
                  {pnl.map((p) => <td key={p.month} className={`py-1.5 text-right num ${k === "netProfit" ? (p[k] >= 0 ? "text-leaf" : "text-sindoor") : ""}`}>{compactINR(p[k])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="What earns the most" subtitle="Last 30 days, by sales and margin after cost">
          <ul className="space-y-1 p-4">
            {a.skuPerformance.slice(0, 8).map((s, i) => (
              <li key={s.sku} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <span className="w-5 text-right text-[14px] text-muted">{i + 1}</span>
                <ProductGlyph name={s.name} size={34} />
                <div className="min-w-0 flex-1"><div className="truncate text-[15.5px]">{s.name}</div><code className="text-[13.5px] text-muted">{s.sku} · {s.units} sold</code></div>
                <div className="text-right"><div className="text-[15.5px] font-semibold num">{compactINR(s.paise)}</div><Badge tone={s.marginPct >= 45 ? "green" : s.marginPct >= 30 ? "gold" : "red"}>{s.marginPct}% margin</Badge></div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Restock before you run out" subtitle="SKUs with under 14 days of stock at the current sales pace">
          <div className="space-y-2 p-4">
            {a.reorder.map((r) => (
              <div key={r.sku} className="flex items-center gap-3 rounded-2xl border border-line/10 bg-bg2/60 p-3">
                <ProductGlyph name={r.name} size={34} />
                <div className="min-w-0 flex-1"><div className="truncate text-[15.5px] font-medium">{r.name}</div><div className="text-[14px] text-muted">{r.available} left · selling {r.perDay}/day</div></div>
                <div className="text-right"><div className={`text-[15.5px] font-semibold ${r.coverDays < 5 ? "text-sindoor" : "text-marigold"}`}>{r.coverDays} days left</div><div className="text-[14px] text-muted">order ~{r.suggestQty}</div></div>
              </div>
            ))}
            {!a.reorder.length && <div className="py-8 text-center text-[15.5px] text-muted">Every SKU has at least two weeks of stock.</div>}
          </div>
        </Card>
      </div>

      <Card title="When orders arrive" subtitle={busiest ? `Busiest slot in the last 60 days: ${DAYS[busiest.d]}s around ${busiest.h}:00. Plan packing shifts around it.` : undefined}>
        <div className="p-5"><Heatmap grid={a.heat} /></div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Where your customers are" subtitle="Sales by state, last 6 months">
          <div className="space-y-2.5 p-5">
            {a.states.slice(0, 10).map((s, i) => (
              <div key={s.state} className="flex items-center gap-3 text-[15.5px]">
                <span className="w-32 truncate">{s.state}</span>
                <div className="h-6 flex-1 overflow-hidden rounded-lg bg-line/[0.06]">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(s.paise / topState) * 100}%` }} transition={{ duration: 1, delay: i * 0.06 }} className="flex h-full items-center justify-end rounded-lg bg-primary/80 pr-2 font-mono text-[13px] text-white">{s.n}</motion.div>
                </div>
                <span className="w-16 text-right font-semibold num">{compactINR(s.paise)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Stock that is not moving" subtitle="No sale in 60 days — consider a discount or a bundle">
          <div className="space-y-2 p-4">
            {a.deadStock.map((d) => (
              <div key={d.sku} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <ProductGlyph name={d.name} size={34} />
                <div className="min-w-0 flex-1"><div className="truncate text-[15.5px]">{d.name}</div><div className="text-[14px] text-muted">{d.onHand} units · last sold {d.lastSaleAt ? fmtDate(d.lastSaleAt) : "never"}</div></div>
                <span className="text-[15.5px] font-semibold text-marigold num">{formatINR(d.valuePaise, { decimals: false })}</span>
              </div>
            ))}
            {!a.deadStock.length && <div className="py-8 text-center text-[15.5px] text-muted">Everything sold in the last 60 days. Wonderful.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
