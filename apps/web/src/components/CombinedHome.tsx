"use client";
import { useQuery } from "@tanstack/react-query";
import { formatINR } from "@pp/shared";
import { PeriodStrip } from "@/components/PeriodStrip";
import { rangeFor } from "@/components/ui/RangePicker";
import { Card } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";

interface Row { id: string | null; name: string; color: string; revenuePaise: number; profitPaise: number; marginPct: number }
const rs = (n: number) => formatINR(n, { decimals: false });

/** All businesses together: money only. Stock, items, sales and costs stay inside each business. */
export function CombinedHome() {
  const t = useT();
  const r = rangeFor("month");
  const { data } = useQuery({ queryKey: ["accounts", "combined", r.from, r.to], queryFn: () => api.get<{ businesses: Row[] }>(`/accounts?from=${r.from}&to=${r.to}`) });
  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow">{t("All businesses together")}</div>
        <h1 className="display mt-1 text-[34px] leading-tight sm:text-[44px]">{t("Money of all businesses")}</h1>
        <p className="mt-2 max-w-2xl text-[16px] text-muted">{t("Only profit and loss figures are added together here. Each business keeps its own items, stock, sales and costs. To work inside one, switch business from the menu.")}</p>
      </div>
      <PeriodStrip />
      <Card title="This month, business by business">
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {data?.businesses.map((b) => (
            <div key={b.id ?? "x"} className="rounded-2xl border border-line/10 p-4">
              <div className="flex items-center gap-2 font-semibold"><span className="h-3 w-3 rounded-full" style={{ background: b.color }} />{b.name}</div>
              <div className="mt-2 flex items-baseline justify-between text-[15px]"><span className="text-muted">{t("Sales")} {rs(b.revenuePaise)}</span><span className={cn("display text-[24px]", b.profitPaise < 0 ? "text-sindoor" : "text-leaf")}>{rs(b.profitPaise)}</span></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
