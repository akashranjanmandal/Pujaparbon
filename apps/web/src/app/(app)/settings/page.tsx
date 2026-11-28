"use client";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Crosshair, MapPinned, ShieldCheck, Store } from "lucide-react";
import { BUSINESS_KINDS, LOCATION_KINDS, WEEKDAYS } from "@pp/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table } from "@/components/ui/Table";
import { Badge, Button, Card, Field, Input, Segmented, Select } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { useAction, useBusinesses } from "@/lib/hooks";
import type { Place } from "@/lib/types";
import { getPosition } from "@/lib/presence";

interface Tenant { name: string; address: string | null; geofenceLat: number; geofenceLng: number; geofenceRadiusM: number; shiftStart: string; shiftEnd: string; lateGraceMin: number; selfieRetentionDays: number; leaveCl: number; leaveSick: number; leaveEarned: number }
interface Audit { id: string; action: string; entity: string; createdAt: number; by: string | null }

export default function SettingsPage() {
  const [tab, setTab] = useState<"business" | "units" | "password" | "audit">("business");
  return (
    <div>
      <PageHeader title="Settings" subtitle="Your business details, the shop location employees check in from, and your own password."
        actions={<Segmented value={tab} onChange={setTab} options={[{ value: "business", label: "Business" }, { value: "units", label: "Businesses & places" }, { value: "password", label: "My password" }, { value: "audit", label: "Activity log" }]} />} />
      {tab === "business" && <Business />}
      {tab === "units" && <Units />}
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
          <Field label="Casual leave per year (CL)" hint="Paid days off for each employee."><Input type="number" value={f.leaveCl} onChange={(e) => set("leaveCl", Number(e.target.value))} /></Field>
          <Field label="Sick leave per year"><Input type="number" value={f.leaveSick} onChange={(e) => set("leaveSick", Number(e.target.value))} /></Field>
          <Field label="Earned leave per year"><Input type="number" value={f.leaveEarned} onChange={(e) => set("leaveEarned", Number(e.target.value))} /></Field>
          <p className="self-end pb-2 text-[14px] text-muted">Event leave is always paid. Leave beyond these days is unpaid.</p>
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

const KIND_LABEL: Record<string, string> = { CLAY: "Clay & puja", FISH: "Dried fish", MELA: "Mela & fair", PAINT: "Painting & wholesale", ONLINE: "Online", SHOP: "Shop", HAAT: "Haat", WAREHOUSE: "Warehouse" };
const DAY_LABEL: Record<string, string> = { SUN: "Sun", MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri", SAT: "Sat" };

/** The family's businesses, and the shops, haats, melas and warehouses where goods are kept or sold. */
function Units() {
  const { data: biz } = useBusinesses();
  // Places are listed one business at a time, since each business keeps its own.
  const placeLists = useQueries({ queries: (biz ?? []).map((b) => ({ queryKey: ["places", b.id], queryFn: () => api.get<Place[]>(`/locations?businessId=${b.id}`) })) });
  const places = placeLists.flatMap((q) => q.data ?? []);
  const [nb, setNb] = useState({ name: "", kind: "CLAY" as (typeof BUSINESS_KINDS)[number] });
  const blank = { name: "", kind: "SHOP" as Place["kind"], businessId: "", days: [] as string[] };
  const [np, setNp] = useState(blank);
  const addBiz = useAction(() => api.post("/businesses", { ...nb, color: "#B45309" }), { success: "Business added", invalidate: ["businesses"], onSuccess: () => setNb({ ...nb, name: "" }) });
  const rename = useAction(({ id, name }: { id: string; name: string }) => api.patch(`/businesses/${id}`, { name }), { success: "Renamed", invalidate: ["businesses"] });
  const addPlace = useAction(() => api.post("/locations", { ...np }), { success: "Place added", invalidate: ["places"], onSuccess: () => setNp(blank) });
  const togglePlace = useAction((p: Place) => api.patch(`/locations/${p.id}`, { active: !p.active }), { invalidate: ["places"] });
  const bizName = (id: string | null) => biz?.find((b) => b.id === id)?.name ?? "";
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card title="Your businesses" subtitle="Each business is kept completely apart: its own items, stock, places, sales and costs. Only the money is added together in the accounts.">
        <div className="space-y-3 p-6">
          {biz?.map((b) => (
            <div key={b.id} className="flex items-center gap-3">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: b.color }} />
              <Input defaultValue={b.name} onBlur={(e) => e.target.value.trim().length >= 2 && e.target.value !== b.name && rename.mutate({ id: b.id, name: e.target.value.trim() })} />
              <Badge>{KIND_LABEL[b.kind]}</Badge>
            </div>
          ))}
          <div className="grid gap-3 border-t border-line/10 pt-4 sm:grid-cols-[1fr_180px_auto]">
            <Input placeholder="Add another business" value={nb.name} onChange={(e) => setNb({ ...nb, name: e.target.value })} />
            <Select value={nb.kind} onChange={(e) => setNb({ ...nb, kind: e.target.value as typeof nb.kind })}>{BUSINESS_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</Select>
            <Button variant="primary" loading={addBiz.isPending} disabled={nb.name.trim().length < 2} onClick={() => addBiz.mutate(undefined)}>Add</Button>
          </div>
        </div>
      </Card>
      <Card title="Shops, haats, melas and warehouses" subtitle="Places where you keep or sell goods. Add the days a haat or stall is open.">
        <div className="space-y-3 p-6">
          {places.length === 0 && <p className="text-[15px] text-muted">No places yet. Add your shop, each haat and your warehouse below.</p>}
          {places.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl bg-bg2 px-4 py-3">
              <Store className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1"><div className="truncate text-[15.5px] font-semibold">{p.name}</div><div className="text-[13.5px] text-muted">{KIND_LABEL[p.kind] ?? p.kind} · {bizName(p.businessId)}{p.days.length ? ` · ${p.days.map((d) => DAY_LABEL[d]).join(", ")}` : ""}</div></div>
              <Button size="sm" variant={p.active ? "outline" : "primary"} onClick={() => togglePlace.mutate(p)}>{p.active ? "Close" : "Reopen"}</Button>
            </div>
          ))}
          <div className="grid gap-3 border-t border-line/10 pt-4 sm:grid-cols-2">
            <Field label="Name"><Input value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} placeholder="e.g. Dola haat" /></Field>
            <Field label="Type"><Select value={np.kind} onChange={(e) => setNp({ ...np, kind: e.target.value as Place["kind"] })}>{LOCATION_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k] ?? "Mela"}</option>)}</Select></Field>
            <Field label="Business" className="sm:col-span-2"><Select value={np.businessId} onChange={(e) => setNp({ ...np, businessId: e.target.value })}><option value="">Choose a business…</option>{biz?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
            <Field label="Open on" className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">{WEEKDAYS.map((d) => <button type="button" key={d} onClick={() => setNp({ ...np, days: np.days.includes(d) ? np.days.filter((x) => x !== d) : [...np.days, d] })} className={`rounded-full border px-3.5 py-1.5 text-[14px] font-semibold ${np.days.includes(d) ? "border-primary bg-primary text-white" : "border-line/20 text-muted"}`}>{DAY_LABEL[d]}</button>)}</div>
            </Field>
            <div className="sm:col-span-2"><Button variant="primary" loading={addPlace.isPending} disabled={np.name.trim().length < 2 || !np.businessId} onClick={() => addPlace.mutate(undefined)}>Add place</Button></div>
          </div>
        </div>
      </Card>
    </div>
  );
}
