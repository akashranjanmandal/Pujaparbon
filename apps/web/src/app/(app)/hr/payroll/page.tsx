"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table } from "@/components/ui/Table";
import { Avatar, Card, Input } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { formatINR } from "@pp/shared";
import { monthKey } from "@/lib/format";

interface Row {
  employee: { id: string; name: string; code: string; designation: string; avatarHue: number };
  salaryPaise: number; counts: Record<string, number>; usedBefore: Record<string, number>; paidDays: number; unpaidLeave: number; payablePaise: number;
}
interface Data { month: string; workingDays: number; allowance: Record<string, number>; rows: Row[]; totalPaise: number }

/** Month-end cash to hand over. Owner only: employees never see salary anywhere. */
export default function PayrollPage() {
  const [month, setMonth] = useState(monthKey());
  const { data } = useQuery({ queryKey: ["payroll", month], queryFn: () => api.get<Data>(`/attendance/payroll?month=${month}`) });
  const n = (r: Row, k: string) => r.counts[k] ?? 0;
  return (
    <div className="space-y-6">
      <PageHeader title="Salary" subtitle="Who to pay and how much, worked out from attendance and leave. Paid in cash."
        actions={<Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />} />
      <div className="rounded-2xl bg-primary-soft p-6">
        <div className="text-[15px] font-semibold text-primary">Total to pay for {month}</div>
        <div className="display mt-1 text-[44px] leading-none">{formatINR(data?.totalPaise ?? 0, { decimals: false })}</div>
        <div className="mt-2 text-[14.5px] text-text/70">{data?.workingDays} working days this month (Sundays off). Days not marked are not paid. Late arrivals are paid in full.</div>
      </div>
      <Card title="Each employee" subtitle="Present and leave days come from the attendance register. Mark leave there.">
        <Table
          rows={data?.rows ?? []}
          rowKey={(r) => r.employee.id}
          columns={[
            { key: "n", header: "Employee", cell: (r) => <span className="flex items-center gap-3"><Avatar name={r.employee.name} hue={r.employee.avatarHue} size={34} /><span><b className="block text-[16px]">{r.employee.name}</b><span className="text-[13.5px] text-muted">{r.employee.designation}</span></span></span> },
            { key: "s", header: "Monthly salary", align: "right", cell: (r) => (r.salaryPaise ? formatINR(r.salaryPaise, { decimals: false }) : <span className="text-peach">Not set</span>) },
            { key: "p", header: "Present", align: "right", cell: (r) => n(r, "PRESENT") + n(r, "LATE") + n(r, "HALF_DAY") / 2 },
            { key: "l", header: "Leave taken", cell: (r) => <span className="text-[14px]">CL {n(r, "CL")} · Sick {n(r, "SICK")} · Event {n(r, "EVENT")} · Earned {n(r, "EARNED")}</span> },
            { key: "u", header: "Unpaid days", align: "right", cell: (r) => Math.max(0, (data?.workingDays ?? 0) - r.paidDays) },
            { key: "a", header: "Pay", align: "right", cell: (r) => <b className="text-[18px]">{formatINR(r.payablePaise, { decimals: false })}</b> },
          ]}
        />
      </Card>
      <Card title="Leave left this year" subtitle="Paid days per year are set in Settings.">
        <Table
          rows={data?.rows ?? []}
          rowKey={(r) => r.employee.id}
          columns={[
            { key: "n", header: "Employee", cell: (r) => r.employee.name },
            ...(["CL", "SICK", "EARNED"] as const).map((k) => ({ key: k, header: k === "CL" ? "Casual (CL)" : k === "SICK" ? "Sick" : "Earned", align: "right" as const, cell: (r: Row) => Math.max(0, (data?.allowance[k] ?? 0) - r.usedBefore[k] - n(r, k)) })),
          ]}
        />
      </Card>
    </div>
  );
}
