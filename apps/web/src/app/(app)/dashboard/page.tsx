"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle, ArrowRight, Boxes, Clock, FilePlus2, IndianRupee, PackageCheck, PackagePlus, ShoppingBag, TrendingUp, Upload, Users,
} from "lucide-react";
import { CHANNELS } from "@pp/shared";
import { Alpana } from "@/components/brand/Alpana";
import { AlpanaLoader } from "@/components/brand/AlpanaLoader";
import { Diya } from "@/components/brand/Diya";
import { Donut, shareOf } from "@/components/charts/Donut";
import { GlassTooltip, axis, moneyTick } from "@/components/charts/theme";
import { Stat } from "@/components/ui/Stat";
import { Avatar, Badge, Button, Card, ChannelDot, StatusBadge } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { compactINR, fmtDate, fmtNum, fmtTime, formatINR, greeting, timeAgo } from "@/lib/format";

interface Dash {
  kpis: Record<string, number>;
  trend: Record<string, number | string>[];
  channelCodes: string[];
  channelMix: { code: string; name: string; color: string; paise: number; n: number }[];
  pipeline: { status: string; n: number }[];
  topSkus: { sku: string; name: string; emoji: string; units: number; paise: number }[];
  lowStock: { variantId: string; sku: string; name: string; emoji: string; onHand: number; reorderLevel: number; state: string }[];
  overdue: { id: string; channelOrderId: string; dispatchBy: string; status: string; channelName: string; channelColor: string }[];
  team: { employee: { id: string; name: string; designation: string; avatarHue: number }; record: { checkInAt: string | null } | null; state: string }[];
  teamSummary: { total: number; present: number; late: number; leave: number; notIn: number };
  recent: { id: string; action: string; entity: string; createdAt: string; by: string | null; meta: Record<string, unknown> | null }[];
}

const ACTION_TEXT: Record<string, string> = {
  "orders.import": "imported marketplace orders", "purchase.create": "received a purchase", "order.dispatched": "dispatched an order",
  "return.create": "logged a return", "payroll.run": "ran payroll", "invoice.create": "issued a GST invoice", "stock.adjustment": "adjusted stock",
  "stock.inward": "added stock", "stock.outward": "sent stock out", "product.create": "added a product", "leave.approved": "approved leave",
  "attendance.check_in": "checked in", "settings.update": "updated settings", "user.create": "added a login",
};
const STAGE_BN: Record<string, string> = { NEW: "নতুন", PICKED: "বাছাই", PACKED: "প্যাক", DISPATCHED: "রওনা", DELIVERED: "পৌঁছেছে" };

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<Dash>("/insights/dashboard"), refetchInterval: 60_000 });
  if (isLoading || !data) return <AlpanaLoader label="আজকের হিসাব সাজানো হচ্ছে…" />;
  const k = data.kpis;
  const g = greeting();
  const mixTotal = data.channelMix.reduce((s, c) => s + c.paise, 0);
  const pipeMax = Math.max(1, ...data.pipeline.map((p) => p.n));

  return (
    <div className="space-y-6">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="paar-card relative overflow-hidden px-6 py-7 sm:px-9 sm:py-9">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_85%_40%,rgb(var(--sindoor)/0.28),transparent_55%)]" />
        <div className="pointer-events-none absolute -right-24 top-1/2 -translate-y-1/2 opacity-70"><Alpana size={420} spin strokeWidth={0.9} /></div>
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Diya size={34} />
              <span className="font-bangla text-xl text-gold">{g.bn}, {user?.name.split(" ")[0]}</span>
            </div>
            <h1 className="mt-3 max-w-2xl font-display text-[32px] font-semibold leading-[1.1] tracking-tight sm:text-[42px]">
              {k.todayOrders > 0 ? <>Today brought <span className="gold-text">{formatINR(k.todayRevenuePaise, { decimals: false })}</span> from {k.todayOrders} orders.</> : <>A calm morning so far — the shelves are ready.</>}
            </h1>
            <p className="mt-3 max-w-xl text-[15px] text-muted">
              {k.pendingDispatch} waiting to ship{k.overdueDispatch ? <>, <span className="text-sindoor">{k.overdueDispatch} past their dispatch time</span></> : ""}. {k.present} of {k.teamSize} people are in the warehouse. {fmtDate(new Date(), { weekday: "long", day: "numeric", month: "long" })}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={<Upload className="h-4 w-4" />} onClick={() => router.push("/orders?import=1")}>Import orders</Button>
            <Button variant="outline" icon={<FilePlus2 className="h-4 w-4" />} onClick={() => router.push("/billing?new=1")}>New invoice</Button>
            <Button variant="outline" icon={<PackagePlus className="h-4 w-4" />} onClick={() => router.push("/stock?move=1")}>Add stock</Button>
          </div>
        </div>
      </motion.section>

      {/* ── KPIs ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Sales today" value={k.todayRevenuePaise} format={(n) => compactINR(n)} icon={<IndianRupee className="h-5 w-5" />} change={k.todayChangePct} hint="vs yesterday" delay={0.05} />
        <Stat label="Sales · 30 days" value={k.revenue30Paise} format={(n) => compactINR(n)} icon={<TrendingUp className="h-5 w-5" />} change={k.revenue30ChangePct} hint={`${fmtNum(k.orders30)} orders · avg ${compactINR(k.avgOrderPaise)}`} delay={0.1} tone="green" />
        <Stat label="Waiting to ship" value={k.pendingDispatch} icon={<ShoppingBag className="h-5 w-5" />} hint={k.overdueDispatch ? `${k.overdueDispatch} overdue` : "all on time"} tone={k.overdueDispatch ? "red" : "blue"} delay={0.15} onClick={() => router.push("/orders?status=NEW,PICKED,PACKED")} />
        <Stat label="Stock value (cost)" value={k.stockValuePaise} format={(n) => compactINR(n)} icon={<Boxes className="h-5 w-5" />} hint={`${fmtNum(k.units)} units · ${k.skus} SKUs`} delay={0.2} onClick={() => router.push("/stock")} />
        <Stat label="Low or out of stock" value={k.lowStock + k.outOfStock} icon={<AlertTriangle className="h-5 w-5" />} hint={`${k.outOfStock} out · ${k.lowStock} low`} tone={k.outOfStock ? "red" : "gold"} delay={0.25} onClick={() => router.push("/stock?filter=low")} />
        <Stat label="Team in today" value={k.present} format={(n) => `${Math.round(n)}/${k.teamSize}`} icon={<Users className="h-5 w-5" />} hint={`${k.late} late`} tone="green" delay={0.3} onClick={() => router.push("/hr/attendance")} />
      </div>

      {/* ── Revenue river + channel mix ──────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card title="Sales by marketplace" subtitle="Last 30 days, stacked by channel" delay={0.2}>
          <div className="h-[320px] px-2 pb-4 pt-4">
            <ResponsiveContainer>
              <AreaChart data={data.trend} margin={{ left: 8, right: 16, top: 8 }}>
                <defs>
                  {data.channelCodes.map((code) => {
                    const color = CHANNELS.find((c) => c.code === code)?.color ?? "#e9b452";
                    return (
                      <linearGradient key={code} id={`a-${code}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.55} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                      </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid stroke="rgb(var(--line) / 0.07)" vertical={false} />
                <XAxis dataKey="day" {...axis} tickFormatter={(d) => fmtDate(d)} interval={4} />
                <YAxis {...axis} tickFormatter={moneyTick} width={56} />
                <Tooltip content={<GlassTooltip labelFormat={(d) => fmtDate(d, { weekday: "short", day: "numeric", month: "short" })} />} />
                {data.channelCodes.map((code) => {
                  const ch = CHANNELS.find((c) => c.code === code);
                  return <Area key={code} type="monotone" dataKey={code} name={ch?.name ?? code} stackId="1" stroke={ch?.color} strokeWidth={1.6} fill={`url(#a-${code})`} animationDuration={1600} />;
                })}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Where sales come from" subtitle="Share of the last 30 days" delay={0.25}>
          <div className="flex flex-col items-center gap-5 px-5 pb-6 pt-4">
            <Donut data={data.channelMix.map((c) => ({ name: c.name, value: c.paise, color: c.color }))} label={compactINR(mixTotal)} sub="30-day sales" />
            <ul className="w-full space-y-2.5">
              {data.channelMix.map((c, i) => (
                <motion.li key={c.code} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.07 }} className="flex items-center gap-3 text-sm">
                  <ChannelDot color={c.color} name={c.name} className="flex-1" />
                  <span className="text-xs text-muted">{c.n} orders</span>
                  <span className="w-11 text-right font-semibold num">{shareOf(c.paise, mixTotal)}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {/* ── Order journey ────────────────────────────────────── */}
      <Card title="The order journey" subtitle="Every order, from marketplace to doorstep" action={<Link href="/orders" className="flex items-center gap-1 text-xs font-semibold text-gold hover:underline">Open dispatch board <ArrowRight className="h-3.5 w-3.5" /></Link>} delay={0.3}>
        <div className="relative px-6 pb-7 pt-6">
          <div className="absolute left-[10%] right-[10%] top-[58px] hidden h-px bg-gradient-to-r from-sky/40 via-gold/50 to-leaf/40 sm:block" />
          <motion.div className="absolute top-[54px] hidden h-2 w-2 rounded-full bg-gold shadow-[0_0_14px_rgb(var(--gold))] sm:block" animate={{ left: ["10%", "90%"] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} />
          <div className="relative grid grid-cols-2 gap-4 sm:grid-cols-5">
            {data.pipeline.map((p, i) => (
              <motion.button key={p.status} onClick={() => router.push(`/orders?status=${p.status}`)} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.1 }} className="group flex flex-col items-center text-center">
                <div className="relative grid h-[68px] w-[68px] place-items-center rounded-full border border-gold/30 bg-bg2 shadow-glow transition group-hover:scale-105">
                  <svg className="absolute inset-0 -rotate-90" viewBox="0 0 68 68"><circle cx="34" cy="34" r="31" fill="none" stroke="rgb(var(--gold))" strokeWidth="2.5" strokeDasharray={`${(p.n / pipeMax) * 195} 195`} strokeLinecap="round" opacity="0.8" /></svg>
                  <span className="font-display text-xl font-semibold num">{fmtNum(p.n)}</span>
                </div>
                <div className="mt-3 text-sm font-semibold">{p.status.charAt(0) + p.status.slice(1).toLowerCase()}</div>
                <div className="font-bangla text-xs text-gold/70">{STAGE_BN[p.status]}</div>
              </motion.button>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {/* Bestsellers */}
        <Card title="Bestsellers this month" subtitle="By sales value, last 30 days" delay={0.35}>
          <ul className="space-y-1 px-3 pb-4 pt-3">
            {data.topSkus.map((s, i) => (
              <li key={s.sku} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-panel2 text-xl">{s.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.name}</div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line/10">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-sindoor to-gold" initial={{ width: 0 }} animate={{ width: `${(s.paise / data.topSkus[0].paise) * 100}%` }} transition={{ delay: 0.5 + i * 0.1, duration: 1 }} />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold num">{compactINR(s.paise)}</div>
                  <div className="text-[11px] text-muted">{s.units} sold</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Attention */}
        <Card title="Needs your attention" subtitle="Late dispatches and thin shelves" delay={0.4}>
          <div className="space-y-2 px-4 pb-5 pt-3">
            {data.overdue.map((o) => (
              <Link key={o.id} href={`/orders?open=${o.id}`} className="flex items-center gap-3 rounded-xl border border-sindoor/25 bg-sindoor/[0.07] px-3 py-2.5 transition hover:bg-sindoor/[0.12]">
                <Clock className="h-4 w-4 text-sindoor" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{o.channelName} · <code className="text-xs">{o.channelOrderId}</code></div>
                  <div className="text-xs text-muted">Was due {timeAgo(o.dispatchBy)}</div>
                </div>
                <StatusBadge status={o.status} />
              </Link>
            ))}
            {data.lowStock.map((s) => (
              <Link key={s.variantId} href={`/stock?search=${s.sku}`} className="flex items-center gap-3 rounded-xl border border-line/10 bg-panel2/50 px-3 py-2.5 transition hover:border-gold/30">
                <span className="text-lg">{s.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.name}</div>
                  <code className="text-[11px] text-muted">{s.sku}</code>
                </div>
                <Badge tone={s.state === "OUT" ? "red" : "gold"}>{s.onHand} left</Badge>
              </Link>
            ))}
            {!data.overdue.length && !data.lowStock.length && <div className="py-8 text-center text-sm text-muted">Nothing urgent. Shubho din!</div>}
          </div>
        </Card>

        {/* Team */}
        <Card title="In the warehouse" subtitle={`${data.teamSummary.present + data.teamSummary.late} in · ${data.teamSummary.leave} on leave · ${data.teamSummary.notIn} not in`} action={<Link href="/hr/attendance" className="text-xs font-semibold text-gold hover:underline">Attendance</Link>} delay={0.45} className="lg:col-span-2 xl:col-span-1">
          <div className="grid grid-cols-2 gap-2 px-4 pb-5 pt-3 sm:grid-cols-3 xl:grid-cols-2">
            {data.team.map((t, i) => {
              const ring = t.state === "PRESENT" ? "ring-leaf/70" : t.state === "LATE" ? "ring-marigold/80" : t.state === "LEAVE" ? "ring-sky/60" : "ring-line/15 opacity-60";
              return (
                <motion.div key={t.employee.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 + i * 0.04 }} className="flex items-center gap-2.5 rounded-xl px-2 py-2">
                  <Avatar name={t.employee.name} hue={t.employee.avatarHue} size={34} className={`ring-2 ${ring}`} />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{t.employee.name}</div>
                    <div className="text-[11px] text-muted">{t.record?.checkInAt ? `In ${fmtTime(t.record.checkInAt)}` : t.state === "LEAVE" ? "On leave" : "Not in yet"}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card title="Recent activity" subtitle="Everything the team did, as it happened" delay={0.5}>
        <ol className="relative px-6 pb-6 pt-4">
          <span className="absolute bottom-6 left-[34px] top-6 w-px bg-gradient-to-b from-gold/50 to-transparent" />
          {data.recent.map((r, i) => (
            <motion.li key={r.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55 + i * 0.05 }} className="relative flex items-center gap-4 py-2.5">
              <span className="relative z-10 grid h-5 w-5 place-items-center rounded-full border border-gold/40 bg-bg2"><PackageCheck className="h-3 w-3 text-gold" /></span>
              <span className="flex-1 text-sm"><b className="font-semibold">{r.by ?? "System"}</b> <span className="text-muted">{ACTION_TEXT[r.action] ?? r.action.replace(/[._]/g, " ")}</span></span>
              <span className="text-xs text-muted">{timeAgo(r.createdAt)}</span>
            </motion.li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
