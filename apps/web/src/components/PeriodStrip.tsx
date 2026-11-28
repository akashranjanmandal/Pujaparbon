"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { formatINR } from "@pp/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { useActiveBusiness } from "@/lib/business";
import { rangeFor } from "@/components/ui/RangePicker";

interface Row { revenuePaise: number; profitPaise: number; marginPct: number }
interface Acc { total: Row; businesses: (Row & { id: string | null })[] }
interface Gst { netPaise: number }
const PERIODS = [["today", "Today"], ["month", "This month"], ["year", "This year"]] as const;
const rs = (n: number) => formatINR(n, { decimals: false });

/** Sales, profit, margin and GST across every business, for today, this month and this year. */
export function PeriodStrip() {
  const { user } = useAuth();
  const { id } = useActiveBusiness();
  const can = user?.permissions.includes("accounts.view");
  const q = (p: (typeof PERIODS)[number][0]) => {
    const r = rangeFor(p);
    return { acc: useQuery({ queryKey: ["accounts", "strip", p, r.from, r.to], queryFn: () => api.get<Acc>(`/accounts?from=${r.from}&to=${r.to}`), enabled: !!can }), gst: useQuery({ queryKey: ["accounts", "gst", "strip", p, r.from, r.to], queryFn: () => api.get<Gst>(`/accounts/gst?from=${r.from}&to=${r.to}`), enabled: !!can }) };
  };
  const data = { today: q("today"), month: q("month"), year: q("year") };
  if (!can) return null;
  return (
    <Link href="/accounts" className="grid gap-3 sm:grid-cols-3">
      {PERIODS.map(([k, label]) => {
        const acc = data[k].acc.data, a = id ? acc?.businesses.find((b) => b.id === id) : acc?.total, g = data[k].gst.data;
        return (
          <div key={k} className="rounded-2xl border border-line/10 bg-panel p-5">
            <div className="text-[14px] font-semibold text-muted">{label}</div>
            <div className="mt-1 flex items-baseline gap-2"><span className="display text-[28px] leading-none">{rs(a?.revenuePaise ?? 0)}</span><span className="text-[13.5px] text-muted">sales</span></div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[14.5px]">
              <span className={cn("font-semibold", (a?.profitPaise ?? 0) < 0 ? "text-sindoor" : "text-leaf")}>Profit {rs(a?.profitPaise ?? 0)} ({a?.marginPct ?? 0}%)</span>
              <span className="text-muted">{(g?.netPaise ?? 0) > 0 ? "GST to pay" : "GST credit"} {rs(Math.abs(g?.netPaise ?? 0))}</span>
            </div>
          </div>
        );
      })}
    </Link>
  );
}
