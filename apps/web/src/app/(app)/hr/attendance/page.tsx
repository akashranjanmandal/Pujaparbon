"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { Camera, Clock, MapPin, UserCheck, UserX, Users } from "lucide-react";
import { SelfieImg } from "@/components/SelfieImg";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { Avatar, Card, Input, Segmented, Select, StatusBadge } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtTime, monthKey } from "@/lib/format";
import { useAction } from "@/lib/hooks";

interface BoardItem { employee: { id: string; name: string; code: string; designation: string; avatarHue: number }; record: { id: string; status: string; checkInAt: string | null; checkOutAt: string | null; checkInDistanceM: number | null; checkInSelfie: string | null; source: string } | null; state: string }
interface Board { date: string; items: BoardItem[]; summary: Record<string, number> }
interface Grid { month: string; employees: { id: string; name: string; code: string; avatarHue: number }[]; records: { employeeId: string; date: string; status: string }[]; holidays: { date: string; name: string }[] }

const CELL: Record<string, string> = { PRESENT: "bg-leaf/80", LATE: "bg-marigold/90", HALF_DAY: "bg-gold/60", ABSENT: "bg-sindoor/80", LEAVE: "bg-sky/70" };

export default function AttendancePage() {
  const [tab, setTab] = useState<"today" | "month">("today");
  return (
    <div>
      <PageHeader title="Attendance" subtitle="Check-ins only work inside the warehouse fence, from the staff member's own phone, with a live selfie." actions={<Segmented value={tab} onChange={setTab} options={[{ value: "today", label: "Today, live" }, { value: "month", label: "Month register" }]} />} />
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
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="On time" value={s.present} icon={<UserCheck className="h-5 w-5" />} tone="green" />
          <Stat label="Late" value={s.late} icon={<Clock className="h-5 w-5" />} tone="gold" delay={0.05} />
          <Stat label="On leave" value={s.leave} icon={<Users className="h-5 w-5" />} tone="blue" delay={0.1} />
          <Stat label="Not in yet" value={s.notIn} icon={<UserX className="h-5 w-5" />} tone="red" delay={0.15} />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data?.items.map((i, n) => (
          <motion.div key={i.employee.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: n * 0.04 }} className={cn("paar-card flex items-center gap-4 p-5", i.state === "NOT_IN" && "opacity-70")}>
            <div className="relative">
              <SelfieImg id={i.record?.id ?? ""} has={!!i.record?.checkInSelfie} name={i.employee.name} hue={i.employee.avatarHue} size={64} />
              {i.record?.checkInSelfie && <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-gold text-[#2a1306]"><Camera className="h-3.5 w-3.5" /></span>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{i.employee.name}</div>
              <div className="text-xs text-muted">{i.employee.designation} · {i.employee.code}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <StatusBadge status={i.state} />
                {i.record?.checkInAt && <span className="text-muted">In {fmtTime(i.record.checkInAt)}{i.record.checkOutAt ? ` · Out ${fmtTime(i.record.checkOutAt)}` : ""}</span>}
                {i.record?.checkInDistanceM != null && <span className="flex items-center gap-0.5 text-muted"><MapPin className="h-3 w-3" />{i.record.checkInDistanceM} m</span>}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </>
  );
}

function Month() {
  const [month, setMonth] = useState(monthKey());
  const { data } = useQuery({ queryKey: ["attendance", "month", month], queryFn: () => api.get<Grid>(`/attendance/month?month=${month}`) });
  const mark = useAction((v: { employeeId: string; date: string; status: string }) => api.post("/attendance/manual", v), { success: "Attendance corrected", invalidate: ["attendance"] });
  const [y, m] = month.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const keys = Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  const hol = new Map(data?.holidays.map((h) => [h.date, h.name]));
  const cycle = ["PRESENT", "LATE", "HALF_DAY", "ABSENT", "LEAVE"];
  return (
    <Card title="Month register" subtitle="Click a cell to correct it. Sundays and holidays are shaded." action={<Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />}>
      <div className="overflow-x-auto p-5">
        <table className="border-separate border-spacing-[3px] text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-panel/90 pr-3 text-left font-medium text-muted">Employee</th>
              {keys.map((k) => { const d = new Date(`${k}T00:00:00`); return <th key={k} title={hol.get(k)} className={cn("w-7 font-medium", d.getDay() === 0 || hol.has(k) ? "text-sindoor/70" : "text-muted")}>{d.getDate()}</th>; })}
              <th className="pl-3 text-muted">P</th>
            </tr>
          </thead>
          <tbody>
            {data?.employees.map((e) => {
              const recs = new Map(data.records.filter((r) => r.employeeId === e.id).map((r) => [r.date, r.status]));
              return (
                <tr key={e.id}>
                  <td className="sticky left-0 whitespace-nowrap bg-panel/90 pr-3"><span className="flex items-center gap-2"><Avatar name={e.name} hue={e.avatarHue} size={22} />{e.name}</span></td>
                  {keys.map((k) => {
                    const st = recs.get(k);
                    const off = new Date(`${k}T00:00:00`).getDay() === 0 || hol.has(k);
                    return (
                      <td key={k}>
                        <button title={`${k}${st ? ` · ${st}` : ""}${hol.get(k) ? ` · ${hol.get(k)}` : ""}`} onClick={() => !off && k <= new Date().toISOString().slice(0, 10) && mark.mutate({ employeeId: e.id, date: k, status: cycle[(cycle.indexOf(st ?? "") + 1) % cycle.length] })}
                          className={cn("block h-7 w-7 rounded-md transition hover:scale-110", st ? CELL[st] : off ? "bg-sindoor/10" : "bg-line/[0.07]")} />
                      </td>
                    );
                  })}
                  <td className="pl-3 font-semibold num">{[...recs.values()].filter((s) => s === "PRESENT" || s === "LATE").length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
          {Object.entries(CELL).map(([k, c]) => <span key={k} className="flex items-center gap-1.5"><span className={cn("h-3 w-3 rounded", c)} />{k.replace("_", " ").toLowerCase()}</span>)}
        </div>
      </div>
    </Card>
  );
}
