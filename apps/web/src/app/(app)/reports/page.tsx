"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { Boxes, CalendarCheck, FileSpreadsheet, FileText, Landmark, PackageCheck, Receipt, ShoppingBag, Undo2, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, Card, Field, Input } from "@/components/ui/primitives";
import { download } from "@/lib/api";
import { api } from "@/lib/api";
import { todayKey } from "@/lib/format";

const ICON: Record<string, React.ElementType> = { stock: Boxes, movements: PackageCheck, sales: ShoppingBag, dispatch: Receipt, returns: Undo2, attendance: CalendarCheck, gst: Landmark, payroll: Wallet };
const DESC: Record<string, string> = {
  stock: "Every SKU with bin, on-hand, committed and value at cost.", movements: "Inward, outward, sales, returns and adjustments.", sales: "Every order across all channels.",
  dispatch: "Orders that left the warehouse, with AWB.", returns: "Customer returns and RTOs, with condition.", attendance: "Daily check-in, check-out and distance.",
  gst: "HSN-wise taxable value and tax, B2B split — ready for your CA.", payroll: "Payable days, gross, advances and net pay.",
};

export default function ReportsPage() {
  const { data } = useQuery({ queryKey: ["reports"], queryFn: () => api.get<{ key: string; title: string; ranged: boolean }[]>("/reports") });
  const [from, setFrom] = useState(`${todayKey().slice(0, 7)}-01`);
  const [to, setTo] = useState(todayKey());
  const [busy, setBusy] = useState("");
  const get = async (key: string, format: "xlsx" | "pdf") => {
    setBusy(key + format);
    try { await download(`/reports/${key}?format=${format}&from=${from}&to=${to}`, `pujaparbon-${key}-${from}-to-${to}.${format}`); } finally { setBusy(""); }
  };
  return (
    <div>
      <PageHeader title="Reports" subtitle="Every register you used to keep on paper, as Excel or a branded PDF." actions={<><Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field></>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data?.map((r, i) => {
          const Icon = ICON[r.key] ?? FileText;
          return (
            <motion.div key={r.key} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="flex h-full flex-col p-5">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-line/10 bg-line/[0.04] text-sindoor"><Icon className="h-6 w-6" /></div>
                <div className="mt-4 text-[15px] font-semibold">{r.title}</div>
                <p className="mt-1 flex-1 text-sm text-muted">{DESC[r.key]}</p>
                {!r.ranged && <p className="mt-1 text-xs text-muted">As of today</p>}
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="gold" icon={<FileSpreadsheet className="h-3.5 w-3.5" />} loading={busy === r.key + "xlsx"} onClick={() => get(r.key, "xlsx")}>Excel</Button>
                  <Button size="sm" icon={<FileText className="h-3.5 w-3.5" />} loading={busy === r.key + "pdf"} onClick={() => get(r.key, "pdf")}>PDF</Button>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
