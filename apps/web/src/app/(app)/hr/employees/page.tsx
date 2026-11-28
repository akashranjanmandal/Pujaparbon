"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { KeyRound, Pencil, Phone, ShieldCheck, Smartphone, Trash2, UserPlus } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar, Badge, Button, Field, Input, StatusBadge } from "@/components/ui/primitives";
import { ASSIGNABLE_PERMISSIONS, PERMISSION_LABELS, formatINR } from "@pp/shared";
import { api } from "@/lib/api";
import { paise, rupeeStr } from "@/lib/money";
import { fmtTime, todayKey } from "@/lib/format";
import { BusinessSelect } from "@/components/BusinessSelect";
import { useAction, useBusinesses } from "@/lib/hooks";

interface Employee { id: string; code: string; name: string; phone: string; designation: string; joinDate: string; shiftStart: string; salaryPaise: number; businessId?: string | null; avatarHue: number; active: boolean; todayStatus: string | null; checkInAt: number | null; hasLogin: boolean; hasDevice: boolean }
interface U { id: string; employeeId: string | null; email: string; roleId: string | null }
interface RoleRow { id: string; name: string; permissions: string[] }

export default function EmployeesPage() {
  const [adding, setAdding] = useState(false);
  const [login, setLogin] = useState<Employee | null>(null);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [roles, setRoles] = useState(false);
  const { data: roleList } = useQuery({ queryKey: ["roles"], queryFn: () => api.get<RoleRow[]>("/roles") });
  const { data } = useQuery({ queryKey: ["employees"], queryFn: () => api.get<Employee[]>("/employees") });
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: () => api.get<U[]>("/users") });
  const reset = useAction((id: string) => api.patch(`/users/${id}`, { resetDevice: true }), { success: "Phone reset. They can check in from a new phone.", invalidate: ["employees"] });
  const toggle = useAction(({ id, active }: { id: string; active: boolean }) => api.patch(`/employees/${id}`, { active }), { success: "Updated", invalidate: ["employees", "users"] });
  return (
    <div>
      <PageHeader title="Employees" subtitle="The people who work with you. Give each one a login so they can check in and out from their phone."
        actions={<><Button icon={<ShieldCheck className="h-4 w-4" />} onClick={() => setRoles(true)}>Roles and access</Button><Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setAdding(true)}>Add an employee</Button></>} />
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
                <div>Salary: <b className="text-text">{e.salaryPaise ? `${formatINR(e.salaryPaise, { decimals: false })} a month` : "not set"}</b></div>
                {user && <div className="truncate">Login: <b className="text-text">{user.email}</b>{user.roleId && roleList ? ` · ${roleList.find((x) => x.id === user.roleId)?.name ?? ""}` : ""}</div>}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(e)}>Edit</Button>
                {!e.hasLogin && e.active && <Button size="sm" icon={<KeyRound className="h-4 w-4" />} onClick={() => setLogin(e)}>Give a login</Button>}
                {e.hasDevice && user && <Button size="sm" icon={<Smartphone className="h-4 w-4" />} onClick={() => reset.mutate(user.id)}>Reset phone</Button>}
                <Button size="sm" variant="ghost" onClick={() => confirm(e.active ? `Mark ${e.name} as left? Their login stops working.` : `Bring ${e.name} back?`) && toggle.mutate({ id: e.id, active: !e.active })}>{e.active ? "Mark as left" : "Bring back"}</Button>
              </div>
            </motion.div>
          );
        })}
      </div>
      {adding && <EmployeeForm onClose={() => setAdding(false)} />}
      {editing && <EmployeeForm employee={editing} onClose={() => setEditing(null)} />}
      {roles && <Roles onClose={() => setRoles(false)} />}
      {login && <GiveLogin employee={login} onClose={() => setLogin(null)} />}
    </div>
  );
}

function EmployeeForm({ employee, onClose }: { employee?: Employee; onClose: () => void }) {
  const [f, setF] = useState({ name: employee?.name ?? "", phone: employee?.phone ?? "", designation: employee?.designation ?? "Helper", joinDate: employee?.joinDate ?? todayKey(), shiftStart: employee?.shiftStart ?? "10:00", salary: employee?.salaryPaise ? rupeeStr(employee.salaryPaise) : "", businessId: employee?.businessId ?? "" });
  const { data: biz } = useBusinesses();
  const body = () => ({ name: f.name, phone: f.phone, designation: f.designation, joinDate: f.joinDate, shiftStart: f.shiftStart, salaryPaise: paise(f.salary), businessId: f.businessId || null });
  const save = useAction(() => (employee ? api.patch(`/employees/${employee.id}`, body()) : api.post("/employees", body())), { success: employee ? "Saved" : "Added", invalidate: ["employees"], onSuccess: onClose });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Drawer open onClose={onClose} title={employee ? `Edit ${employee.name}` : "Add an employee"} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={f.name.length < 2 || f.phone.length < 8} onClick={() => save.mutate(undefined)}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" className="sm:col-span-2"><Input value={f.name} onChange={set("name")} /></Field>
        <Field label="Phone"><Input inputMode="tel" value={f.phone} onChange={set("phone")} /></Field>
        <Field label="Job title"><Input value={f.designation} onChange={set("designation")} placeholder="e.g. Helper, Packing" /></Field>
        <Field label="Joined on"><Input type="date" value={f.joinDate} onChange={set("joinDate")} /></Field>
        <Field label="Works for" hint="This business's accounts carry the salary." className="sm:col-span-2"><BusinessSelect value={f.businessId} onChange={(v) => setF({ ...f, businessId: v })} list={biz} none="Not assigned to a business" /></Field>
        <Field label="Monthly salary (₹)" hint="Paid in cash. Only you can see this." className="sm:col-span-2"><Input inputMode="decimal" value={f.salary} onChange={set("salary")} placeholder="e.g. 12000" /></Field>
        <Field label="Shift starts"><Input type="time" value={f.shiftStart} onChange={set("shiftStart")} /></Field>
      </div>
    </Drawer>
  );
}

function GiveLogin({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const [f, setF] = useState({ email: "", password: "", roleId: "" });
  const { data: roles } = useQuery({ queryKey: ["roles"], queryFn: () => api.get<RoleRow[]>("/roles") });
  const save = useAction(() => api.post("/users", { name: employee.name, email: f.email, password: f.password, role: "STAFF", employeeId: employee.id, roleId: f.roleId || undefined }), { success: "Login created. Share the password with them privately.", invalidate: ["employees", "users"], onSuccess: onClose });
  return (
    <Drawer open onClose={onClose} title={`Login for ${employee.name}`} subtitle="They use this email and password on their phone to check in and out."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={!f.email || f.password.length < 8} onClick={() => save.mutate(undefined)}>Create login</Button></>}>
      <div className="grid gap-4">
        <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Password" hint="At least 8 characters. You can change it later."><Input type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <Field label="What can they see?" hint="Everyone can check in and out. Pick a role to also show the packing page. Roles are made under Roles and access."><select value={f.roleId} onChange={(e) => setF({ ...f, roleId: e.target.value })} className="h-11 w-full rounded-xl border border-line/20 bg-panel px-3 text-[16px]"><option value="">Check in and out only</option>{roles?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
      </div>
    </Drawer>
  );
}

/** The owner makes up roles (e.g. "Packing team") and chooses what each one can see. Money screens are never offered. */
function Roles({ onClose }: { onClose: () => void }) {
  const { data } = useQuery({ queryKey: ["roles"], queryFn: () => api.get<RoleRow[]>("/roles") });
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<string[]>(["packaging.view"]);
  const add = useAction(() => api.post("/roles", { name, permissions: perms }), { success: "Role added", invalidate: ["roles"], onSuccess: () => setName("") });
  const toggle = useAction(({ r, p }: { r: RoleRow; p: string }) => api.put(`/roles/${r.id}`, { name: r.name, permissions: r.permissions.includes(p) ? r.permissions.filter((x) => x !== p) : [...r.permissions, p] }), { invalidate: ["roles"] });
  const del = useAction((id: string) => api.del(`/roles/${id}`), { success: "Role removed", invalidate: ["roles"] });
  const Checks = ({ value, on }: { value: string[]; on: (p: string) => void }) => (
    <div className="mt-2 space-y-2">{ASSIGNABLE_PERMISSIONS.map((p) => <label key={p} className="flex items-start gap-3 text-[15px]"><input type="checkbox" className="mt-1 h-5 w-5" checked={value.includes(p)} onChange={() => on(p)} />{PERMISSION_LABELS[p]}</label>)}</div>
  );
  return (
    <Drawer open onClose={onClose} title="Roles and access" subtitle="Every employee can check in and out. A role adds what else they can see. Money, platforms, reports and salary are only for you.">
      <div className="space-y-5">
        {data?.map((r) => (
          <div key={r.id} className="rounded-2xl border border-line/10 p-4">
            <div className="flex items-center justify-between"><b className="text-[17px]">{r.name}</b><button onClick={() => confirm(`Delete the role ${r.name}?`) && del.mutate(r.id)} className="text-muted hover:text-sindoor" aria-label="Delete role"><Trash2 className="h-4 w-4" /></button></div>
            <Checks value={r.permissions} on={(p) => toggle.mutate({ r, p })} />
          </div>
        ))}
        <div className="rounded-2xl bg-primary-tint p-4">
          <b className="text-[16px]">Make a new role</b>
          <Field label="Name" className="mt-3"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Packing team" /></Field>
          <Checks value={perms} on={(p) => setPerms((c) => (c.includes(p) ? c.filter((x) => x !== p) : [...c, p]))} />
          <Button variant="primary" className="mt-4" loading={add.isPending} disabled={name.trim().length < 2} onClick={() => add.mutate(undefined)}>Add role</Button>
        </div>
      </div>
    </Drawer>
  );
}
