"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { KeyRound, Phone, Smartphone, UserPlus } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar, Badge, Button, Field, Input, StatusBadge } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { fmtTime, todayKey } from "@/lib/format";
import { useAction } from "@/lib/hooks";

interface Employee { id: string; code: string; name: string; phone: string; designation: string; joinDate: string; shiftStart: string; avatarHue: number; active: boolean; todayStatus: string | null; checkInAt: number | null; hasLogin: boolean; hasDevice: boolean }
interface U { id: string; employeeId: string | null; email: string }

export default function EmployeesPage() {
  const [adding, setAdding] = useState(false);
  const [login, setLogin] = useState<Employee | null>(null);
  const { data } = useQuery({ queryKey: ["employees"], queryFn: () => api.get<Employee[]>("/employees") });
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: () => api.get<U[]>("/users") });
  const reset = useAction((id: string) => api.patch(`/users/${id}`, { resetDevice: true }), { success: "Phone reset. They can check in from a new phone.", invalidate: ["employees"] });
  const toggle = useAction(({ id, active }: { id: string; active: boolean }) => api.patch(`/employees/${id}`, { active }), { success: "Updated", invalidate: ["employees", "users"] });
  return (
    <div>
      <PageHeader title="Employees" subtitle="The people who work with you. Give each one a login so they can check in and out from their phone."
        actions={<Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setAdding(true)}>Add an employee</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data?.map((e, i) => {
          const user = users?.find((u) => u.employeeId === e.id);
          return (
            <motion.div key={e.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={`paar-card p-6 ${e.active ? "" : "opacity-60"}`}>
              <div className="flex items-center gap-4">
                <Avatar name={e.name} hue={e.avatarHue} size={60} />
                <div className="min-w-0"><div className="truncate text-[19px] font-semibold">{e.name}</div><div className="text-[14.5px] text-muted">{e.designation}</div>
                  <div className="mt-1.5">{e.active ? (e.todayStatus ? <StatusBadge status={e.todayStatus} /> : <StatusBadge status="NOT_IN" />) : <Badge tone="muted">Left</Badge>}</div></div>
              </div>
              <div className="mt-4 space-y-1.5 text-[14.5px] text-muted">
                <div className="flex items-center gap-2"><Phone className="h-4 w-4" />{e.phone}</div>
                {e.checkInAt && <div>Checked in at {fmtTime(e.checkInAt)}</div>}
                {user && <div className="truncate">Login: <b className="text-text">{user.email}</b></div>}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {!e.hasLogin && e.active && <Button size="sm" icon={<KeyRound className="h-4 w-4" />} onClick={() => setLogin(e)}>Give a login</Button>}
                {e.hasDevice && user && <Button size="sm" icon={<Smartphone className="h-4 w-4" />} onClick={() => reset.mutate(user.id)}>Reset phone</Button>}
                <Button size="sm" variant="ghost" onClick={() => confirm(e.active ? `Mark ${e.name} as left? Their login stops working.` : `Bring ${e.name} back?`) && toggle.mutate({ id: e.id, active: !e.active })}>{e.active ? "Mark as left" : "Bring back"}</Button>
              </div>
            </motion.div>
          );
        })}
      </div>
      {adding && <AddEmployee onClose={() => setAdding(false)} />}
      {login && <GiveLogin employee={login} onClose={() => setLogin(null)} />}
    </div>
  );
}

function AddEmployee({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ name: "", phone: "", designation: "Helper", joinDate: todayKey(), shiftStart: "10:00" });
  const save = useAction(() => api.post("/employees", f), { success: "Added", invalidate: ["employees"], onSuccess: onClose });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Drawer open onClose={onClose} title="Add an employee" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={f.name.length < 2 || f.phone.length < 8} onClick={() => save.mutate(undefined)}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" className="sm:col-span-2"><Input value={f.name} onChange={set("name")} /></Field>
        <Field label="Phone"><Input inputMode="tel" value={f.phone} onChange={set("phone")} /></Field>
        <Field label="Role"><Input value={f.designation} onChange={set("designation")} placeholder="e.g. Helper, Packing" /></Field>
        <Field label="Joined on"><Input type="date" value={f.joinDate} onChange={set("joinDate")} /></Field>
        <Field label="Shift starts"><Input type="time" value={f.shiftStart} onChange={set("shiftStart")} /></Field>
      </div>
    </Drawer>
  );
}

function GiveLogin({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const [f, setF] = useState({ email: "", password: "" });
  const save = useAction(() => api.post("/users", { name: employee.name, email: f.email, password: f.password, role: "STAFF", employeeId: employee.id }), { success: "Login created. Share the password with them privately.", invalidate: ["employees", "users"], onSuccess: onClose });
  return (
    <Drawer open onClose={onClose} title={`Login for ${employee.name}`} subtitle="They use this email and password on their phone to check in and out."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={!f.email || f.password.length < 8} onClick={() => save.mutate(undefined)}>Create login</Button></>}>
      <div className="grid gap-4">
        <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Password" hint="At least 8 characters. You can change it later."><Input type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
      </div>
    </Drawer>
  );
}
