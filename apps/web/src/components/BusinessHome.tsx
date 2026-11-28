"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, Receipt, ShoppingBasket, Boxes, Scale } from "lucide-react";
import { formatINR } from "@pp/shared";
import { Card } from "@/components/ui/primitives";
import { PeriodStrip } from "@/components/PeriodStrip";
import { api } from "@/lib/api";
import { useActiveBusiness } from "@/lib/business";
import { fmtDate } from "@/lib/format";
import { useT } from "@/lib/i18n";

interface Sale { id: string; date: string; channel: string; totalPaise: number; customer: string | null }

/** The home panel of one business: its own numbers, quick actions and latest sales. */
export function BusinessHome() {
  const { business, id } = useActiveBusiness();
  const t = useT();
  const { data: sales } = useQuery({ queryKey: ["sales", id ?? "", "home"], queryFn: () => api.get<Sale[]>(`/sales?limit=8&businessId=${id}`), enabled: !!id });
  const quick = [{ href: "/sell", label: "New sale", icon: Receipt }, { href: "/buy/new", label: "New buy", icon: ShoppingBasket }, { href: "/stock", label: "Stock", icon: Boxes }, { href: "/accounts", label: "Business accounts", icon: Scale }];
  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow">{t("Business")}</div>
        <h1 className="display mt-1 flex items-center gap-3 text-[34px] leading-tight sm:text-[44px]"><span className="h-4 w-4 rounded-full" style={{ background: business?.color }} />{business?.name}</h1>
      </div>
      <PeriodStrip />
      <div className="grid gap-3 sm:grid-cols-4">
        {quick.map((q) => <Link key={q.href} href={q.href} className="flex items-center gap-3 rounded-2xl border border-line/10 bg-panel p-4 font-semibold shadow-soft transition hover:border-primary"><q.icon className="h-5 w-5 text-primary" />{t(q.label)}<ArrowRight className="ml-auto h-4 w-4 text-muted" /></Link>)}
      </div>
      <Card title="Latest sales" plain>
        <div className="divide-y divide-line/[0.06] px-6 py-2">
          {sales?.length === 0 && <p className="py-4 text-[15px] text-muted">{t("No sales yet. Press New sale.")}</p>}
          {sales?.map((s) => <div key={s.id} className="flex justify-between py-3 text-[15.5px]"><span>{fmtDate(s.date)} · {s.customer ?? t("Walk-in")}</span><b>{formatINR(s.totalPaise, { decimals: false })}</b></div>)}
        </div>
      </Card>
    </div>
  );
}
