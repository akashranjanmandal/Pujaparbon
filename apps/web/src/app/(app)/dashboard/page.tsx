"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, Boxes, Clock3, FilePlus2, PackagePlus, Upload } from "lucide-react";
import { CHANNELS } from "@pp/shared";
import { GlassTooltip, axis, moneyTick } from "@/components/charts/theme";
import { Loader } from "@/components/ui/Loader";
import { ProductGlyph } from "@/components/ui/ProductGlyph";
import { Counter, Spark } from "@/components/ui/Stat";
import { Avatar, Button, Card, Segmented } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { compactINR, fmtDate, fmtNum, fmtTime, formatINR, timeAgo } from "@/lib/format";

interface Dash {
  kpis: Record<string, number>;
  trend: Record<string, number | string>[];
  channelCodes: string[];
  channelMix: { code: string; name: string; color: string; paise: number; n: number }[];
  pipeline: { status: string; n: number }[];
  topSkus: { sku: string; name: string; size: string | null; color: string | null; units: number; paise: number }[];
  lowStock: { variantId: string; sku: string; name: string; onHand: number; reorderLevel: number; state: string }[];
  overdue: { id: string; channelOrderId: string; dispatchBy: string; status: string; channelName: string; channelColor: string }[];
  team: { employee: { id: string; name: string; designation: string; avatarHue: number }; record: { checkInAt: string | null } | null; state: string }[];
  teamSummary: { total: number; present: number; late: number; leave: number; notIn: number };
  recent: { id: string; action: string; entity: string; createdAt: string; by: string | null; meta: Record<string, unknown> | null }[];
}
interface Bin { id: string; code: string; zone: string; units: number; skus: number }

const ACTION: Record<string, string> = {
  "orders.import": "imported orders", "purchase.create": "received a purchase", "order.dispatched": "dispatched an order", "order.picked": "picked an order",
  "order.packed": "packed an order", "order.delivered": "marked an order delivered", "return.create": "logged a return", "payroll.run": "ran payroll",
  "invoice.create": "issued an invoice", "stock.adjustment": "corrected stock", "stock.inward": "added stock", "stock.outward": "sent stock out",
  "product.create": "added a product", "product.update": "updated a product", "leave.approved": "approved leave", "attendance.check_in": "checked in",
  "settings.update": "changed settings", "user.create": "created a login",
};

export default function CommandCenter() {
  const { user } = useAuth();
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<Dash>("/insights/dashboard"), refetchInterval: 30_000 });
  const { data: bins } = useQuery({ queryKey: ["stock", "bins"], queryFn: () => api.get<Bin[]>("/stock/bins") });
  const [range, setRange] = useState<"total" | "channels">("total");
  if (isLoading || !data) return <Loader label="Syncing operations" />;
  const k = data.kpis;
  const spark = (key: string) => data.trend.map((t) => Number(t[key] ?? 0));

  const attention = k.overdueDispatch + k.lowStock + k.outOfStock;
  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="eyebrow">{fmtDate(new Date(), { weekday: "long", day: "numeric", month: "long" })}</div>
          <h1 className="display mt-1 text-[34px] leading-[1.08] sm:text-[44px]">Good {greet()}, {user?.name.split(" ")[0]}<span className="text-peach">.</span></h1>
          <p className="mt-2 max-w-xl text-[16px] text-muted">
            {k.pendingDispatch} orders are moving through the warehouse{k.overdueDispatch ? <>, and <b className="font-semibold text-sindoor">{k.overdueDispatch} have missed their dispatch time</b></> : ", all on schedule"}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<Upload className="h-4 w-4" />} onClick={() => router.push("/orders?import=1")}>Import orders</Button>
          <Button icon={<PackagePlus className="h-4 w-4" />} onClick={() => router.push("/stock?move=1")}>Stock movement</Button>
          <Button icon={<FilePlus2 className="h-4 w-4" />} onClick={() => router.push("/billing?new=1")}>New invoice</Button>
        </div>
      </div>

      {/* Colour-blocked bento */}
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr_1fr]">
        <motion.button onClick={() => router.push("/analytics")} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="group relative overflow-hidden rounded-[28px] bg-primary-soft p-7 text-left">
          <Rings className="absolute -right-16 -top-16 text-primary/15" />
          <div className="relative flex items-center justify-between text-[16px] font-semibold text-primary">Today&apos;s sales <ArrowUpRight className="h-5 w-5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></div>
          <div className="display relative mt-4 text-[54px] leading-none text-text sm:text-[64px]"><Counter value={k.todayRevenuePaise} format={(n) => compactINR(n)} /></div>
          <div className="relative mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[16px] text-text/75">
            <span><b className="font-semibold text-text">{k.todayOrders}</b> orders</span>
            <span className={k.todayChangePct >= 0 ? "text-leaf" : "text-peach"}>{k.todayChangePct >= 0 ? "↑" : "↓"} {Math.abs(k.todayChangePct)}% vs yesterday</span>
          </div>
          <Spark data={spark("total").slice(-14)} className="relative mt-5 h-12" tone="primary" />
          <div className="relative mt-2 text-[14.5px] text-text/60">Last 14 days · {compactINR(k.revenue30Paise)} in 30 days</div>
        </motion.button>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="relative overflow-hidden rounded-[28px] bg-lav-soft p-7">
          <div className="text-[16px] font-semibold text-lav">On the floor right now</div>
          <div className="mt-5 space-y-3">
            {data.pipeline.slice(0, 4).map((p) => (
              <button key={p.status} onClick={() => router.push(`/orders?status=${p.status}`)} className="flex w-full items-baseline justify-between border-b border-lav/15 pb-2.5 text-left last:border-0">
                <span className="text-[16px] text-text/80">{STAGE[p.status]}</span>
                <span className="display text-[30px] leading-none">{fmtNum(p.n)}</span>
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="relative overflow-hidden rounded-[28px] bg-peach-soft p-7">
          <div className="text-[16px] font-semibold text-peach">Needs you</div>
          <div className="display mt-4 text-[64px] leading-none">{attention}</div>
          <div className="mt-1 text-[16px] text-text/70">{attention === 1 ? "thing to look at" : "things to look at"}</div>
          <div className="mt-5 space-y-2 text-[16px]">
            <Link href="/orders?status=NEW,PICKED,PACKED" className="flex justify-between rounded-xl bg-white/50 px-3.5 py-2.5 transition hover:bg-white/80"><span>Late dispatches</span><b className="font-semibold">{k.overdueDispatch}</b></Link>
            <Link href="/stock?filter=low" className="flex justify-between rounded-xl bg-white/50 px-3.5 py-2.5 transition hover:bg-white/80"><span>Low or out of stock</span><b className="font-semibold">{k.lowStock + k.outOfStock}</b></Link>
          </div>
        </motion.div>
      </div>

      {/* Secondary figures */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Figure label="Orders, last 30 days" value={k.orders30} sub={`avg ${formatINR(k.avgOrderPaise, { decimals: false })} per order`} change={k.revenue30ChangePct} />
        <Figure label="Inventory value" value={k.stockValuePaise} fmt={compactINR} sub={`${fmtNum(k.units)} units across ${k.skus} SKUs`} onClick={() => router.push("/stock")} />
        <Figure label="Returns, 30 days" value={k.returns30} sub="customer + RTO" onClick={() => router.push("/returns")} />
        <Figure label="Team on the floor" value={k.present} fmt={(n) => `${Math.round(n)} of ${k.teamSize}`} sub={`${k.late} came in late`} onClick={() => router.push("/hr/attendance")} />
      </div>

      <Card title="How orders are flowing" subtitle="From each marketplace into the warehouse and out to customers" action={<Link href="/orders" className="flex items-center gap-1 text-[15px] font-semibold text-primary hover:underline">Open dispatch board <ArrowUpRight className="h-4 w-4" /></Link>}>
        <OrderFlow mix={data.channelMix} pipeline={data.pipeline} overdue={k.overdueDispatch} onStage={(s) => router.push(`/orders?status=${s}`)} />
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Sales over the last 30 days" action={<Segmented value={range} onChange={setRange} options={[{ value: "total", label: "Total" }, { value: "channels", label: "By marketplace" }]} />}>
          <div className="h-[300px] px-2 pb-4 pt-2">
            <ResponsiveContainer>
              <AreaChart data={data.trend} margin={{ left: 4, right: 18, top: 8 }}>
                <defs>
                  <linearGradient id="g-total" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgb(var(--primary))" stopOpacity={0.22} /><stop offset="100%" stopColor="rgb(var(--primary))" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="rgb(var(--line) / 0.06)" vertical={false} />
                <XAxis dataKey="day" {...axis} tickFormatter={(d) => fmtDate(d)} interval={5} />
                <YAxis {...axis} tickFormatter={moneyTick} width={56} />
                <Tooltip content={<GlassTooltip labelFormat={(d) => fmtDate(d, { weekday: "short", day: "numeric", month: "short" })} />} cursor={{ stroke: "rgb(var(--line) / 0.15)" }} />
                {range === "total" ? (
                  <Area type="monotone" dataKey="total" name="Sales" stroke="rgb(var(--primary))" strokeWidth={2.2} fill="url(#g-total)" animationDuration={900} />
                ) : (
                  data.channelCodes.map((code) => {
                    const ch = CHANNELS.find((c) => c.code === code);
                    return <Area key={code} type="monotone" dataKey={code} name={ch?.name} stackId="1" stroke={ch?.color} strokeWidth={1.4} fill={ch?.color} fillOpacity={0.14} animationDuration={900} />;
                  })
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Where sales come from" subtitle="Share of the last 30 days">
          <ChannelShare mix={data.channelMix} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card title="Warehouse floor" subtitle="Darker bins hold more stock" action={<Link href="/stock" className="text-[15px] font-semibold text-primary hover:underline">Stock</Link>}>
          <Floor bins={bins ?? []} />
        </Card>
        <Card title="Late and low" subtitle="Orders past dispatch time, and items running out">
          <div className="px-3 pb-3">
            {data.overdue.map((o) => (
              <Link key={o.id} href={`/orders?open=${o.id}`} className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-bg2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-sindoor/10 text-sindoor"><Clock3 className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <code className="block truncate text-[14.5px]">{o.channelOrderId}</code>
                  <span className="text-[14.5px] text-muted">{o.channelName} · was due {timeAgo(o.dispatchBy)}</span>
                </div>
              </Link>
            ))}
            {data.lowStock.map((s) => (
              <Link key={s.variantId} href={`/stock?search=${s.sku}`} className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-bg2">
                <ProductGlyph name={s.name} size={36} />
                <div className="min-w-0 flex-1"><div className="truncate text-[15.5px] font-medium">{s.name}</div><code className="text-[13.5px] text-muted">{s.sku}</code></div>
                <span className={cn("text-[15px] font-semibold", s.state === "OUT" ? "text-sindoor" : "text-peach")}>{s.onHand} left</span>
              </Link>
            ))}
            {!data.overdue.length && !data.lowStock.length && <Calm text="Nothing late, nothing running out." />}
          </div>
        </Card>
        <Card title="What the team did" subtitle="Latest activity" className="lg:col-span-2 xl:col-span-1">
          <ol className="relative max-h-[420px] overflow-y-auto px-6 pb-5">
            <span className="absolute bottom-6 left-[31px] top-2 w-px bg-line/10" />
            {data.recent.map((r, i) => (
              <motion.li key={r.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="relative flex gap-4 py-3">
                <span className="relative z-10 mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-panel bg-lav" />
                <div className="min-w-0">
                  <div className="text-[15.5px]"><b className="font-semibold">{r.by ?? "System"}</b> {ACTION[r.action] ?? r.action.replace(/[._]/g, " ")}{describe(r)}</div>
                  <div className="text-[14px] text-muted">{timeAgo(r.createdAt)}</div>
                </div>
              </motion.li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Card title="Best sellers" subtitle="By sales, last 30 days">
          <div className="px-3 pb-3">
            {data.topSkus.map((s, i) => (
              <div key={s.sku} className="flex items-center gap-3 rounded-xl px-3 py-3">
                <span className="display w-6 text-[22px] text-muted">{i + 1}</span>
                <ProductGlyph name={s.name} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15.5px] font-medium">{s.name} <span className="font-normal text-muted">{[s.size, s.color].filter(Boolean).join(" · ")}</span></div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg2"><motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${(s.paise / data.topSkus[0].paise) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.08 }} /></div>
                </div>
                <div className="text-right"><div className="text-[15.5px] font-semibold">{compactINR(s.paise)}</div><div className="text-[14px] text-muted">{s.units} sold</div></div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Who's in today" subtitle={`${data.teamSummary.present + data.teamSummary.late} in · ${data.teamSummary.leave} on leave · ${data.teamSummary.notIn} not in yet`} action={<Link href="/hr/attendance" className="text-[15px] font-semibold text-primary hover:underline">Attendance</Link>}>
          <div className="grid grid-cols-2 gap-1 px-3 pb-4 sm:grid-cols-3 xl:grid-cols-4">
            {data.team.map((t) => (
              <div key={t.employee.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                <div className="relative">
                  <Avatar name={t.employee.name} hue={t.employee.avatarHue} size={38} />
                  <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-panel", t.state === "PRESENT" ? "bg-leaf" : t.state === "LATE" ? "bg-peach" : t.state === "LEAVE" ? "bg-lav" : "bg-line/20")} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-medium">{t.employee.name}</div>
                  <div className="text-[14px] text-muted">{t.record?.checkInAt ? `In at ${fmtTime(t.record.checkInAt)}` : t.state === "LEAVE" ? "On leave" : "Not in yet"}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

const STAGE: Record<string, string> = { NEW: "Waiting to be picked", PICKED: "Picked, to be packed", PACKED: "Packed, ready to ship", DISPATCHED: "With the courier" };

/** Concentric line rings — a quiet graphic for the hero tile. */
const Rings = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 200" width="240" height="240" className={className} aria-hidden>
    {[90, 70, 50, 30].map((r) => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="currentColor" strokeWidth="14" />)}
  </svg>
);

function Figure({ label, value, fmt, sub, change, onClick }: { label: string; value: number; fmt?: (n: number) => string; sub: string; change?: number; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={cn("paar-card p-5 text-left transition", onClick ? "hover:-translate-y-0.5 hover:shadow-lift" : "cursor-default")}>
      <div className="text-[15px] font-medium text-muted">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[28px] font-semibold tracking-tight"><Counter value={value} format={fmt} /></span>
        {change !== undefined && <span className={cn("text-[14px] font-semibold", change >= 0 ? "text-leaf" : "text-peach")}>{change >= 0 ? "↑" : "↓"}{Math.abs(change)}%</span>}
      </div>
      <div className="mt-1 text-[14.5px] text-muted">{sub}</div>
    </button>
  );
}

const greet = () => {
  const h = Number(new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour: "numeric" }));
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
};
const Calm = ({ text }: { text: string }) => <div className="px-5 py-8 text-center text-[15.5px] text-muted">{text}</div>;
function describe(r: Dash["recent"][number]) {
  const m = r.meta ?? {};
  if (r.action === "orders.import" && m.imported) return ` — ${m.imported} from ${String(m.channel ?? "").charAt(0)}${String(m.channel ?? "").slice(1).toLowerCase()}`;
  if (m.totalPaise) return ` — ${formatINR(Number(m.totalPaise), { decimals: false })}`;
  return "";
}

/** Sankey-style flow: channel volumes merge into the pipeline; stroke width = volume; dashes move continuously. */
function OrderFlow({ mix, pipeline, overdue, onStage }: { mix: Dash["channelMix"]; pipeline: Dash["pipeline"]; overdue: number; onStage: (s: string) => void }) {
  const W = 1200, H = 300, chanX = 170, hubX = 390, stageX0 = 500, stageGap = 150;
  const totalCh = Math.max(1, mix.reduce((s, c) => s + c.n, 0));
  const maxStage = Math.max(1, ...pipeline.map((p) => p.n));
  // Nodes are evenly spaced; the wire thickness carries the volume.
  const chanY = useMemo(() => {
    const step = mix.length > 1 ? 230 / (mix.length - 1) : 0;
    return mix.map((c, i) => ({ ...c, y: 35 + i * step, h: 4 + (c.n / totalCh) * 46 }));
  }, [mix, totalCh]);
  const mid = H / 2;

  return (
    <div className="px-2 pb-4 pt-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="hidden h-auto w-full md:block" role="img" aria-label="Order flow from marketplaces through fulfilment stages">
        <defs>
          <linearGradient id="hub" x1="0" x2="1"><stop offset="0" stopColor="rgb(var(--primary))" stopOpacity="1" /><stop offset="1" stopColor="rgb(var(--primary))" stopOpacity="0.6" /></linearGradient>
        </defs>
        {chanY.map((c, i) => (
          <g key={c.code}>
            <motion.path d={`M${chanX} ${c.y} C ${chanX + 120} ${c.y}, ${hubX - 120} ${mid}, ${hubX} ${mid}`} fill="none" stroke={c.color} strokeOpacity="0.22" strokeWidth={c.h} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: i * 0.08 }} />
            <path d={`M${chanX} ${c.y} C ${chanX + 120} ${c.y}, ${hubX - 120} ${mid}, ${hubX} ${mid}`} fill="none" stroke={c.color} strokeWidth="1.5" strokeDasharray="2 10" className="animate-flow" />
            <rect x={chanX - 6} y={c.y - 9} width="6" height="18" rx="2" fill={c.color} />
            <text x={chanX - 16} y={c.y - 1} textAnchor="end" fontSize="15" fill="rgb(var(--text))" fontWeight="600">{c.name}</text>
            <text x={chanX - 16} y={c.y + 14} textAnchor="end" fontSize="14" fill="rgb(var(--muted))">{c.n} orders</text>
          </g>
        ))}
        <rect x={hubX} y={mid - 34} width="14" height="68" rx="3" fill="url(#hub)" />
        <text x={hubX + 7} y={mid + 56} textAnchor="middle" fontSize="14.5" fill="rgb(var(--muted))" fontWeight="600">Warehouse</text>
        {pipeline.map((p, i) => {
          const x = stageX0 + i * stageGap;
          const h = Math.max(8, Math.sqrt(p.n / maxStage) * 150);
          const prevX = i === 0 ? hubX + 14 : stageX0 + (i - 1) * stageGap + 18;
          const hot = p.status === "NEW" && overdue > 0;
          return (
            <g key={p.status} onClick={() => onStage(p.status)} className="cursor-pointer">
              <path d={`M${prevX} ${mid} L${x} ${mid}`} stroke="rgb(var(--line) / 0.1)" strokeWidth="2" />
              <path d={`M${prevX} ${mid} L${x} ${mid}`} stroke="rgb(var(--primary))" strokeWidth="2" strokeDasharray="3 9" className="animate-flow" />
              <motion.rect x={x} width="20" rx="6" fill={hot ? "rgb(var(--peach-soft))" : "rgb(var(--primary-soft))"} stroke={hot ? "rgb(var(--peach))" : "rgb(var(--primary))"} strokeWidth="1.5" initial={{ y: mid, height: 0 }} animate={{ y: mid - h / 2, height: h }} transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }} />
              <rect x={x - 30} y={mid - 90} width="78" height="180" fill="transparent" />
              <text x={x + 9} y={mid - h / 2 - 26} textAnchor="middle" fontSize="30" fill="rgb(var(--text))" fontFamily="var(--font-serif)">{fmtNum(p.n)}</text>
              <text x={x + 9} y={mid - h / 2 - 10} textAnchor="middle" fontSize="14.5" fontWeight="600" fill={hot ? "rgb(var(--peach))" : "rgb(var(--muted))"}>{p.status.charAt(0) + p.status.slice(1).toLowerCase()}</text>
            </g>
          );
        })}
      </svg>
      {/* Phone: compact pipeline */}
      <div className="space-y-2 p-3 md:hidden">
        {pipeline.map((p) => (
          <button key={p.status} onClick={() => onStage(p.status)} className="flex w-full items-center gap-3">
            <span className="w-28 text-left text-[15px] text-muted">{p.status.charAt(0) + p.status.slice(1).toLowerCase()}</span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-bg2"><span className="block h-full rounded-full bg-primary" style={{ width: `${(p.n / maxStage) * 100}%` }} /></span>
            <span className="w-14 text-right text-[16px] font-semibold">{fmtNum(p.n)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChannelShare({ mix }: { mix: Dash["channelMix"] }) {
  const total = Math.max(1, mix.reduce((s, c) => s + c.paise, 0));
  return (
    <div className="p-5">
      <div className="flex h-4 gap-0.5 overflow-hidden rounded-full">
        {mix.map((c, i) => <motion.div key={c.code} style={{ background: c.color }} initial={{ width: 0 }} animate={{ width: `${(c.paise / total) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.05 }} />)}
      </div>
      <div className="mt-5 divide-y divide-line/[0.06]">
        {mix.map((c) => (
          <div key={c.code} className="flex items-center gap-3 py-3 text-[15.5px]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
            <span className="flex-1">{c.name}</span>
            <span className="text-[14.5px] text-muted">{c.n} orders</span>
            <span className="w-16 text-right font-semibold">{compactINR(c.paise)}</span>
            <span className="w-10 text-right text-muted">{Math.round((c.paise / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Floor({ bins }: { bins: Bin[] }) {
  const max = Math.max(1, ...bins.map((b) => b.units));
  const zones = [...new Set(bins.map((b) => b.zone))];
  return (
    <div className="space-y-4 p-5">
      {zones.map((z) => (
        <div key={z}>
          <div className="mb-2 flex items-center gap-2 text-[15px] font-semibold"><Boxes className="h-4 w-4 text-primary" />{z}</div>
          <div className="grid grid-cols-6 gap-1.5">
            {bins.filter((b) => b.zone === z).map((b, i) => {
              const k = b.units / max;
              return (
                <motion.div
                  key={b.id}
                  title={`${b.code} · ${b.units} units · ${b.skus} SKUs`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="relative aspect-square rounded-lg p-1"
                  style={{ background: `rgb(var(--primary) / ${0.06 + k * 0.7})` }}
                >
                  <span className={cn("absolute left-1.5 top-1 text-[10.5px] font-medium", k > 0.5 ? "text-white/80" : "text-text/60")}>{b.code}</span>
                  <span className={cn("absolute bottom-1 right-1.5 text-[13px] font-semibold", k > 0.5 ? "text-white" : "text-text")}>{b.units}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}
      {!bins.length && <Calm text="No bins configured yet." />}
    </div>
  );
}
