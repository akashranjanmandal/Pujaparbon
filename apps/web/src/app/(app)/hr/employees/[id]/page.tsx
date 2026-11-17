"use client";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Phone, Wallet } from "lucide-react";
import { Loader } from "@/components/ui/Loader";
import { Avatar, Card, StatusBadge } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtDate, fmtTime, formatINR } from "@/lib/format";
import type { Employee } from "../page";

interface Detail extends Employee {
  attendance: { id: string; date: string; status: string; checkInAt: string | null; checkOutAt: string | null }[];
  tasks: { id: string; title: string; status: string; dueDate: string; priority: string }[];
  leaves: { id: string; from: string; to: string; days: number; status: string; reason: string; type: string }[];
}
const DOT: Record<string, string> = { PRESENT: "bg-leaf", LATE: "bg-marigold", HALF_DAY: "bg-gold", ABSENT: "bg-sindoor", LEAVE: "bg-sky" };

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: e } = useQuery({ queryKey: ["employee", id], queryFn: () => api.get<Detail>(`/employees/${id}`) });
  if (!e) return <Loader />;
  return (
    <div className="space-y-6">
      <button onClick={() => router.push("/hr/employees")} className="flex items-center gap-2 text-sm text-muted hover:text-text"><ArrowLeft className="h-4 w-4" /> Team</button>
      <Card className="p-7">
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <Avatar name={e.name} hue={e.avatarHue} size={104} />
          <div className="flex-1 text-center sm:text-left">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{e.department} · {e.code}</div>
            <h1 className="mt-1 text-[22px] font-semibold tracking-tight">{e.name}</h1>
            <div className="mt-1 text-muted">{e.designation}</div>
            <div className="mt-3 flex flex-wrap justify-center gap-4 text-sm text-muted sm:justify-start">
              <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" />{e.phone}</span>
              <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />Joined {fmtDate(e.joinDate, { day: "numeric", month: "short", year: "numeric" })}</span>
              <span className="flex items-center gap-1.5"><Wallet className="h-4 w-4" />{formatINR(e.monthlySalaryPaise, { decimals: false })}/month</span>
            </div>
          </div>
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="This month" subtitle="Each bead is a day">
          <div className="flex flex-wrap gap-2 p-5">
            {e.attendance.map((a) => (
              <div key={a.id} title={`${a.date} · ${a.status}${a.checkInAt ? ` · in ${fmtTime(a.checkInAt)}` : ""}`} className="flex flex-col items-center gap-1">
                <span className={cn("h-7 w-7 rounded-full shadow-[0_0_10px_currentColor]", DOT[a.status])} />
                <span className="text-[10px] text-muted">{Number(a.date.slice(8))}</span>
              </div>
            ))}
            {!e.attendance.length && <div className="text-sm text-muted">No attendance yet this month.</div>}
          </div>
        </Card>
        <Card title="Tasks">
          <div className="space-y-2 p-5">
            {e.tasks.map((t) => <div key={t.id} className="flex items-center justify-between rounded-xl bg-panel2/50 px-3 py-2 text-sm"><span>{t.title}<span className="ml-2 text-xs text-muted">due {fmtDate(t.dueDate)}</span></span><StatusBadge status={t.status} /></div>)}
            {!e.tasks.length && <div className="text-sm text-muted">No tasks assigned.</div>}
          </div>
        </Card>
        <Card title="Leave history" className="lg:col-span-2">
          <div className="space-y-2 p-5">
            {e.leaves.map((l) => <div key={l.id} className="flex items-center justify-between rounded-xl bg-panel2/50 px-3 py-2 text-sm"><span>{fmtDate(l.from)} – {fmtDate(l.to)} · {l.days} day(s) · {l.type.toLowerCase()} · <span className="text-muted">{l.reason}</span></span><StatusBadge status={l.status} /></div>)}
            {!e.leaves.length && <div className="text-sm text-muted">No leave taken.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
