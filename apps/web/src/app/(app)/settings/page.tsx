"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Crosshair, KeyRound, MapPinned, ShieldCheck, Smartphone, UserPlus } from "lucide-react";
import { INDIAN_STATES, ROLES } from "@pp/shared";
import { Drawer } from "@/components/ui/Drawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table } from "@/components/ui/Table";
import { Badge, Button, Card, Field, Input, Segmented, Select } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDateTime, timeAgo } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { getPosition } from "@/lib/presence";
import type { Employee } from "../hr/employees/page";

interface Tenant { name: string; gstin: string | null; address: string | null; state: string; geofenceLat: number; geofenceLng: number; geofenceRadiusM: number; shiftStart: string; shiftEnd: string; lateGraceMin: number; selfieRetentionDays: number }
interface U { id: string; name: string; email: string; role: string; active: boolean; hasDevice: boolean; lastLoginAt: string | null; employeeName: string | null }
interface Audit { id: string; action: string; entity: string; createdAt: string; by: string | null }

export default function SettingsPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<"business" | "people" | "audit">("business");
  return (
    <div>
      <PageHeader title="Settings" subtitle="Your business details, the attendance fence, and who can sign in."
        actions={<Segmented value={tab} onChange={setTab} options={[{ value: "business", label: "Business & fence" }, ...(can("users.manage") ? [{ value: "people" as const, label: "Logins" }] : []), { value: "audit", label: "Audit trail" }]} />} />
      {tab === "business" && <Business />}
      {tab === "people" && <Logins />}
      {tab === "audit" && <AuditTrail />}
    </div>
  );
}

function Business() {
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => api.get<Tenant>("/settings") });
  const [f, setF] = useState<Tenant | null>(null);
  const [locating, setLocating] = useState(false);
  useEffect(() => { if (data) setF(data); }, [data]);
  const save = useAction(() => api.put("/settings", { ...f, gstin: f?.gstin ?? undefined, address: f?.address ?? undefined }), { success: "Settings saved", invalidate: ["settings", "me"] });
  if (!f) return null;
  const set = <K extends keyof Tenant>(k: K, v: Tenant[K]) => setF({ ...f, [k]: v });
  const here = async () => {
    setLocating(true);
    try { const p = await getPosition(); setF({ ...f, geofenceLat: +p.lat.toFixed(6), geofenceLng: +p.lng.toFixed(6) }); } catch (e) { alert((e as Error).message); } finally { setLocating(false); }
  };
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card title="Business" subtitle="Printed on invoices, payslips and reports">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Business name"><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="GSTIN"><Input value={f.gstin ?? ""} onChange={(e) => set("gstin", e.target.value.toUpperCase())} /></Field>
          <Field label="Address" className="sm:col-span-2"><Input value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
          <Field label="State" hint="Decides CGST+SGST vs IGST on invoices"><Select value={f.state} onChange={(e) => set("state", e.target.value)}>{INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        </div>
      </Card>
      <Card title="Attendance fence & shift" subtitle="Staff can only check in within this circle around the warehouse">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="flex items-center gap-4 rounded-2xl border border-gold/20 bg-gold/[0.06] p-4 sm:col-span-2">
            <MapPinned className="h-8 w-8 text-gold" />
            <div className="flex-1 text-sm"><b>{f.geofenceLat.toFixed(5)}, {f.geofenceLng.toFixed(5)}</b><div className="text-muted">Stand in the middle of the warehouse and tap the button to set the centre.</div></div>
            <Button variant="gold" size="sm" loading={locating} icon={<Crosshair className="h-4 w-4" />} onClick={here}>Use my location</Button>
          </div>
          <Field label="Radius (metres)"><Input type="number" value={f.geofenceRadiusM} onChange={(e) => set("geofenceRadiusM", Number(e.target.value))} /></Field>
          <Field label="Late after (minutes grace)"><Input type="number" value={f.lateGraceMin} onChange={(e) => set("lateGraceMin", Number(e.target.value))} /></Field>
          <Field label="Shift starts"><Input type="time" value={f.shiftStart} onChange={(e) => set("shiftStart", e.target.value)} /></Field>
          <Field label="Shift ends"><Input type="time" value={f.shiftEnd} onChange={(e) => set("shiftEnd", e.target.value)} /></Field>
          <Field label="Keep selfies for (days)" hint="Deleted after this, per DPDP Act guidance" className="sm:col-span-2"><Input type="number" value={f.selfieRetentionDays} onChange={(e) => set("selfieRetentionDays", Number(e.target.value))} /></Field>
        </div>
      </Card>
      <div className="xl:col-span-2"><Button variant="primary" size="lg" loading={save.isPending} onClick={() => save.mutate(undefined)}>Save settings</Button></div>
    </div>
  );
}

function Logins() {
  const { data } = useQuery({ queryKey: ["users"], queryFn: () => api.get<U[]>("/users") });
  const [adding, setAdding] = useState(false);
  const upd = useAction(({ id, body }: { id: string; body: object }) => api.patch(`/users/${id}`, body), { success: "Login updated", invalidate: ["users"] });
  return (
    <Card plain className="overflow-hidden" title="Who can sign in" subtitle="Passwords are hashed with Argon2id; nobody, including GOBT, can read them." action={<Button variant="primary" size="sm" icon={<UserPlus className="h-4 w-4" />} onClick={() => setAdding(true)}>New login</Button>}>
      <Table rows={data} loading={!data} columns={[
        { key: "n", header: "Person", cell: (u) => <div><div className="font-medium">{u.name}</div><div className="text-xs text-muted">{u.email}</div></div> },
        { key: "r", header: "Role", cell: (u) => <Badge tone={u.role === "OWNER" ? "red" : u.role === "MANAGER" ? "gold" : "blue"}>{u.role.toLowerCase()}</Badge> },
        { key: "e", header: "Employee", cell: (u) => <span className="text-muted">{u.employeeName ?? "—"}</span> },
        { key: "d", header: "Phone", cell: (u) => u.hasDevice ? <span className="flex items-center gap-1 text-xs text-leaf"><Smartphone className="h-3.5 w-3.5" />Registered</span> : <span className="text-xs text-muted">None</span> },
        { key: "l", header: "Last sign-in", cell: (u) => <span className="text-xs text-muted">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "Never"}</span> },
        { key: "a", header: "", align: "right", cell: (u) => (
          <div className="flex justify-end gap-1">
            {u.hasDevice && <Button size="sm" variant="ghost" onClick={() => upd.mutate({ id: u.id, body: { resetDevice: true } })}>Reset phone</Button>}
            <Button size="sm" variant={u.active ? "danger" : "outline"} onClick={() => upd.mutate({ id: u.id, body: { active: !u.active } })}>{u.active ? "Disable" : "Enable"}</Button>
          </div>
        ) },
      ]} />
      {adding && <NewLogin onClose={() => setAdding(false)} />}
    </Card>
  );
}

function NewLogin({ onClose }: { onClose: () => void }) {
  const { data: emps } = useQuery({ queryKey: ["employees"], queryFn: () => api.get<Employee[]>("/employees") });
  const [f, setF] = useState({ name: "", email: "", password: "", role: "STAFF", employeeId: "" });
  const save = useAction(() => api.post("/users", { ...f, employeeId: f.employeeId || undefined }), { success: "Login created — share the password privately", invalidate: ["users", "employees"], onSuccess: onClose });
  return (
    <Drawer open onClose={onClose} title="New login" footer={<Button variant="primary" loading={save.isPending} icon={<KeyRound className="h-4 w-4" />} onClick={() => save.mutate(undefined)}>Create login</Button>}>
      <div className="grid gap-4">
        <Field label="Role"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{r.toLowerCase()}</option>)}</Select></Field>
        <Field label="Link to employee" hint="Required for staff — needed for attendance">
          <Select value={f.employeeId} onChange={(e) => { const emp = emps?.find((x) => x.id === e.target.value); setF({ ...f, employeeId: e.target.value, name: emp?.name ?? f.name }); }}>
            <option value="">None</option>{emps?.filter((e) => !e.hasLogin).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
        </Field>
        <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Temporary password" hint="At least 8 characters"><Input type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
      </div>
    </Drawer>
  );
}

function AuditTrail() {
  const { data } = useQuery({ queryKey: ["audit"], queryFn: () => api.get<Audit[]>("/settings/audit") });
  return (
    <Card plain className="overflow-hidden" title="Audit trail" subtitle="Every important change, who made it and when. It cannot be edited." action={<ShieldCheck className="h-5 w-5 text-leaf" />}>
      <Table rows={data} loading={!data} columns={[
        { key: "w", header: "When", cell: (a) => <span className="text-muted">{fmtDateTime(a.createdAt)}</span> },
        { key: "b", header: "Who", cell: (a) => a.by ?? "System" },
        { key: "a", header: "Action", cell: (a) => <code className="text-xs text-gold">{a.action}</code> },
        { key: "e", header: "On", cell: (a) => <span className="text-muted">{a.entity}</span> },
      ]} />
    </Card>
  );
}
