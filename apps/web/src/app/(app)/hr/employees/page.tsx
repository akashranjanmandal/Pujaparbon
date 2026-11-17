"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { KeyRound, Phone, UserPlus } from "lucide-react";
import { toPaise } from "@pp/shared";
import { Drawer } from "@/components/ui/Drawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar, Badge, Button, Field, Input, StatusBadge } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtTime, formatINR, todayKey } from "@/lib/format";
import { useAction } from "@/lib/hooks";

export interface Employee { id: string; code: string; name: string; phone: string; designation: string; department: string; joinDate: string; monthlySalaryPaise: number; shiftStart: string; avatarHue: number; active: boolean; todayStatus: string | null; checkInAt: string | null; openTasks: number; hasLogin: boolean }

export default function TeamPage() {
  const { can } = useAuth();
  const [adding, setAdding] = useState(false);
  const { data } = useQuery({ queryKey: ["employees"], queryFn: () => api.get<Employee[]>("/employees") });
  const depts = [...new Set(data?.map((e) => e.department) ?? [])];
  return (
    <div>
      <PageHeader title="Team" subtitle="The people who keep Puja Parbon moving." actions={can("employees.manage") && <Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setAdding(true)}>Add employee</Button>} />
      {depts.map((d) => (
        <div key={d} className="mb-8">
          <div className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted"><span className="h-px w-6 bg-gold/40" />{d}</div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data!.filter((e) => e.department === d).map((e, i) => (
              <motion.div key={e.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -4 }}>
                <Link href={`/hr/employees/${e.id}`} className="paar-card block p-5 text-center transition-shadow hover:shadow-glow">
                  <div className="relative mx-auto w-fit">
                    <Avatar name={e.name} hue={e.avatarHue} size={76} />
                    <span className={`absolute bottom-1 right-1 h-4 w-4 rounded-full ring-4 ring-panel ${e.todayStatus === "PRESENT" ? "bg-leaf" : e.todayStatus === "LATE" ? "bg-marigold" : e.todayStatus === "LEAVE" ? "bg-sky" : "bg-muted/40"}`} />
                  </div>
                  <div className="mt-3 text-[15px] font-semibold">{e.name}</div>
                  <div className="text-xs text-muted">{e.designation} · {e.code}</div>
                  <div className="mt-3 flex justify-center gap-2">
                    {e.todayStatus ? <StatusBadge status={e.todayStatus} /> : <StatusBadge status="NOT_IN" />}
                    {e.openTasks > 0 && <Badge tone="gold">{e.openTasks} tasks</Badge>}
                  </div>
                  <div className="mt-3 text-xs text-muted">{e.checkInAt ? `In at ${fmtTime(e.checkInAt)}` : " "}</div>
                  <div className="mt-3 flex items-center justify-center gap-3 border-t hairline pt-3 text-xs text-muted">
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{e.phone}</span>
                    {e.hasLogin && <span className="flex items-center gap-1 text-leaf"><KeyRound className="h-3 w-3" />App</span>}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      ))}
      {adding && <AddEmployee onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddEmployee({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ name: "", phone: "", designation: "Picker", department: "Warehouse", joinDate: todayKey(), salary: "14000", shiftStart: "10:00" });
  const save = useAction(() => api.post("/employees", { ...f, monthlySalaryPaise: toPaise(f.salary), salary: undefined }), { success: "Welcome to the team!", invalidate: ["employees"], onSuccess: onClose });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Drawer open onClose={onClose} title="Add employee" subtitle="To let them check in from their phone, create a Staff login for them in Settings." footer={<Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>Save</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" className="sm:col-span-2"><Input value={f.name} onChange={set("name")} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={set("phone")} /></Field>
        <Field label="Joined on"><Input type="date" value={f.joinDate} onChange={set("joinDate")} /></Field>
        <Field label="Designation"><Input value={f.designation} onChange={set("designation")} /></Field>
        <Field label="Department"><Input value={f.department} onChange={set("department")} /></Field>
        <Field label="Monthly salary ₹" hint={f.salary ? formatINR(toPaise(f.salary || 0), { decimals: false }) : undefined}><Input type="number" value={f.salary} onChange={set("salary")} /></Field>
        <Field label="Shift starts"><Input type="time" value={f.shiftStart} onChange={set("shiftStart")} /></Field>
      </div>
    </Drawer>
  );
}
