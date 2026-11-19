"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { Boxes, CalendarCheck, FileSpreadsheet, FileText, Landmark, PackageCheck, ShoppingBasket, Store, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { RangePicker, rangeFor, type RangeValue } from "@/components/ui/RangePicker";
import { Button, Card } from "@/components/ui/primitives";
import { api, download } from "@/lib/api";

const ICON: Record<string, React.ElementType> = { pnl: TrendingUp, buys: ShoppingBasket, stock: Boxes, sales: Store, platforms: PackageCheck, investments: Landmark, attendance: CalendarCheck };

export default function ReportsPage() {
  const { data } = useQuery({ queryKey: ["reports"], queryFn: () => api.get<{ key: string; title: string; ranged: boolean; blurb: string }[]>("/reports") });
  const [range, setRange] = useState<RangeValue>(rangeFor("month"));
  const [busy, setBusy] = useState("");
  const get = async (key: string, format: "xlsx" | "pdf") => {
    setBusy(key + format);
    try { await download(`/reports/${key}?format=${format}&from=${range.from}&to=${range.to}`, `${key}-${range.from}-to-${range.to}.${format}`); } finally { setBusy(""); }
  };
  return (
    <div>
      <PageHeader title="Reports" subtitle="Download any of these as Excel or PDF, for any period you choose. Share them with your accountant or keep them for your records." />
      <RangePicker value={range} onChange={setRange} presets={["week", "month", "lastMonth", "last90", "year"]} className="mb-6" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data?.map((r, i) => {
          const Icon = ICON[r.key] ?? FileText;
          return (
            <motion.div key={r.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="flex h-full flex-col p-6">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-tint text-primary"><Icon className="h-6 w-6" /></span>
                <div className="mt-4 text-[19px] font-semibold">{r.title}</div>
                <p className="mt-1 flex-1 text-[15px] text-muted">{r.blurb}</p>
                {!r.ranged && <p className="mt-2 text-[13.5px] font-medium text-peach">Always as of today</p>}
                <div className="mt-5 flex gap-2">
                  <Button variant="primary" size="sm" icon={<FileSpreadsheet className="h-4 w-4" />} loading={busy === r.key + "xlsx"} onClick={() => get(r.key, "xlsx")}>Excel</Button>
                  <Button size="sm" icon={<FileText className="h-4 w-4" />} loading={busy === r.key + "pdf"} onClick={() => get(r.key, "pdf")}>PDF</Button>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
