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
  "orders.import": "IMPORT", "purchase.create": "INWARD", "order.dispatched": "DISPATCH", "order.picked": "PICK", "order.packed": "PACK", "order.delivered": "DELIVER",
  "return.create": "RETURN", "payroll.run": "PAYROLL", "invoice.create": "INVOICE", "stock.adjustment": "ADJUST", "stock.inward": "INWARD", "stock.outward": "OUTWARD",
  "product.create": "CATALOG", "product.update": "CATALOG", "leave.approved": "LEAVE", "attendance.check_in": "CHECK-IN", "settings.update": "CONFIG", "user.create": "ACCESS",
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b hairline pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="label mb-2 flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-sindoor" />Ops <span className="text-muted/40">/</span> <span className="text-text/70">Command Center</span></div>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Good {greet()}, {user?.name.split(" ")[0]}.</h1>
          <p className="mt-1 text-[13px] text-muted">
            {fmtDate(new Date(), { weekday: "long", day: "numeric", month: "long" })} · <span className="text-text">{k.pendingDispatch}</span> orders in the pipeline
            {k.overdueDispatch ? <> · <span className="text-sindoor">{k.overdueDispatch} breaching SLA</span></> : " · all within SLA"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<Upload className="h-3.5 w-3.5" />} onClick={() => router.push("/orders?import=1")}>Import orders</Button>
          <Button icon={<PackagePlus className="h-3.5 w-3.5" />} onClick={() => router.push("/stock?move=1")}>Stock movement</Button>
          <Button icon={<FilePlus2 className="h-3.5 w-3.5" />} onClick={() => router.push("/billing?new=1")}>Invoice</Button>
        </div>
      </div>

      {/* Metric strip */}
      <div className="paar-card grid grid-cols-2 divide-line/[0.07] md:grid-cols-3 xl:grid-cols-6 xl:divide-x [&>*]:border-line/[0.07] max-xl:[&>*]:border-b">
        <Metric label="GMV today" value={k.todayRevenuePaise} fmt={compactINR} delta={k.todayChangePct} spark={spark("total").slice(-14)} />
        <Metric label="Orders today" value={k.todayOrders} delta={undefined} spark={spark("orders").slice(-14)} sub={`${fmtNum(k.orders30)} in 30 days`} />
        <Metric label="GMV · 30d" value={k.revenue30Paise} fmt={compactINR} delta={k.revenue30ChangePct} spark={spark("total")} />
        <Metric label="Avg order value" value={k.avgOrderPaise} fmt={(n) => formatINR(n, { decimals: false })} sub="last 30 days" />
        <Metric label="Inventory at cost" value={k.stockValuePaise} fmt={compactINR} sub={`${fmtNum(k.units)} units · ${k.skus} SKUs`} onClick={() => router.push("/stock")} />
        <Metric label="Workforce on floor" value={k.present} fmt={(n) => `${Math.round(n)}/${k.teamSize}`} sub={`${k.late} late`} onClick={() => router.push("/hr/attendance")} tone="leaf" />
      </div>

      {/* Order flow */}
      <Card title="Order flow" subtitle="Live volume from each marketplace through the fulfilment pipeline" action={<Link href="/orders" className="flex items-center gap-1 text-[12px] text-muted hover:text-text">Dispatch board <ArrowUpRight className="h-3.5 w-3.5" /></Link>}>
        <OrderFlow mix={data.channelMix} pipeline={data.pipeline} overdue={k.overdueDispatch} onStage={(s) => router.push(`/orders?status=${s}`)} />
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Gross merchandise value" subtitle="Daily, last 30 days" action={<Segmented value={range} onChange={setRange} options={[{ value: "total", label: "Total" }, { value: "channels", label: "By channel" }]} />}>
          <div className="h-[280px] px-1 pb-3 pt-4">
            <ResponsiveContainer>
              <AreaChart data={data.trend} margin={{ left: 4, right: 16, top: 4 }}>
                <defs>
                  <linearGradient id="g-total" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgb(var(--sindoor))" stopOpacity={0.35} /><stop offset="100%" stopColor="rgb(var(--sindoor))" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="rgb(var(--line) / 0.05)" vertical={false} />
                <XAxis dataKey="day" {...axis} tickFormatter={(d) => fmtDate(d)} interval={5} />
                <YAxis {...axis} tickFormatter={moneyTick} width={52} />
                <Tooltip content={<GlassTooltip labelFormat={(d) => fmtDate(d, { weekday: "short", day: "numeric", month: "short" })} />} cursor={{ stroke: "rgb(var(--line) / 0.2)" }} />
                {range === "total" ? (
                  <Area type="monotone" dataKey="total" name="GMV" stroke="rgb(var(--sindoor))" strokeWidth={1.8} fill="url(#g-total)" animationDuration={900} />
                ) : (
                  data.channelCodes.map((code) => {
                    const ch = CHANNELS.find((c) => c.code === code);
                    return <Area key={code} type="monotone" dataKey={code} name={ch?.name} stackId="1" stroke={ch?.color} strokeWidth={1.2} fill={ch?.color} fillOpacity={0.12} animationDuration={900} />;
                  })
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Channel share" subtitle="GMV, last 30 days">
          <ChannelShare mix={data.channelMix} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card title="Warehouse floor" subtitle="Bins shaded by units on hand" action={<Link href="/stock" className="text-[12px] text-muted hover:text-text">Stock</Link>}>
          <Floor bins={bins ?? []} />
        </Card>
        <Card title="SLA watch" subtitle="Orders past their dispatch-by time">
          <div className="divide-y divide-line/[0.06]">
            {data.overdue.map((o) => (
              <Link key={o.id} href={`/orders?open=${o.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-line/[0.025]">
                <Clock3 className="h-4 w-4 text-sindoor" />
                <div className="min-w-0 flex-1">
                  <code className="block truncate text-[12.5px]">{o.channelOrderId}</code>
                  <span className="text-[12px] text-muted">{o.channelName} · due {timeAgo(o.dispatchBy)}</span>
                </div>
                <span className="font-mono text-[10.5px] uppercase text-sindoor">{o.status}</span>
              </Link>
            ))}
            {!data.overdue.length && <Calm text="Every open order is within its dispatch window." />}
          </div>
          <div className="label border-t hairline px-5 py-3">Stock runway</div>
          <div className="divide-y divide-line/[0.06]">
            {data.lowStock.map((s) => (
              <Link key={s.variantId} href={`/stock?search=${s.sku}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-line/[0.025]">
                <ProductGlyph name={s.name} size={28} />
                <div className="min-w-0 flex-1"><div className="truncate text-[13px]">{s.name}</div><code className="text-[11px] text-muted">{s.sku}</code></div>
                <span className={cn("font-mono text-[12px]", s.state === "OUT" ? "text-sindoor" : "text-marigold")}>{s.onHand} / {s.reorderLevel}</span>
              </Link>
            ))}
            {!data.lowStock.length && <Calm text="All SKUs above reorder level." />}
          </div>
        </Card>
        <Card title="Event log" subtitle="Everything the team did, as it happened" className="lg:col-span-2 xl:col-span-1">
          <ol className="max-h-[420px] overflow-y-auto px-5 py-3 font-mono text-[12px]">
            {data.recent.map((r, i) => (
              <motion.li key={r.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex gap-3 border-b border-dashed border-line/[0.06] py-2.5 last:border-0">
                <span className="w-12 shrink-0 text-muted">{fmtTime(r.createdAt).replace(/\s?[ap]m/i, "")}</span>
                <span className="w-[72px] shrink-0 text-sindoor">{ACTION[r.action] ?? r.action.split(".")[0].toUpperCase()}</span>
                <span className="min-w-0 flex-1 truncate font-sans text-[12.5px] text-text/85">{r.by ?? "system"} · {describe(r)}</span>
              </motion.li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Card title="Top movers" subtitle="By GMV, last 30 days">
          <div className="divide-y divide-line/[0.06]">
            {data.topSkus.map((s, i) => (
              <div key={s.sku} className="flex items-center gap-3 px-5 py-3">
                <span className="w-4 font-mono text-[11px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                <ProductGlyph name={s.name} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px]">{s.name} <span className="text-muted">{[s.size, s.color].filter(Boolean).join(" · ")}</span></div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line/[0.06]"><motion.div className="h-full bg-sindoor" initial={{ width: 0 }} animate={{ width: `${(s.paise / data.topSkus[0].paise) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.08 }} /></div>
                </div>
                <div className="text-right font-mono text-[12px]"><div>{compactINR(s.paise)}</div><div className="text-muted">{s.units} u</div></div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Workforce" subtitle={`${data.teamSummary.present + data.teamSummary.late} on floor · ${data.teamSummary.leave} on leave · ${data.teamSummary.notIn} not in`} action={<Link href="/hr/attendance" className="text-[12px] text-muted hover:text-text">Attendance</Link>}>
          <div className="px-5 pt-4">
            <div className="flex h-2 overflow-hidden rounded-full bg-line/[0.06]">
              {[["bg-leaf", data.teamSummary.present], ["bg-marigold", data.teamSummary.late], ["bg-sky", data.teamSummary.leave]].map(([c, n], i) => (
                <motion.div key={i} className={c as string} initial={{ width: 0 }} animate={{ width: `${((n as number) / Math.max(1, data.teamSummary.total)) * 100}%` }} transition={{ duration: 0.8 }} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 p-3 sm:grid-cols-3 xl:grid-cols-4">
            {data.team.map((t) => (
              <div key={t.employee.id} className="flex items-center gap-2.5 rounded-lg px-2 py-2">
                <div className="relative">
                  <Avatar name={t.employee.name} hue={t.employee.avatarHue} size={30} />
                  <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-panel", t.state === "PRESENT" ? "bg-leaf" : t.state === "LATE" ? "bg-marigold" : t.state === "LEAVE" ? "bg-sky" : "bg-muted/40")} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[12.5px]">{t.employee.name}</div>
                  <div className="font-mono text-[10.5px] text-muted">{t.record?.checkInAt ? `IN ${fmtTime(t.record.checkInAt)}` : t.state === "LEAVE" ? "LEAVE" : "—"}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

const greet = () => {
  const h = Number(new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour: "numeric" }));
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
};
const Calm = ({ text }: { text: string }) => <div className="px-5 py-6 text-center text-[12.5px] text-muted">{text}</div>;
function describe(r: Dash["recent"][number]) {
  const m = r.meta ?? {};
  if (r.action === "orders.import") return `${m.imported ?? ""} orders from ${String(m.channel ?? "").toLowerCase()}`;
  if (m.totalPaise) return formatINR(Number(m.totalPaise), { decimals: false });
  return r.entity.replace(/_/g, " ");
}

function Metric({ label, value, fmt, delta, spark, sub, onClick, tone = "sindoor" }: { label: string; value: number; fmt?: (n: number) => string; delta?: number; spark?: number[]; sub?: string; onClick?: () => void; tone?: "sindoor" | "leaf" }) {
  return (
    <button onClick={onClick} className={cn("px-5 py-4 text-left transition", onClick ? "hover:bg-line/[0.025]" : "cursor-default")}>
      <div className="label">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-[24px] font-medium tracking-tight"><Counter value={value} format={fmt} /></span>
        {delta !== undefined && <span className={cn("font-mono text-[11px]", delta >= 0 ? "text-leaf" : "text-sindoor")}>{delta >= 0 ? "▲" : "▼"}{Math.abs(delta)}%</span>}
      </div>
      {spark ? <Spark data={spark} className="mt-1.5" tone={tone} /> : <div className="mt-1.5 text-[12px] text-muted">{sub}</div>}
      {spark && sub && <div className="text-[11.5px] text-muted">{sub}</div>}
    </button>
  );
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
          <linearGradient id="hub" x1="0" x2="1"><stop offset="0" stopColor="rgb(var(--sindoor))" stopOpacity="0.9" /><stop offset="1" stopColor="rgb(var(--sindoor))" stopOpacity="0.25" /></linearGradient>
        </defs>
        {chanY.map((c, i) => (
          <g key={c.code}>
            <motion.path d={`M${chanX} ${c.y} C ${chanX + 120} ${c.y}, ${hubX - 120} ${mid}, ${hubX} ${mid}`} fill="none" stroke={c.color} strokeOpacity="0.3" strokeWidth={c.h} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: i * 0.08 }} />
            <path d={`M${chanX} ${c.y} C ${chanX + 120} ${c.y}, ${hubX - 120} ${mid}, ${hubX} ${mid}`} fill="none" stroke={c.color} strokeWidth="1.5" strokeDasharray="2 10" className="animate-flow" />
            <rect x={chanX - 6} y={c.y - 9} width="6" height="18" rx="2" fill={c.color} />
            <text x={chanX - 16} y={c.y - 1} textAnchor="end" fontSize="12.5" fill="rgb(var(--text))" fontWeight="500">{c.name}</text>
            <text x={chanX - 16} y={c.y + 12} textAnchor="end" fontSize="10.5" fill="rgb(var(--muted))" fontFamily="var(--font-mono)">{c.n} orders</text>
          </g>
        ))}
        <rect x={hubX} y={mid - 34} width="14" height="68" rx="3" fill="url(#hub)" />
        <text x={hubX + 7} y={mid + 54} textAnchor="middle" fontSize="10" fill="rgb(var(--muted))" fontFamily="var(--font-mono)" letterSpacing="1.5">INTAKE</text>
        {pipeline.map((p, i) => {
          const x = stageX0 + i * stageGap;
          const h = Math.max(8, Math.sqrt(p.n / maxStage) * 150);
          const prevX = i === 0 ? hubX + 14 : stageX0 + (i - 1) * stageGap + 18;
          const hot = p.status === "NEW" && overdue > 0;
          return (
            <g key={p.status} onClick={() => onStage(p.status)} className="cursor-pointer">
              <path d={`M${prevX} ${mid} L${x} ${mid}`} stroke="rgb(var(--line) / 0.15)" strokeWidth="1" />
              <path d={`M${prevX} ${mid} L${x} ${mid}`} stroke="rgb(var(--sindoor))" strokeWidth="1.5" strokeDasharray="3 9" className="animate-flow" />
              <motion.rect x={x} width="18" rx="3" fill={hot ? "rgb(var(--sindoor))" : "rgb(var(--line) / 0.85)"} initial={{ y: mid, height: 0 }} animate={{ y: mid - h / 2, height: h }} transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }} />
              <rect x={x - 30} y={mid - 90} width="78" height="180" fill="transparent" />
              <text x={x + 9} y={mid - h / 2 - 26} textAnchor="middle" fontSize="22" fill="rgb(var(--text))" fontFamily="var(--font-mono)" fontWeight="500">{fmtNum(p.n)}</text>
              <text x={x + 9} y={mid - h / 2 - 10} textAnchor="middle" fontSize="10" fill={hot ? "rgb(var(--sindoor))" : "rgb(var(--muted))"} fontFamily="var(--font-mono)" letterSpacing="1.5">{p.status}</text>
            </g>
          );
        })}
      </svg>
      {/* Phone: compact pipeline */}
      <div className="space-y-2 p-3 md:hidden">
        {pipeline.map((p) => (
          <button key={p.status} onClick={() => onStage(p.status)} className="flex w-full items-center gap-3">
            <span className="w-24 text-left font-mono text-[11px] uppercase tracking-wider text-muted">{p.status}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-line/[0.06]"><span className="block h-full rounded-full bg-sindoor" style={{ width: `${(p.n / maxStage) * 100}%` }} /></span>
            <span className="w-12 text-right font-mono text-[13px]">{fmtNum(p.n)}</span>
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
      <div className="flex h-3 overflow-hidden rounded-full">
        {mix.map((c, i) => <motion.div key={c.code} style={{ background: c.color }} initial={{ width: 0 }} animate={{ width: `${(c.paise / total) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.05 }} />)}
      </div>
      <div className="mt-5 divide-y divide-line/[0.06]">
        {mix.map((c) => (
          <div key={c.code} className="flex items-center gap-3 py-2.5 text-[13px]">
            <span className="h-2 w-2 rounded-[3px]" style={{ background: c.color }} />
            <span className="flex-1">{c.name}</span>
            <span className="font-mono text-[12px] text-muted">{c.n}</span>
            <span className="w-16 text-right font-mono text-[12px]">{compactINR(c.paise)}</span>
            <span className="w-10 text-right font-mono text-[12px] text-muted">{Math.round((c.paise / total) * 100)}%</span>
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
          <div className="label mb-2 flex items-center gap-2"><Boxes className="h-3 w-3" />{z}</div>
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
                  className="relative aspect-square rounded-md border border-line/[0.08] p-1"
                  style={{ background: `rgb(var(--sindoor) / ${0.05 + k * 0.55})` }}
                >
                  <span className="absolute left-1 top-0.5 font-mono text-[8.5px] text-text/70">{b.code}</span>
                  <span className="absolute bottom-0.5 right-1 font-mono text-[9.5px] text-text">{b.units}</span>
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
