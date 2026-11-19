"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Crosshair, MapPinned, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table } from "@/components/ui/Table";
import { Button, Card, Field, Input, Segmented } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { getPosition } from "@/lib/presence";

interface Tenant { name: string; address: string | null; geofenceLat: number; geofenceLng: number; geofenceRadiusM: number; shiftStart: string; shiftEnd: string; lateGraceMin: number; selfieRetentionDays: number }
interface Audit { id: string; action: string; entity: string; createdAt: number; by: string | null }

export default function SettingsPage() {
  const [tab, setTab] = useState<"business" | "password" | "audit">("business");
  return (
    <div>
      <PageHeader title="Settings" subtitle="Your business details, the shop location employees check in from, and your own password."
        actions={<Segmented value={tab} onChange={setTab} options={[{ value: "business", label: "Business" }, { value: "password", label: "My password" }, { value: "audit", label: "Activity log" }]} />} />
      {tab === "business" && <Business />}
      {tab === "password" && <Password />}
      {tab === "audit" && <AuditTrail />}
    </div>
  );
}

function Business() {
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => api.get<Tenant>("/settings") });
  const [f, setF] = useState<Tenant | null>(null);
  const [locating, setLocating] = useState(false);
  useEffect(() => { if (data) setF(data); }, [data]);
  const save = useAction(() => api.put("/settings", { ...f, address: f?.address ?? undefined }), { success: "Settings saved", invalidate: ["settings"] });
  if (!f) return null;
  const set = <K extends keyof Tenant>(k: K, v: Tenant[K]) => setF({ ...f, [k]: v });
  const here = async () => { setLocating(true); try { const p = await getPosition(); setF({ ...f, geofenceLat: +p.lat.toFixed(6), geofenceLng: +p.lng.toFixed(6) }); } catch (e) { alert((e as Error).message); } finally { setLocating(false); } };
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card title="Your business" subtitle="Shown on your reports">
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <Field label="Business name"><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Address"><Input value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
        </div>
      </Card>
      <Card title="Shop location and timings" subtitle="Employees can check in only inside this circle">
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <div className="flex items-center gap-4 rounded-2xl bg-primary-tint p-4 sm:col-span-2">
            <MapPinned className="h-8 w-8 text-primary" />
            <div className="flex-1 text-[15px]"><b>{f.geofenceLat.toFixed(5)}, {f.geofenceLng.toFixed(5)}</b><div className="text-muted">Stand inside the shop and press the button to set the centre.</div></div>
            <Button size="sm" variant="primary" loading={locating} icon={<Crosshair className="h-4 w-4" />} onClick={here}>Use my location</Button>
          </div>
          <Field label="Radius (metres)"><Input type="number" value={f.geofenceRadiusM} onChange={(e) => set("geofenceRadiusM", Number(e.target.value))} /></Field>
          <Field label="Counts as late after (minutes)"><Input type="number" value={f.lateGraceMin} onChange={(e) => set("lateGraceMin", Number(e.target.value))} /></Field>
          <Field label="Work starts"><Input type="time" value={f.shiftStart} onChange={(e) => set("shiftStart", e.target.value)} /></Field>
          <Field label="Work ends"><Input type="time" value={f.shiftEnd} onChange={(e) => set("shiftEnd", e.target.value)} /></Field>
          <Field label="Keep selfies for (days)" hint="Photos are deleted after this. Attendance records stay." className="sm:col-span-2"><Input type="number" value={f.selfieRetentionDays} onChange={(e) => set("selfieRetentionDays", Number(e.target.value))} /></Field>
        </div>
      </Card>
      <div className="xl:col-span-2"><Button variant="primary" size="lg" loading={save.isPending} onClick={() => save.mutate(undefined)}>Save settings</Button></div>
    </div>
  );
}

function Password() {
  const [f, setF] = useState({ current: "", next: "", again: "" });
  const save = useAction(() => api.post("/auth/change-password", { current: f.current, next: f.next }), { success: "Password changed", onSuccess: () => setF({ current: "", next: "", again: "" }) });
  const bad = f.next.length > 0 && (f.next.length < 8 || f.next !== f.again);
  return (
    <Card title="Change your password" subtitle="Use something only you know. Employees have their own logins.">
      <div className="grid max-w-md gap-4 p-6">
        <Field label="Current password"><Input type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></Field>
        <Field label="New password" hint="At least 8 characters"><Input type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
        <Field label="New password again" error={bad && f.again && f.next !== f.again ? "The two passwords do not match" : undefined}><Input type="password" autoComplete="new-password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} /></Field>
        <Button variant="primary" loading={save.isPending} disabled={!f.current || bad || !f.again} onClick={() => save.mutate(undefined)}>Change password</Button>
      </div>
    </Card>
  );
}

function AuditTrail() {
  const { data } = useQuery({ queryKey: ["audit"], queryFn: () => api.get<Audit[]>("/settings/audit") });
  return (
    <Card plain className="overflow-hidden" title="Activity log" subtitle="Every important change, who made it and when. It cannot be edited." action={<ShieldCheck className="h-6 w-6 text-leaf" />}>
      <Table rows={data} loading={!data} columns={[
        { key: "w", header: "When", cell: (a) => <span className="text-muted">{fmtDateTime(a.createdAt)}</span> },
        { key: "b", header: "Who", cell: (a) => a.by ?? "System" },
        { key: "a", header: "What", cell: (a) => <code className="text-[13.5px]">{a.action}</code> },
      ]} />
    </Card>
  );
}
