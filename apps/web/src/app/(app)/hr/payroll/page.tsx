"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BadgeIndianRupee, FileText, Play, Wallet } from "lucide-react";
import { toPaise } from "@pp/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { Table } from "@/components/ui/Table";
import { Avatar, Button, Card, Input, StatusBadge } from "@/components/ui/primitives";
import { api, openFile } from "@/lib/api";
import { compactINR, formatINR, monthKey } from "@/lib/format";
import { useAction } from "@/lib/hooks";

interface Slip { id: string; employeeId: string; name: string; code: string; designation: string; avatarHue: number; workingDays: number; presentDays: number; paidLeaveDays: number; lateCount: number; payableDays: number; grossPaise: number; advancePaise: number; netPaise: number; status: string }
interface Run { month: string; items: Slip[]; totals: { grossPaise: number; netPaise: number; advancePaise: number; paid: number } }

const prevMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); };

export default function PayrollPage() {
  const [month, setMonth] = useState(prevMonth());
  const [adv, setAdv] = useState<Record<string, string>>({});
  const { data } = useQuery({ queryKey: ["payroll", month], queryFn: () => api.get<Run>(`/payroll?month=${month}`) });
  const run = useAction(() => api.post<Run>("/payroll/run", { month, advances: Object.fromEntries(Object.entries(adv).filter(([, v]) => Number(v)).map(([k, v]) => [k, toPaise(v)])) }), { success: "Payroll calculated from attendance and leave", invalidate: ["payroll"] });
  const paid = useAction((ids: string[]) => api.post("/payroll/mark-paid", { ids }), { success: "Marked as paid", invalidate: ["payroll"] });
  const t = data?.totals;
  const drafts = data?.items.filter((i) => i.status === "DRAFT") ?? [];

  return (
    <div>
      <PageHeader title="Payroll" subtitle="Pay is worked out from attendance: present days plus paid leave, half a day deducted for every three late marks, advances recovered."
        actions={<>
          <Input type="month" value={month} max={monthKey()} onChange={(e) => setMonth(e.target.value)} className="w-44" />
          <Button variant="primary" icon={<Play className="h-4 w-4" />} loading={run.isPending} onClick={() => run.mutate(undefined)}>{data?.items.length ? "Recalculate" : "Run payroll"}</Button>
        </>} />
      {t && data!.items.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Gross earnings" value={t.grossPaise} format={compactINR} icon={<BadgeIndianRupee className="h-5 w-5" />} />
          <Stat label="Advances recovered" value={t.advancePaise} format={compactINR} icon={<Wallet className="h-5 w-5" />} tone="blue" delay={0.05} />
          <Stat label="Net to pay" value={t.netPaise} format={compactINR} icon={<Wallet className="h-5 w-5" />} tone="green" hint={`${t.paid}/${data!.items.length} paid`} delay={0.1} />
        </div>
      )}
      <Card plain className="overflow-hidden" title={`Payslips · ${new Date(`${month}-01`).toLocaleString("en-IN", { month: "long", year: "numeric" })}`} action={drafts.length > 0 && <Button variant="gold" size="sm" loading={paid.isPending} onClick={() => paid.mutate(drafts.map((d) => d.id))}>Mark all {drafts.length} as paid</Button>}>
        <Table rows={data?.items} loading={!data} empty={<div className="py-12 text-center text-sm text-muted">No payroll yet for this month. Press <b>Run payroll</b>.</div>} columns={[
          { key: "e", header: "Employee", cell: (s) => <div className="flex items-center gap-3"><Avatar name={s.name} hue={s.avatarHue} size={32} /><div><div className="font-medium">{s.name}</div><div className="text-xs text-muted">{s.designation}</div></div></div> },
          { key: "d", header: "Days", cell: (s) => <div className="text-xs"><b className="text-sm">{s.payableDays}</b> / {s.workingDays}<div className="text-muted">{s.presentDays} present · {s.paidLeaveDays} leave · {s.lateCount} late</div></div> },
          { key: "g", header: "Gross", align: "right", cell: (s) => <span className="num">{formatINR(s.grossPaise, { decimals: false })}</span> },
          { key: "a", header: "Advance", align: "right", cell: (s) => s.status === "DRAFT" ? <Input type="number" placeholder={String(s.advancePaise / 100 || "")} value={adv[s.employeeId] ?? ""} onChange={(e) => setAdv({ ...adv, [s.employeeId]: e.target.value })} className="ml-auto h-8 w-24 text-right" /> : <span className="text-muted num">{formatINR(s.advancePaise, { decimals: false })}</span> },
          { key: "n", header: "Net pay", align: "right", cell: (s) => <b className="text-[14px] font-semibold num">{formatINR(s.netPaise, { decimals: false })}</b> },
          { key: "s", header: "", cell: (s) => <StatusBadge status={s.status} /> },
          { key: "p", header: "", align: "right", cell: (s) => <Button size="sm" variant="ghost" icon={<FileText className="h-3.5 w-3.5" />} onClick={() => openFile(`/payroll/${s.id}/pdf`)}>Slip</Button> },
        ]} />
      </Card>
    </div>
  );
}
