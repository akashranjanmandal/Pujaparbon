"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { formatINR } from "@pp/shared";
import { Drawer } from "@/components/ui/Drawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table } from "@/components/ui/Table";
import { Badge, Button, Card, Field, Input, Select } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { fmtDate, todayKey } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { paise, rupeeStr } from "@/lib/money";

interface Claim { id: string; platformId: string; platform: string; orderId: string; date: string; kind: string; status: "RAISED" | "APPROVED" | "REJECTED"; reason: string | null; expectedPaise: number; receivedPaise: number; gapPaise: number; product: string | null }
interface Res { summary: { raised: number; approved: number; rejected: number; pending: number; expectedPaise: number; receivedPaise: number; shortfallPaise: number; rejectedPaise: number }; claims: Claim[] }
const KIND: Record<string, string> = { DAMAGED: "Came back damaged", WRONG_ITEM: "Wrong item came back", MISSING: "Item missing", OTHER: "Other" };
const TONE = { RAISED: "blue", APPROVED: "green", REJECTED: "red" } as const;
const rs = (n: number) => formatINR(n, { decimals: false });

export default function ClaimsPage() {
  const [edit, setEdit] = useState<Claim | "new" | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["claims"], queryFn: () => api.get<Res>("/claims") });
  const s = data?.summary;
  return (
    <div>
      <PageHeader title="Claims" subtitle="Claims raised with Meesho, Flipkart or Amazon for damaged, wrong or missing returns. Note why each was approved or rejected, and what was actually paid."
        actions={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEdit("new")}>New claim</Button>} />
      {s && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tile label="Raised" value={String(s.raised)} sub={`${s.pending} waiting`} tone="bg-primary-soft text-primary" />
          <Tile label="Approved" value={String(s.approved)} sub={`${s.rejected} rejected`} tone="bg-lav-soft text-lav" />
          <Tile label="Paid vs expected" value={rs(s.receivedPaise)} sub={`of ${rs(s.expectedPaise)} · short by ${rs(s.shortfallPaise)}`} tone="bg-peach-soft text-peach" />
          <Tile label="Lost on rejected claims" value={rs(s.rejectedPaise)} tone="bg-panel text-sindoor" />
        </div>
      )}
      <Card plain className="overflow-hidden">
        <Table rows={data?.claims} loading={isLoading} onRowClick={setEdit} empty={<div className="px-6 py-10 text-center text-[15px] text-muted">No claims yet.</div>}
          columns={[
            { key: "d", header: "Date", cell: (r) => fmtDate(r.date) },
            { key: "o", header: "Order", cell: (r) => <span><b>{r.orderId}</b><div className="text-[13px] text-muted">{r.platform}{r.product ? ` · ${r.product}` : ""}</div></span> },
            { key: "k", header: "Problem", cell: (r) => KIND[r.kind] },
            { key: "s", header: "Status", cell: (r) => <span><Badge tone={TONE[r.status]}>{r.status === "RAISED" ? "Waiting" : r.status === "APPROVED" ? "Approved" : "Rejected"}</Badge>{r.reason && <div className="mt-1 max-w-[220px] text-[13px] text-muted">{r.reason}</div>}</span> },
            { key: "e", header: "Expected", align: "right", cell: (r) => rs(r.expectedPaise) },
            { key: "p", header: "Paid", align: "right", cell: (r) => r.status === "APPROVED" ? <span>{formatINR(r.receivedPaise)}{r.gapPaise > 0 && <div className="text-[13px] text-peach">short {formatINR(r.gapPaise)}</div>}</span> : "—" },
          ]} />
      </Card>
      {edit && <Editor claim={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

const Tile = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) => (
  <div className={`rounded-2xl p-5 ${tone}`}><div className="text-[14px] font-semibold">{label}</div><div className="display mt-1 text-[28px] leading-none text-text">{value}</div>{sub && <div className="mt-2 text-[13.5px] text-text/60">{sub}</div>}</div>
);

function Editor({ claim, onClose }: { claim: Claim | null; onClose: () => void }) {
  const { data: plats } = useQuery({ queryKey: ["platforms"], queryFn: () => api.get<{ id: string; name: string }[]>("/platforms") });
  const [f, setF] = useState({ platformId: claim?.platformId ?? "", orderId: claim?.orderId ?? "", date: claim?.date ?? todayKey(), kind: claim?.kind ?? "DAMAGED", status: claim?.status ?? "RAISED", reason: claim?.reason ?? "", expected: rupeeStr(claim?.expectedPaise ?? 0), received: rupeeStr(claim?.receivedPaise ?? 0) });
  const body = () => ({ platformId: f.platformId, orderId: f.orderId.trim(), date: f.date, kind: f.kind, status: f.status, reason: f.reason || undefined, expectedPaise: paise(f.expected), receivedPaise: f.status === "APPROVED" ? paise(f.received) : 0 });
  const save = useAction(() => (claim ? api.patch(`/claims/${claim.id}`, body()) : api.post("/claims", body())), { success: "Saved", invalidate: ["claims"], onSuccess: onClose });
  const remove = useAction(() => api.del(`/claims/${claim!.id}`), { success: "Removed", invalidate: ["claims"], onSuccess: onClose });
  return (
    <Drawer open onClose={onClose} title={claim ? "Update claim" : "New claim"} footer={<>{claim && <Button variant="danger" onClick={() => confirm("Remove this claim?") && remove.mutate(undefined)}>Remove</Button>}<Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={!f.platformId || !f.orderId.trim()} onClick={() => save.mutate(undefined)}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Platform"><Select value={f.platformId} onChange={(e) => setF({ ...f, platformId: e.target.value })}><option value="">Choose…</option>{plats?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="Order number"><Input value={f.orderId} onChange={(e) => setF({ ...f, orderId: e.target.value })} /></Field>
        <Field label="What was wrong?"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Date raised"><Input type="date" value={f.date} max={todayKey()} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Claim["status"] })}><option value="RAISED">Waiting for the platform</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></Select></Field>
        <Field label="Expected back (₹)" hint="What you listed it at."><Input inputMode="decimal" value={f.expected} onChange={(e) => setF({ ...f, expected: e.target.value })} /></Field>
        {f.status === "APPROVED" && <Field label="Platform paid (₹)"><Input inputMode="decimal" value={f.received} onChange={(e) => setF({ ...f, received: e.target.value })} /></Field>}
        {f.status !== "RAISED" && <Field label="Reason given" hint="e.g. different item returned, packing was poor" className="sm:col-span-2"><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>}
      </div>
    </Drawer>
  );
}
