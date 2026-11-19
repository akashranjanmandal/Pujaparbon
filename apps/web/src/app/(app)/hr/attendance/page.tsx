"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { Camera, Clock, MapPin, UserCheck, UserX } from "lucide-react";
import { SelfieImg } from "@/components/SelfieImg";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar, Card, Input, Segmented, StatusBadge } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtTime, monthKey } from "@/lib/format";
import { useAction } from "@/lib/hooks";

interface Item { employee: { id: string; name: string; code: string; designation: string; avatarHue: number }; record: { id: string; status: string; checkInAt: number | null; checkOutAt: number | null; checkInDistanceM: number | null; hasPhoto: boolean; source: string } | null; state: string }
interface Board { date: string; items: Item[]; summary: { total: number; present: number; late: number; halfDay: number; notIn: number } }
interface Grid { month: string; employees: { id: string; name: string; code: string; avatarHue: number }[]; records: { employeeId: string; date: string; status: string }[] }
const CELL: Record<string, string> = { PRESENT: "bg-leaf", LATE: "bg-peach", HALF_DAY: "bg-lav", ABSENT: "bg-sindoor/80" };

export default function AttendancePage() {
  const [tab, setTab] = useState<"today" | "month">("today");
  return (
    <div>
      <PageHeader title="Attendance" subtitle="Employees check in and out from their own phone, inside your shop's location, with a selfie."
        actions={<Segmented value={tab} onChange={setTab} options={[{ value: "today", label: "Today" }, { value: "month", label: "Month register" }]} />} />
      {tab === "today" ? <Today /> : <Month />}
    </div>
  );
}

function Today() {
  const { data } = useQuery({ queryKey: ["attendance", "today"], queryFn: () => api.get<Board>("/attendance/today"), refetchInterval: 30_000 });
  const s = data?.summary;
  return (
    <>
      {s && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Tile icon={<UserCheck className="h-6 w-6" />} label="Checked in" value={s.present + s.late + s.halfDay} tone="bg-primary-soft text-primary" />
          <Tile icon={<Clock className="h-6 w-6" />} label="Came late" value={s.late} tone="bg-peach-soft text-peach" />
          <Tile icon={<UserX className="h-6 w-6" />} label="Not in yet" value={s.notIn} tone="bg-lav-soft text-lav" />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data?.items.map((i, n) => (
          <motion.div key={i.employee.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: n * 0.04 }} className={cn("paar-card flex items-center gap-4 p-5", i.state === "NOT_IN" && "opacity-75")}>
            <div className="relative">
              <SelfieImg id={i.record?.id ?? ""} has={!!i.record?.hasPhoto} name={i.employee.name} hue={i.employee.avatarHue} size={68} />
              {i.record?.hasPhoto && <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-primary text-white"><Camera className="h-3.5 w-3.5" /></span>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[17px] font-semibold">{i.employee.name}</div>
              <div className="text-[14px] text-muted">{i.employee.designation}</div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5"><StatusBadge status={i.state} />
                {i.record?.checkInAt && <span className="text-[14px] text-muted">In {fmtTime(i.record.checkInAt)}{i.record.checkOutAt ? ` · Out ${fmtTime(i.record.checkOutAt)}` : ""}</span>}
                {i.record?.checkInDistanceM != null && <span className="flex items-center gap-1 text-[14px] text-muted"><MapPin className="h-3.5 w-3.5" />{i.record.checkInDistanceM} m</span>}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </>
  );
}

const Tile = ({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) => (
  <div className={`flex items-center gap-4 rounded-2xl p-5 ${tone}`}>{icon}<div><div className="text-[14px] font-semibold">{label}</div><div className="display text-[34px] leading-none text-text">{value}</div></div></div>
);

function Month() {
  const [month, setMonth] = useState(monthKey());
  const { data } = useQuery({ queryKey: ["attendance", "month", month], queryFn: () => api.get<Grid>(`/attendance/month?month=${month}`) });
  const mark = useAction((v: { employeeId: string; date: string; status: string }) => api.post("/attendance/manual", v), { success: "Corrected", invalidate: ["attendance"] });
  const [y, m] = month.split("-").map(Number);
  const keys = Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  const cycle = ["PRESENT", "LATE", "HALF_DAY", "ABSENT"];
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Card title="Month register" subtitle="Tap a day to correct it. It cycles through present, late, half day and absent." action={<Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />}>
      <div className="overflow-x-auto p-5">
        <table className="border-separate border-spacing-[3px] text-[13.5px]">
          <thead><tr><th className="sticky left-0 bg-panel pr-3 text-left font-semibold text-muted">Employee</th>{keys.map((k) => { const d = new Date(`${k}T00:00:00`); return <th key={k} className={cn("w-8 font-medium", d.getDay() === 0 ? "text-peach" : "text-muted")}>{d.getDate()}</th>; })}<th className="pl-3 font-semibold text-muted">Days</th></tr></thead>
          <tbody>
            {data?.employees.map((e) => {
              const recs = new Map(data.records.filter((r) => r.employeeId === e.id).map((r) => [r.date, r.status]));
              return (
                <tr key={e.id}>
                  <td className="sticky left-0 whitespace-nowrap bg-panel pr-3"><span className="flex items-center gap-2 text-[14.5px] font-medium"><Avatar name={e.name} hue={e.avatarHue} size={26} />{e.name}</span></td>
                  {keys.map((k) => {
                    const st = recs.get(k); const sunday = new Date(`${k}T00:00:00`).getDay() === 0;
                    return <td key={k}><button title={`${k}${st ? ` · ${st}` : ""}`} onClick={() => !sunday && k <= today && mark.mutate({ employeeId: e.id, date: k, status: cycle[(cycle.indexOf(st ?? "") + 1) % cycle.length] })} className={cn("block h-8 w-8 rounded-lg transition hover:scale-110", st ? CELL[st] : sunday ? "bg-peach-tint" : "bg-bg2")} /></td>;
                  })}
                  <td className="pl-3 text-[15px] font-semibold">{[...recs.values()].filter((s) => s === "PRESENT" || s === "LATE").length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-4 flex flex-wrap gap-4 text-[14px] text-muted">{[["Present", "bg-leaf"], ["Late", "bg-peach"], ["Half day", "bg-lav"], ["Absent", "bg-sindoor/80"]].map(([l, c]) => <span key={l} className="flex items-center gap-1.5"><span className={cn("h-3.5 w-3.5 rounded", c)} />{l}</span>)}</div>
      </div>
    </Card>
  );
}
