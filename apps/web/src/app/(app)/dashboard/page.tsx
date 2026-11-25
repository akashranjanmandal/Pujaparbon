"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, Boxes, ClipboardCheck, ShoppingBasket, Upload } from "lucide-react";
import { formatINR } from "@pp/shared";
import { GlassTooltip, axis, moneyTick } from "@/components/charts/theme";
import { Loader } from "@/components/ui/Loader";
import { Counter } from "@/components/ui/Stat";
import { Card, Segmented } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { compactINR, fmtDate, timeAgo } from "@/lib/format";
import { monthShort, type Summary } from "@/lib/summary";
import { rangeFor } from "@/components/ui/RangePicker";

interface Home {
  summary: Summary;
  attention: { id: string; level: "critical" | "warning" | "info"; title: string; body: string; href: string }[];
  recent: { trips: { id: string; date: string; title: string | null; place: string | null; totalPaise: number; code: string }[]; reports: { id: string; platformId: string; kind: string; month: string; fileName: string; createdAt: number; rows: number }[] };
  team: { total: number; present: number; late: number; halfDay: number; notIn: number };
  allTimeInvestedPaise: number;
}
type Preset = "month" | "lastMonth" | "last90" | "year";
const LABEL: Record<Preset, string> = { month: "This month", lastMonth: "Last month", last90: "Last 3 months", year: "This year" };
const greet = () => { const h = Number(new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour: "numeric" })); return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening"; };

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [preset, setPreset] = useState<Preset>("month");
  const r = rangeFor(preset);
  const { data, isLoading } = useQuery({ queryKey: ["home", preset], queryFn: () => api.get<Home>(`/insights/home?from=${r.from}&to=${r.to}`), refetchInterval: 60_000 });
  if (isLoading || !data) return <Loader label="Getting your numbers" />;
  const { summary: s, attention, recent, team } = data;
  const t = s.totals;
  const total = Math.max(1, t.netPaise + t.moneyOutPaise);
  const lastCount = s.stock.lastCountAt ? timeAgo(s.stock.lastCountAt) : "never";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="eyebrow">{fmtDate(new Date(), { weekday: "long", day: "numeric", month: "long" })}</div>
          <h1 className="display mt-1 text-[34px] leading-[1.08] sm:text-[44px]">Good {greet()}, {user?.name.split(" ")[0]}<span className="text-peach">.</span></h1>
          <p className="mt-2 text-[16px] text-muted">Here is how the business is doing.</p>
        </div>
        <Segmented value={preset} onChange={setPreset} options={(Object.keys(LABEL) as Preset[]).map((k) => ({ value: k, label: LABEL[k] }))} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.button onClick={() => router.push("/analytics")} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[28px] bg-primary-soft p-7 text-left">
          <Rings className="absolute -right-14 -top-14 text-primary/15" />
          <div className="relative text-[15px] font-semibold text-primary">Profit on items sold</div>
          <div className={cn("display relative mt-3 text-[54px] leading-none sm:text-[62px]", t.profitPaise < 0 && "text-sindoor")}><Counter value={t.profitPaise} format={(n) => (n < 0 ? "−" : "") + compactINR(Math.abs(n))} /></div>
          <div className="relative mt-3 flex flex-wrap items-center gap-3 text-[15px]">
            <span className={cn("rounded-full bg-white/60 px-3 py-1 font-semibold", s.compare.profitPct >= 0 ? "text-leaf" : "text-peach")}>{s.compare.profitPct >= 0 ? "↑" : "↓"} {Math.abs(s.compare.profitPct)}% vs the {s.compare.days} days before</span>
            <span className="text-text/60">{LABEL[preset]}</span>
          </div>
          <Trend s={s} />
        </motion.button>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="rounded-[28px] bg-lav-soft p-7">
          <div className="text-[15px] font-semibold text-lav">Money in and out</div>
          <div className="mt-4 space-y-4">
            <div><div className="flex items-baseline justify-between"><span className="text-[15px] text-text/70">Received from platforms</span><span className="display text-[28px] leading-none">{compactINR(t.netPaise)}</span></div><Bar pct={(t.netPaise / total) * 100} className="bg-lav" /></div>
            <div><div className="flex items-baseline justify-between"><span className="text-[15px] text-text/70">You put in (buys + other)</span><span className="display text-[28px] leading-none">{compactINR(t.moneyOutPaise)}</span></div><Bar pct={(t.moneyOutPaise / total) * 100} className="bg-peach" /></div>
          </div>
          <Link href="/investments" className="mt-5 inline-flex items-center gap-1 text-[14.5px] font-semibold text-lav hover:underline">See everything you put in <ArrowRight className="h-4 w-4" /></Link>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="rounded-[28px] bg-peach-soft p-7">
          <div className="text-[15px] font-semibold text-peach">Stock on the shelf</div>
          <div className="display mt-3 text-[48px] leading-none">{compactINR(s.stock.valuePaise)}</div>
          <div className="mt-2 text-[15px] text-text/70">{s.stock.units.toLocaleString("en-IN")} pieces · at what they cost you</div>
          <div className="mt-5 rounded-xl bg-white/55 px-4 py-3 text-[14.5px]">Last counted <b>{lastCount}</b></div>
          <Link href="/stock?count=1" className="mt-3 inline-flex items-center gap-1 text-[14.5px] font-semibold text-peach hover:underline">Update counts <ArrowRight className="h-4 w-4" /></Link>
        </motion.div>
      </div>

      {/* what he does most */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[
          { href: "/buy/new", icon: ShoppingBasket, label: "New buy", sub: "Record a market trip" },
          { href: "/stock?count=1", icon: ClipboardCheck, label: "Update counts", sub: "Takes two minutes" },
          { href: "/platforms", icon: Upload, label: "Upload a report", sub: "Monthly platform sales" },
        ].map((a, i) => (
          <motion.div key={a.href} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.05 }}>
            <Link href={a.href} className="paar-card flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-tint text-primary"><a.icon className="h-6 w-6" /></span>
              <span><span className="block text-[17px] font-semibold">{a.label}</span><span className="block text-[14px] text-muted">{a.sub}</span></span>
            </Link>
          </motion.div>
        ))}
      </div>

      {attention.length > 0 && (
        <Card title="Needs you" subtitle="Small jobs that keep your numbers true">
          <div className="grid gap-2 px-4 pb-4 md:grid-cols-2">
            {attention.map((a) => (
              <Link key={a.id} href={a.href} className="flex items-start gap-3 rounded-xl bg-bg px-4 py-3.5 transition hover:bg-primary-tint">
                <span className={cn("mt-2 h-2.5 w-2.5 shrink-0 rounded-full", a.level === "critical" ? "bg-sindoor" : a.level === "warning" ? "bg-peach" : "bg-primary")} />
                <span><span className="block text-[16px] font-semibold">{a.title}</span><span className="block text-[14px] text-muted">{a.body}</span></span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card title="Received from platforms" subtitle="Month by month">
          <div className="h-[260px] px-2 pb-4 pt-2">
            <ResponsiveContainer>
              <AreaChart data={s.trend.map((x) => ({ ...x, label: monthShort(x.month) }))} margin={{ left: 4, right: 14, top: 8 }}>
                <defs><linearGradient id="home-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgb(var(--primary))" stopOpacity={0.25} /><stop offset="100%" stopColor="rgb(var(--primary))" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="rgb(var(--line) / 0.06)" vertical={false} />
                <XAxis dataKey="label" {...axis} />
                <YAxis {...axis} tickFormatter={moneyTick} width={56} />
                <Tooltip content={<GlassTooltip />} />
                <Area type="monotone" dataKey="netPaise" name="Received" stroke="rgb(var(--primary))" strokeWidth={2.4} fill="url(#home-g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Platforms" subtitle="Profit in this period">
          <div className="space-y-4 p-6">
            {s.platforms.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ background: p.color }} /><span className="flex-1 text-[16px] font-medium">{p.name}</span>
                <span className="text-[14px] text-muted">{p.orders} orders</span><span className="w-20 text-right text-[16px] font-semibold">{compactINR(p.profitPaise)}</span>
              </div>
            ))}
            {!s.platforms.length && <p className="py-4 text-center text-[15px] text-muted">No platform sales in this period.</p>}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Latest buys" action={<Link href="/buy" className="text-[14.5px] font-semibold text-primary hover:underline">All</Link>}>
          <div className="px-3 pb-3">
            {recent.trips.map((x) => (
              <Link key={x.id} href={`/buy/${x.id}`} className="flex items-center justify-between rounded-xl px-3 py-3 transition hover:bg-bg2"><span><span className="block text-[15.5px] font-semibold">{x.place || x.title || "Buying trip"}</span><span className="text-[13.5px] text-muted">{fmtDate(x.date)}</span></span><b>{compactINR(x.totalPaise)}</b></Link>
            ))}
            {!recent.trips.length && <p className="px-3 py-6 text-center text-[15px] text-muted">No buys yet.</p>}
          </div>
        </Card>
        <Card title="Latest uploads" action={<Link href="/platforms" className="text-[14.5px] font-semibold text-primary hover:underline">Platforms</Link>}>
          <div className="px-3 pb-3">
            {recent.reports.map((x) => (
              <Link key={x.id} href={`/platforms/${x.platformId}`} className="block rounded-xl px-3 py-3 transition hover:bg-bg2"><span className="block truncate text-[15.5px] font-semibold">{x.fileName}</span><span className="text-[13.5px] text-muted">{x.kind === "SALES" ? `${x.rows} sales` : "Invoice"} · {timeAgo(x.createdAt)}</span></Link>
            ))}
            {!recent.reports.length && <p className="px-3 py-6 text-center text-[15px] text-muted">Nothing uploaded yet.</p>}
          </div>
        </Card>
        <Card title="Your team today" action={<Link href="/hr/attendance" className="text-[14.5px] font-semibold text-primary hover:underline">Attendance</Link>}>
          <div className="space-y-3 p-6">
            <div className="display text-[44px] leading-none">{team.present + team.late + team.halfDay}<span className="text-[22px] text-muted"> of {team.total}</span></div>
            <div className="text-[15px] text-muted">checked in{team.late ? ` · ${team.late} late` : ""}{team.notIn ? ` · ${team.notIn} not in yet` : ""}</div>
            <div className="flex h-3 overflow-hidden rounded-full bg-bg2">
              <div className="bg-leaf" style={{ width: `${(team.present / Math.max(1, team.total)) * 100}%` }} /><div className="bg-peach" style={{ width: `${(team.late / Math.max(1, team.total)) * 100}%` }} />
            </div>
          </div>
        </Card>
      </div>
      <p className="text-center text-[13.5px] text-muted">All time you have put {formatINR(data.allTimeInvestedPaise, { decimals: false })} into buying stock. <Boxes className="mb-0.5 inline h-3.5 w-3.5" /></p>
    </div>
  );
}

const Bar = ({ pct, className }: { pct: number; className: string }) => (
  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/50"><motion.div className={cn("h-full rounded-full", className)} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9 }} /></div>
);

function Trend({ s }: { s: Summary }) {
  const d = s.trend.map((x) => x.profitPaise);
  if (d.length < 2) return null;
  const w = 300, h = 54, max = Math.max(...d), min = Math.min(...d), span = max - min || 1;
  const pts = d.map((v, i) => `${(i / (d.length - 1)) * w},${h - ((v - min) / span) * (h - 8) - 4}`).join(" ");
  return <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="relative mt-5 h-14 w-full" aria-hidden><polyline points={pts} fill="none" stroke="rgb(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>;
}

const Rings = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 200" width="240" height="240" className={className} aria-hidden>{[90, 70, 50, 30].map((r) => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="currentColor" strokeWidth="14" />)}</svg>
);
